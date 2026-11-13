/* Private visit statistics for every site and demo on the Cloudflare account.
   - Login with a code (secret STATS_CODE) → signed HttpOnly cookie (secret SESSION_KEY), 30 days.
   - /api/data?days=N: the Cloudflare GraphQL Analytics API (account level, httpRequestsAdaptiveGroups), one
     query window per day (the API allows at most a day per query), two queries per window:
       pages  — HTML responses (who opened which page when)
       assets — who loaded scripts/styles (a real browser does, most bots and scanners do not)
     then grouped into visits (same IP + browser, gaps under 30 min) and classified human / bot / preview.
   The API token never leaves the worker. */

const TZ = 'Asia/Jerusalem';
const GAP = 30 * 60 * 1000;
const MAX_DAYS = 14;
const BOT_UA = /bot|crawl|spider|slurp|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|headless|phantom|lighthouse|pagespeed|checker|scanner|monitor|uptime|preview|httpclient|libwww|scrapy|semrush|ahrefs|mj12|dataforseo|bytespider|petalbot|gptbot|claude|anthropic|perplexity|censys|zgrab|masscan|nuclei|expanse/i;
const PREVIEW_UA = /whatsapp|telegrambot|facebookexternalhit|twitterbot|slackbot|linkedinbot|discordbot|skypeuripreview|viber|google-read-aloud/i;
const SELF_IP = /^160\.79\.106\./; // automated checks run from the Claude Code cloud sessions

/* ------------------------------------------------------------------ config */
// Only two secrets are required: CF_API_TOKEN (a read-only "Account Analytics: Read" token) and STATS_CODE.
// SESSION_KEY and CF_ACCOUNT_ID are optional: the cookie key falls back to one derived from both secrets, and the
// account is the token's own (looked up once).
const sessionKey = (env) => env.SESSION_KEY || 'k:' + env.STATS_CODE + ':' + env.CF_API_TOKEN;
let accountId = null;
async function account(env) {
  if (env.CF_ACCOUNT_ID) return env.CF_ACCOUNT_ID;
  if (accountId) return accountId;
  const r = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=5', { headers: { Authorization: 'Bearer ' + env.CF_API_TOKEN } });
  const j = await r.json();
  if (!j.success || !j.result?.length) throw new Error('токен не видит ни одного аккаунта');
  return (accountId = j.result[0].id);
}

/* ------------------------------------------------------------------ auth */
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
function safeEq(a, b) {
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}
async function makeCookie(env) {
  const exp = Date.now() + 30 * 864e5;
  return `${exp}.${await hmac(sessionKey(env), 'stats:' + exp)}`;
}
async function authed(req, env) {
  const m = /(?:^|;\s*)ks=([^;]+)/.exec(req.headers.get('cookie') || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || +exp < Date.now()) return false;
  return safeEq(sig, await hmac(sessionKey(env), 'stats:' + exp));
}

/* ------------------------------------------------------------------ analytics */
async function gql(env, query, variables) {
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.CF_API_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors && j.errors.length) throw new Error(j.errors.map((e) => e.message).join('; '));
  return j.data.viewer.accounts[0].httpRequestsAdaptiveGroups;
}
const Q_PAGES = `query($a:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){
  httpRequestsAdaptiveGroups(limit:10000, filter:{datetime_geq:$s, datetime_lt:$e, requestSource:"eyeball", edgeResponseContentTypeName:"html"}, orderBy:[datetimeMinute_ASC]){
    count dimensions{ datetimeMinute clientIP userAgent clientRequestHTTPHost clientRequestPath edgeResponseStatus clientCountryName clientDeviceType } } }}}`;
const Q_ASSETS = `query($a:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){
  httpRequestsAdaptiveGroups(limit:10000, filter:{datetime_geq:$s, datetime_lt:$e, requestSource:"eyeball", edgeResponseStatus_in:[200,304], edgeResponseContentTypeName_in:["javascript","css"]}){
    count dimensions{ clientIP userAgent } } }}}`;

async function collect(env, days) {
  const now = Date.now();
  const windows = [];
  for (let i = 0; i < days; i++) windows.push([new Date(now - (i + 1) * 864e5), new Date(now - i * 864e5)]);
  const iso = (d) => d.toISOString().replace(/\.\d+Z$/, 'Z');
  let truncated = false;
  const acc = await account(env);
  const res = await Promise.all(windows.map(async ([s, e]) => {
    const v = { a: acc, s: iso(s), e: iso(e) };
    const [pages, assets] = await Promise.all([gql(env, Q_PAGES, v), gql(env, Q_ASSETS, v)]);
    if (pages.length >= 10000) truncated = true;
    return { pages, assets };
  }));
  const loaders = new Set();
  const rows = [];
  for (const { pages, assets } of res) {
    for (const a of assets) loaders.add(a.dimensions.clientIP + '|' + a.dimensions.userAgent);
    for (const p of pages) rows.push({ ...p.dimensions, count: p.count });
  }
  return { rows, loaders, truncated };
}

