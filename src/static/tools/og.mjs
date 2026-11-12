// OG images 1200×630 for home / plant / business / default — screenshot an HTML template (2×) → sharp → JPEG.
// Usage (dev server running): node src/static/tools/og.mjs http://localhost:5173 [home|plant|business|default]
// Needs playwright (global) and sharp (devDependency). Photos come from /img (images.json), fonts from /src/styles/fonts.css.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(resolve(ROOT, 'package.json'));
const { chromium } = createRequire(resolve(ROOT, 'scripts/shot.mjs'))('playwright');
const sharp = require('sharp');
const ORIGIN = process.argv[2] || 'http://localhost:5173';
const OUT = resolve(ROOT, 'public/og');
const only = process.argv[3];

const leafMark = (c, sw = 1.2) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"><path d="M4 20A16 16 0 0 1 20 4A16 16 0 0 1 4 20Z"/><path d="M3 21L15.5 8.5"/></svg>`;
const base = `
<link rel="stylesheet" href="/src/styles/fonts.css?direct">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{font-family:'Heebo',sans-serif;-webkit-font-smoothing:antialiased;position:relative}
.fr{font-family:'Frank Ruhl Libre',serif}
.grain::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.05;mix-blend-mode:multiply;
background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.16 0 0 0 0 0.13 0 0 0 0 0.09 0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.mark{display:flex;align-items:center;gap:12px;font-size:22px;letter-spacing:.02em}
.mark svg{width:30px;height:30px}
.photo{position:absolute;overflow:hidden;background-size:cover;background-position:center}
</style>`;

