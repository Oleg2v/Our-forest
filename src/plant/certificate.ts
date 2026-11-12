/* After the mock payment: the certificate "prints" — paper slides out of a slot,
   then a stamp falls with a light shake (memorial: settles softly, no shake).
   Buttons: "צפו בעמוד העץ" → /tree/0427?birth=1, "שתפו בוואטסאפ", print.
   The certificate prints on one A4 page (print-certificate.css). */
import qrcode from 'qrcode-generator';
import { he } from '../content/he';
import { ilDate, ils, waLink } from '../core/format';
import { gsap, EASE } from '../core/gsap';
import { sound } from '../core/sound';
import { track } from '../core/analytics';
import { navigate, refreshChrome } from '../chrome';
import { escapeHtml } from './a11y';
import { icon, treeSvg } from './art';
import { speciesName, occasionLabel, WORKSHOPS, BENCH_ITEMS } from './catalog';
import { giftWhenText } from './steps-flow';
import type { PlantState } from './store';
import type { BuyerDetails, Ctx } from './types';
import './print-certificate.css';

export const DEMO_TREE_ID = '0427';

function qrSvg(url: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg class="cert__qr-svg" viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="QR"><path d="${d}"/></svg>`;
}

function stampSvg(year: number, memorial: boolean): string {
  const ring = `${he.brand} · ${he.place} · ${he.brand} · ${he.place} · `;
  return `<svg class="cert__stamp-svg" viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <filter id="cert-ink" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.18" result="m"/>
        <feComposite in="SourceGraphic" in2="m" operator="in"/>
      </filter>
      <path id="cert-ring" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/>
    </defs>
    <g filter="url(#cert-ink)">
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-width="2.4"/>
      <circle cx="60" cy="60" r="35" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <text direction="ltr" font-size="9.6" letter-spacing="0.6" fill="currentColor" font-family="Heebo, sans-serif" font-weight="500"><textPath href="#cert-ring" startOffset="0">${ring}</textPath></text>
      <g transform="translate(36 30) scale(2)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="${memorial ? 'M5 19C5 11 10 5 19 5c0 9-6 14-14 14zM5 19l8-8' : 'M12 21v-9M12 12c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6zM12 14c0-3 2-5 5.5-5 0 3-2 5-5.5 5zM8 21h8'}"/>
      </g>
      <text x="60" y="88" text-anchor="middle" font-size="11" fill="currentColor" font-family="'Frank Ruhl Libre', serif" font-weight="500">${year}</text>
    </g>
  </svg>`;
}

export function treeHref(s: PlantState): string {
  const q = new URLSearchParams({ birth: '1' });
  if (s.product !== 'workshop' && s.product !== 'bench') q.set('species', s.species);
  if (s.text.trim()) q.set('text', s.text.trim());
  if (s.occasion === 'memorial') q.set('mode', 'memorial');
  return `/tree/${DEMO_TREE_ID}?${q.toString()}`;
}

export interface DoneView { el: HTMLElement; play(): Promise<void> }

export function createDoneView(ctx: Ctx, s: PlantState, buyer: BuyerDetails, plaqueUrl: string | null): DoneView {
  const memorial = s.occasion === 'memorial' && s.product !== 'workshop';
  const now = new Date();
  const treeNo = s.spotMode === 'map' && s.spot ? s.spot : DEMO_TREE_ID;
  const ws = WORKSHOPS.find((w) => w.id === s.ws)!;
  const isWs = s.product === 'workshop';
  const certTitle = isWs ? 'כרטיס לסדנה' : s.product === 'tree' ? 'תעודת נטיעה' : 'תעודת הקדשה'; // micro-copy
  const href = treeHref(s);
  const abs = new URL(href, location.origin).toString();
  const pricing = ctx.pricing(s);

  const facts: [string, string][] = [];
  if (isWs) {
    facts.push(['סדנה', escapeHtml(ws.title)], ['תאריך', `<bdi>${ilDate(s.date)}</bdi>, <bdi>09:00</bdi>`], ['משתתפים', `<bdi>${s.seats}</bdi>`], ['על שם', escapeHtml(buyer.name)]);
  } else {
    const what = s.product === 'bench' ? BENCH_ITEMS.find((b) => b.id === s.item)!.label : `עץ ${speciesName(s.species)}`;
    facts.push([s.product === 'bench' ? 'מה בונים' : 'העץ', escapeHtml(what)]);
    if (s.occasion) facts.push(['לכבוד', occasionLabel(s.occasion)]);
    facts.push(['נוטעים', escapeHtml(buyer.name)]);
    facts.push(['תאריך', `<bdi>${ilDate(now)}</bdi>`]);
    facts.push(['המקום', s.spotMode === 'map' && s.spot ? `<bdi>${escapeHtml(s.spot)}</bdi>` : he.plant.location.forUs]);
    if (s.gift && s.giftTo) facts.push(['מתנה', escapeHtml(`ל${s.giftTo.replace(/^ל/, '')}`)]);
  }

  const when = s.giftWhen === 'now' ? 'עכשיו' : s.giftWhen === 'tubishvat' ? giftWhenText(s) : `ב־${giftWhenText(s)}`;
  const lead = s.gift
    ? `הברכה תישלח ל${escapeHtml(s.giftTo.replace(/^ל/, ''))} ${when}, ב${s.giftVia === 'wa' ? he.cta.whatsapp : 'אימייל'}.`
    : `התעודה נשלחת אליכם${buyer.email ? ' באימייל' : ' בוואטסאפ'}. שולם <bdi>${ils(pricing.total)}</bdi>.`; // micro-copy

  const el = document.createElement('section');
  el.className = `pdone${memorial ? ' pdone--memorial' : ''}`;
  el.setAttribute('aria-labelledby', 'pdone-t');
  el.innerHTML = `
    <div class="pdone__copy">
      <p class="eyebrow pdone__eyebrow">${icon('check')}<span>${isWs ? he.workshops.reserve : certTitle}</span></p>
      <h2 class="pdone__title" id="pdone-t" tabindex="-1">${isWs ? escapeHtml(ws.title) : he.plant.after.title}</h2>
      <p class="pdone__lead">${lead}</p>
      <div class="pdone__actions">
        ${isWs ? '' : `<a class="btn btn--fruit btn--lg pdone__view" href="${href}" data-cursor="גלו" data-cursor-fill="fruit">${he.plant.after.view}${icon('fwd', 'icon arrow-fwd')}</a>`}
        <a class="btn btn--outline btn--lg pdone__share" href="${waLink(`${isWs ? ws.title : he.plant.after.title} · ${abs}`, '')}" target="_blank" rel="noopener">${icon('chat')}<span>${he.plant.after.share}</span></a>
        <button type="button" class="pdone__print">${icon('print')}<span>מדפיסים את ${isWs ? 'הכרטיס' : 'התעודה'}</span></button>
      </div>
    </div>
    <div class="pdone__printer">
      <div class="pdone__slot" aria-hidden="true"></div>
      <div class="pdone__feed">
        <article class="cert${memorial ? ' cert--memorial' : ''}" aria-label="${certTitle}">
          <div class="cert__frame">
            <header class="cert__head">
              <p class="cert__brand">${he.brand}</p>
              <p class="cert__place">${he.place}</p>
            </header>
            <h3 class="cert__title">${certTitle}</h3>
            <p class="cert__no">${isWs ? escapeHtml(ws.title) : he.tree.number(treeNo)}</p>
            <div class="cert__art">${isWs ? `<span class="cert__ws-ico">${icon(({ carpentry: 'bench', dogs: 'dog', garden: 'sprout' } as const)[s.ws])}</span>` : treeSvg(s.product === 'bench' ? 'olive' : s.species, { roots: true, className: 'cert__tree', viewBox: '0 36 240 222' })}
            ${!isWs && plaqueUrl ? `<img class="cert__plaque" src="${plaqueUrl}" alt="${escapeHtml(s.text.trim() ? `השלט: ${s.text.trim()}` : 'השלט')}">` : ''}</div>
            <dl class="cert__facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
            ${isWs ? '' : `<p class="cert__promise">${icon('guarantee')}<span>${he.plant.includes.items[5]}</span></p>`}
            <footer class="cert__foot">
              <div class="cert__qr">${qrSvg(abs)}<p>${isWs ? escapeHtml(he.place) : he.tree.qrNote}</p></div>
              <div class="cert__sign"><span class="cert__sign-line"></span><span>${he.brand}</span></div>
            </footer>
          </div>
          <div class="cert__stamp">${stampSvg(now.getFullYear(), memorial)}</div>
        </article>
      </div>
    </div>`;

  el.querySelector('.pdone__print')!.addEventListener('click', () => { sound.play('paper'); window.print(); });
  el.querySelector('.pdone__share')!.addEventListener('click', () => track('share_tree', { method: 'whatsapp', product: s.product }));
  el.querySelector('.pdone__view')?.addEventListener('click', (e) => {
    const me = e as MouseEvent;
    if (me.metaKey || me.ctrlKey || me.shiftKey || me.button !== 0) return;
    e.preventDefault();
    navigate(href, { x: me.clientX, y: me.clientY });
  });

  const play = async () => {
    refreshChrome(el);
    const paper = el.querySelector<HTMLElement>('.cert')!;
    const stamp = el.querySelector<HTMLElement>('.cert__stamp')!;
    const copy = el.querySelectorAll<HTMLElement>('.pdone__copy > *');
    if (!ctx.motion()) {
      gsap.set(stamp, { opacity: 0.9, rotate: -9 });
      return;
    }
    const sp = memorial ? 1.5 : 1;
    sound.play('paper');
    const tl = gsap.timeline();
    tl.set(paper, { yPercent: -101 })
      .set(stamp, { opacity: 0, scale: 2.4, rotate: -24 })
      .set(copy, { opacity: 0, y: 24 })
      // printing: three pushes with tiny pauses, like a real feed
      .to(paper, { yPercent: -66, duration: 0.7 * sp, ease: 'power2.inOut' })
      .to(paper, { yPercent: -30, duration: 0.7 * sp, ease: 'power2.inOut' }, '+=0.12')
      .to(paper, { yPercent: 0, duration: 0.95 * sp, ease: 'power3.out' }, '+=0.12')
      .to(stamp, { opacity: 0.92, scale: 1, rotate: -9, duration: (memorial ? 0.9 : 0.42), ease: memorial ? 'power2.out' : 'power4.in' }, '+=0.15')
      .add(() => { sound.play('chime'); sound.haptic([10, 30, 10]); });
    if (!memorial) {
      tl.to(paper, { keyframes: [{ x: -3, rotate: -0.35 }, { x: 2.5, rotate: 0.3 }, { x: -1.2, rotate: -0.12 }, { x: 0, rotate: 0 }], duration: 0.42, ease: 'power1.out' }, '<');
    }
    tl.to(copy, { opacity: 1, y: 0, stagger: 0.09 * sp, duration: 1.1 * sp, ease: EASE.appear }, '-=0.25');
    await tl.then();
  };
  return { el, play };
}