function classify(ip, ua, loaded) {
  if (SELF_IP.test(ip)) return 'self';
  if (PREVIEW_UA.test(ua)) return 'preview';
  if (!ua || BOT_UA.test(ua)) return 'bot';
  return loaded ? 'human' : 'bot';
}

function buildVisits({ rows, loaders }) {
  const byWho = new Map();
  for (const r of rows) {
    const k = r.clientIP + '|' + r.userAgent;
    if (!byWho.has(k)) byWho.set(k, []);
    byWho.get(k).push(r);
  }
  const visits = [];
  for (const [k, list] of byWho) {
    list.sort((a, b) => a.datetimeMinute.localeCompare(b.datetimeMinute));
    const [ip, ...uaParts] = k.split('|');
    const ua = uaParts.join('|');
    const kind = classify(ip, ua, loaders.has(k));
    let cur = null;
    for (const r of list) {
      const t = Date.parse(r.datetimeMinute);
      if (!cur || t - cur.end > GAP) {
        cur = { ip, ua, kind, country: r.clientCountryName, device: r.clientDeviceType, start: t, end: t, hits: [] };
        visits.push(cur);
      }
      cur.end = t;
      cur.hits.push({ t, host: r.clientRequestHTTPHost, path: r.clientRequestPath, status: r.edgeResponseStatus, n: r.count });
    }
  }
  visits.sort((a, b) => b.end - a.end);
  // scanners can hit hundreds of paths: keep the first 30 per non-human visit (the response stays small)
  for (const v of visits) if (v.kind !== 'human' && v.hits.length > 30) { v.more = v.hits.length - 30; v.hits = v.hits.slice(0, 30); }
  return visits;
}

/* ------------------------------------------------------------------ http */
const html = (body, status = 200, headers = {}) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer', ...headers } });

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n');
    if (url.pathname === '/login' && req.method === 'POST') {
      const form = await req.formData();
      if (env.STATS_CODE && env.CF_API_TOKEN && safeEq(String(form.get('code') || '').trim(), env.STATS_CODE)) {
        return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': `ks=${await makeCookie(env)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 86400}` } });
      }
      await new Promise((r) => setTimeout(r, 1500)); // slows guessing down
      return html(LOGIN(true), 401);
    }
    if (url.pathname === '/logout') return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': 'ks=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' } });
    const ok = await authed(req, env);
    if (url.pathname === '/api/data') {
      if (!ok) return new Response('{"error":"auth"}', { status: 401, headers: { 'content-type': 'application/json' } });
      const days = Math.min(MAX_DAYS, Math.max(1, parseInt(url.searchParams.get('days') || '2', 10) || 2));
      const cache = caches.default;
      const key = new Request(`https://stats-cache.internal/data?days=${days}`);
      const hit = await cache.match(key);
      if (hit && !url.searchParams.has('fresh')) return hit;
      try {
        const data = await collect(env, days);
        const body = JSON.stringify({ generated: Date.now(), days, truncated: data.truncated, visits: buildVisits(data) });
        const res = new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=60' } });
        ctx.waitUntil(cache.put(key, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=60' } })));
        return res;
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 502, headers: { 'content-type': 'application/json' } });
      }
    }
    if (url.pathname !== '/') return new Response(null, { status: 303, headers: { location: '/' } });
    return html(ok ? APP : LOGIN(false));
  },
};