const T = {
  home: `<html lang="he" dir="rtl"><head>${base}<style>
body{background:#232E1C;color:#FBF1E6}
.photo{left:40px;top:40px;width:560px;height:550px;border-radius:150px 0 150px 0;background-image:url(/img/hero-1200.jpg);background-position:42% 50%}
.txt{position:absolute;right:72px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center}
.eb{color:#C9CFA0;font-size:21px;font-weight:500;letter-spacing:.04em;margin-bottom:26px;display:flex;gap:10px;align-items:center}
.eb svg{width:22px;height:22px}
h1{font-weight:300;font-size:132px;line-height:.92;letter-spacing:-.02em;color:#FBF1E6}
.sub{margin-top:30px;font-size:34px;line-height:1.25;font-weight:400;color:#FBF1E6}
.foot{position:absolute;right:72px;bottom:44px;color:rgba(251,241,230,.7);font-size:20px}
</style></head><body class="grain">
<div class="photo"></div>
<div class="txt"><p class="eb">${leafMark('#C9CFA0', 1.4)}<span>יער מאכל · מושב פדיה</span></p><h1 class="fr">היער<br>שלנו</h1><p class="sub fr">מקום לצמוח, להתחבר<br>ולהעמיק שורשים</p></div>
<p class="foot">נוטעים עץ משלכם · עץ במתנה · לחברות וארגונים</p>
</body></html>`,

  plant: `<html lang="he" dir="rtl"><head>${base}<style>
body{background:#FBF1E6;color:#2A2118}
.photo{left:0;top:0;width:520px;height:630px;border-radius:0 0 200px 0;background-image:url(/img/rootsHands-1152.jpg);background-position:50% 55%}
.plaque{position:absolute;left:300px;top:300px;width:330px;height:190px;border-radius:22px;background:linear-gradient(180deg,#9A6B43,#80552F);
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#3A2414;transform:rotate(-3deg);border:1.5px solid #5E3D22}
.plaque::before{content:'';position:absolute;inset:10px;border-radius:14px;border:1.5px solid rgba(58,36,20,.35)}
.plaque .l1{font-size:38px;font-weight:500;color:#3A2414;text-shadow:0 1px 0 rgba(255,220,180,.25)}
.plaque .l2{font-size:18px;color:rgba(58,36,20,.8);letter-spacing:.08em}
.stake{position:absolute;left:452px;top:480px;width:26px;height:150px;background:#80552F;border:1.5px solid #5E3D22;transform:rotate(-3deg)}
.txt{position:absolute;right:72px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center}
.eb{color:#626630;font-size:21px;font-weight:500;letter-spacing:.04em;margin-bottom:24px}
h1{font-weight:300;font-size:112px;line-height:.93;letter-spacing:-.02em;color:#6B4A2E}
.sub{margin-top:28px;font-size:25px;line-height:1.5;color:rgba(42,33,24,.78);max-width:470px}
.mark{position:absolute;right:72px;bottom:44px;color:#2A2118}
</style></head><body class="grain">
<div class="photo"></div><div class="stake"></div>
<div class="plaque fr"><span class="l1">לנועה, שתצמחי איתו</span><span class="l2">עץ מס׳ 0427 · היער שלנו</span></div>
<div class="txt"><p class="eb">העץ שלכם</p><h1 class="fr">נוטעים<br>עץ משלכם</h1><p class="sub">עץ פרי ביער, שלט עץ חרוט עם ההקדשה ומקום קבוע על מפת היער.</p></div>
<p class="mark fr">${leafMark('#8F8E45', 1.4)}<span>היער שלנו · מושב פדיה</span></p>
</body></html>`,

  business: `<html lang="he" dir="rtl"><head>${base}<style>
body{background:#EDE5D4;color:#2A2118}
.photo{left:40px;top:40px;width:500px;height:550px;border-radius:150px 0 150px 0;background-image:url(/img/bizHero-1200.jpg);background-position:40% 50%}
.txt{position:absolute;right:72px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center}
.eb{color:#626630;font-size:21px;font-weight:500;letter-spacing:.04em;margin-bottom:24px}
h1{font-weight:300;font-size:104px;line-height:.93;letter-spacing:-.02em;color:#6B4A2E}
.list{margin-top:34px;display:flex;flex-direction:column;gap:10px;font-size:25px}
.list span{display:flex;align-items:baseline;gap:14px}
.list span::before{content:'';width:12px;height:12px;border-radius:7px 0 7px 0;background:#8F8E45;flex:none;transform:translateY(-2px)}
.mark{position:absolute;right:72px;bottom:44px;color:#2A2118}
</style></head><body class="grain">
<div class="photo"></div>
<div class="txt"><p class="eb">לחברות וארגונים</p><h1 class="fr">מחברים את העסק לשורשים</h1>
<p class="list"><span>חורשה של החברה</span><span>יום צוות ביער</span><span>מתנה לחג שצומחת</span></p></div>
<p class="mark fr">${leafMark('#8F8E45', 1.4)}<span>היער שלנו · מושב פדיה</span></p>
</body></html>`,

  default: `<html lang="he" dir="rtl"><head>${base}<style>
body{background:#232E1C;color:#FBF1E6}
.rings{position:absolute;left:-150px;top:-95px;width:820px;height:820px}
.rings path{fill:none;stroke:#C9CFA0;stroke-width:1.4;stroke-linejoin:round}
.txt{position:absolute;right:80px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center}
.eb{color:#C9CFA0;font-size:21px;font-weight:500;letter-spacing:.04em;margin-bottom:26px;display:flex;gap:10px;align-items:center}
.eb svg{width:22px;height:22px}
h1{font-weight:300;font-size:150px;line-height:.9;letter-spacing:-.02em}
.sub{margin-top:30px;font-size:34px;line-height:1.3}
</style></head><body class="grain">
<svg class="rings" viewBox="0 0 820 820">${Array.from({ length: 15 }, (_, i) => {
  const r0 = 22 + i * 25 + (i % 3) * 4;
  const pts = [];
  for (let k = 0; k <= 96; k++) {
    const a = (k / 96) * Math.PI * 2;
    const w = 1 + 0.035 * Math.sin(a * 3 + i * 0.7) + 0.022 * Math.sin(a * 7 + i * 1.9) + 0.012 * Math.sin(a * 13 + i);
    const r = r0 * w * (1 + 0.05 * Math.cos(a - 0.6));
    pts.push(`${(410 + 18 * (i / 15) + r * Math.cos(a)).toFixed(1)} ${(410 + 10 * (i / 15) + r * 0.95 * Math.sin(a)).toFixed(1)}`);
  }
  return `<path d="M${pts.join('L')}Z" opacity="${(0.66 - i * 0.033).toFixed(2)}"/>`;
}).join('')}</svg>
<div class="txt"><p class="eb">${leafMark('#C9CFA0', 1.4)}<span>יער מאכל · מושב פדיה</span></p><h1 class="fr">היער<br>שלנו</h1><p class="sub fr">מקום לצמוח, להתחבר ולהעמיק שורשים</p></div>
</body></html>`,
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
for (const [name, html] of Object.entries(T)) {
  if (only && only !== name) continue;
  const url = `${ORIGIN}/__og/${name}.html`;
  await page.route(url, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html>${html}` }));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: 'png' });
  const file = `${OUT}/${name}.jpg`;
  const info = await sharp(png).resize(1200, 630, { kernel: 'lanczos3' }).jpeg({ quality: 84, mozjpeg: true, progressive: true }).toFile(file);
  console.log(name, info.width, info.height, Math.round(info.size / 1024) + ' KB');
}
await browser.close();