/* ------------------------------------------------------------------ pages */
const STYLE = `
:root{--bg:#f6f1e7;--card:#fffdf8;--ink:#2b2a26;--soft:#6f6a5f;--line:#e4dccb;--acc:#5f6b32;--acc2:#b4492d;--chip:#efe8d8}
@media (prefers-color-scheme:dark){:root{--bg:#191814;--card:#23211c;--ink:#efe9dc;--soft:#a69f8f;--line:#3a362d;--acc:#b5c27a;--acc2:#e08a6b;--chip:#2e2b24}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
button,select,input{font:inherit;color:inherit}
`;
const LOGIN = (err) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Статистика</title><style>${STYLE}
main{min-height:100svh;display:grid;place-items:center;padding:16px}
form{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:28px;width:min(360px,100%);display:grid;gap:14px}
h1{margin:0;font-size:22px}p{margin:0;color:var(--soft)}
input{padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--bg);font-size:18px;letter-spacing:.08em}
button{padding:12px;border:0;border-radius:12px;background:var(--acc);color:#fff;font-weight:600;cursor:pointer}
.err{color:var(--acc2)}</style></head><body><main><form method="post" action="/login">
<h1>Статистика сайтов</h1><p>Введите код доступа</p>
<input name="code" type="password" autocomplete="current-password" autofocus required aria-label="Код доступа">
${err ? '<p class="err">Неверный код</p>' : ''}<button>Войти</button></form></main></body></html>`;

const APP = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Статистика сайтов</title><style>${STYLE}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line)}
.bar{max-width:1100px;margin:auto;padding:12px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
h1{font-size:18px;margin:0 auto 0 0}
select,.btn{padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);cursor:pointer;text-decoration:none}
@media (max-width:640px){header{position:static}.bar{gap:8px}h1{flex-basis:100%}select{flex:1 1 40%;min-width:0}}
label.tog{display:flex;gap:6px;align-items:center;color:var(--soft);font-size:14px;cursor:pointer}
main{max-width:1100px;margin:auto;padding:16px}
.sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
.num{font-size:28px;font-weight:650}.lbl{color:var(--soft);font-size:13px}
h2{font-size:16px;margin:22px 0 10px}
.sites{display:flex;flex-wrap:wrap;gap:8px}
.site{background:var(--card);border:1px solid var(--line);border-radius:12px;text-align:start;padding:6px 12px;font-size:14px;cursor:pointer}
.site b{color:var(--acc)}.site.on{outline:2px solid var(--acc)}
.v{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:10px}
.v.bot,.v.self,.v.preview{opacity:.6}
.top{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline}
.when{font-weight:650}.who{color:var(--soft);font-size:14px}
.tag{font-size:12px;padding:2px 8px;border-radius:999px;background:var(--chip);color:var(--soft)}
.tag.h{background:var(--acc);color:#fff}
.pages{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.pg{font-size:13px;background:var(--chip);border-radius:8px;padding:3px 8px;max-width:100%;overflow-wrap:anywhere}
.pg i{font-style:normal;color:var(--soft);margin-inline-end:6px}.pg s{text-decoration:none;color:var(--acc2)}
.ip{font-family:ui-monospace,monospace;font-size:12px;color:var(--soft);overflow-wrap:anywhere}
.note{color:var(--soft);font-size:13px;margin:18px 0}.err{color:var(--acc2)}
</style></head><body>
<header><div class="bar"><h1>Посетители сайтов</h1>
<select id="days" aria-label="Период"><option value="1">Последние 24 часа</option><option value="2" selected>2 дня</option><option value="3">3 дня</option><option value="7">Неделя</option><option value="14">2 недели</option></select>
<select id="site" aria-label="Сайт"><option value="">Все сайты</option></select>
<label class="tog"><input type="checkbox" id="bots"> роботы и превью</label>
<button class="btn" id="reload">Обновить</button><a class="btn" href="/logout">Выйти</a></div></header>
<main><div id="out"><p class="note">Загружаю…</p></div>
<p class="note">«Живой посетитель» — браузер, который загрузил страницу вместе со скриптами и стилями. Один человек = одно устройство с одного адреса; перерыв больше 30 минут начинает новый визит. Имён Cloudflare не знает — видны адрес, страна, устройство и браузер. Часть трафика Cloudflare считает выборочно, так что число просмотров приблизительное; кто и когда заходил — точно. Время — израильское.</p></main>
<script>
const $=s=>document.querySelector(s);
const regions=new Intl.DisplayNames(['ru'],{type:'region'});
const flag=c=>c&&c.length===2?String.fromCodePoint(...[...c.toUpperCase()].map(x=>127397+x.charCodeAt(0))):'';
const country=c=>{try{return c&&c!=='XX'&&c!=='T1'?regions.of(c):'неизвестно'}catch{return c}};
const fmtD=new Intl.DateTimeFormat('ru-RU',{timeZone:'${TZ}',day:'numeric',month:'short'});
const fmtT=new Intl.DateTimeFormat('ru-RU',{timeZone:'${TZ}',hour:'2-digit',minute:'2-digit'});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function device(ua,d){
  let os=/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Mac OS X|Macintosh/.test(ua)?'Mac':/Linux/.test(ua)?'Linux':(d==='mobile'?'телефон':'компьютер');
  let br=/Instagram/.test(ua)?'Instagram':/FBAN|FBAV/.test(ua)?'Facebook':/Telegram/.test(ua)?'Telegram':/WhatsApp/.test(ua)?'WhatsApp':/CriOS/.test(ua)?'Chrome':/FxiOS|Firefox/.test(ua)?'Firefox':/EdgiOS|Edg\\//.test(ua)?'Edge':/SamsungBrowser/.test(ua)?'Samsung':/OPR\\//.test(ua)?'Opera':/YaBrowser/.test(ua)?'Яндекс':/Chrome\\//.test(ua)?'Chrome':/Safari\\//.test(ua)?'Safari':'';
  return os+(br?' · '+br:'');
}
const KIND={human:['живой посетитель','h'],bot:['робот / сканер',''],preview:['превью ссылки',''],self:['проверка Claude','']};
let data=null;
async function load(fresh){
  $('#out').innerHTML='<p class="note">Загружаю…</p>';
  try{
    const r=await fetch('/api/data?days='+$('#days').value+(fresh?'&fresh=1':''),{credentials:'same-origin'});
    if(r.status===401){location.reload();return}
    data=await r.json(); if(data.error) throw new Error(data.error);
    const hosts=[...new Set(data.visits.flatMap(v=>v.hits.map(h=>h.host)))].sort();
    const cur=$('#site').value;
    $('#site').innerHTML='<option value="">Все сайты</option>'+hosts.map(h=>'<option'+(h===cur?' selected':'')+'>'+esc(h)+'</option>').join('');
    render();
  }catch(e){$('#out').innerHTML='<p class="err">Не удалось загрузить: '+esc(e.message)+'</p>'}
}
function render(){
  const site=$('#site').value, showBots=$('#bots').checked;
  let vs=data.visits.map(v=>site?{...v,hits:v.hits.filter(h=>h.host===site)}:v).filter(v=>v.hits.length);
  const humans=vs.filter(v=>v.kind==='human');
  const people=new Set(humans.map(v=>v.ip+'|'+v.ua)).size;
  const views=humans.reduce((s,v)=>s+v.hits.filter(h=>h.status<400).reduce((a,h)=>a+h.n,0),0);
  const perSite={};
  for(const v of humans){for(const h of v.hits){(perSite[h.host]??={people:new Set(),last:0}).people.add(v.ip+'|'+v.ua);perSite[h.host].last=Math.max(perSite[h.host].last,h.t)}}
  const siteList=Object.entries(perSite).sort((a,b)=>b[1].last-a[1].last);
  let out='<div class="sum"><div class="card"><div class="num">'+people+'</div><div class="lbl">живых посетителей</div></div>'+
    '<div class="card"><div class="num">'+humans.length+'</div><div class="lbl">визитов</div></div>'+
    '<div class="card"><div class="num">'+views+'</div><div class="lbl">просмотров страниц</div></div>'+
    '<div class="card"><div class="num">'+siteList.length+'</div><div class="lbl">сайтов с посетителями</div></div></div>';
  if(!site&&siteList.length){out+='<h2>По сайтам</h2><div class="sites">'+siteList.map(([h,s])=>'<button class="site" data-h="'+esc(h)+'">'+esc(h)+' — <b>'+s.people.size+'</b> · '+fmtD.format(s.last)+' '+fmtT.format(s.last)+'</button>').join('')+'</div>'}
  const list=showBots?vs:humans;
  out+='<h2>Визиты</h2>'+(list.length?'':'<p class="note">За этот период никого.</p>');
  for(const v of list.slice(0,400)){
    const [kl,kc]=KIND[v.kind];
    const span=v.end>v.start?fmtT.format(v.start)+'–'+fmtT.format(v.end):fmtT.format(v.start);
    const sites=[...new Set(v.hits.map(h=>h.host))];
    out+='<div class="v '+v.kind+'"><div class="top"><span class="when">'+fmtD.format(v.start)+', '+span+'</span>'+
      '<span class="who">'+flag(v.country)+' '+esc(country(v.country))+' · '+esc(device(v.ua,v.device))+'</span><span class="tag '+kc+'">'+kl+'</span>'+
      (site?'':'<span class="who">'+sites.map(esc).join(', ')+'</span>')+'</div>'+
      '<div class="pages">'+v.hits.map(h=>'<span class="pg"><i>'+fmtT.format(h.t)+'</i>'+(sites.length>1&&!site?esc(h.host):'')+esc(h.path)+(h.n>1?' ×'+h.n:'')+(h.status>=400?' <s>'+h.status+'</s>':'')+'</span>').join('')+'</div>'+
      '<details><summary class="ip">адрес и браузер</summary><div class="ip">'+esc(v.ip)+'<br>'+esc(v.ua)+'</div></details></div>';
  }
  if(data.truncated) out+='<p class="note">За некоторые сутки строк было больше лимита — самые старые визиты могли не попасть.</p>';
  out+='<p class="note">Обновлено '+fmtD.format(data.generated)+' '+fmtT.format(data.generated)+'</p>';
  $('#out').innerHTML=out;
  document.querySelectorAll('.site').forEach(b=>b.onclick=()=>{$('#site').value=b.dataset.h;render()});
}
$('#days').onchange=()=>load(); $('#site').onchange=render; $('#bots').onchange=render; $('#reload').onclick=()=>load(true);
load();
</script></body></html>`;
