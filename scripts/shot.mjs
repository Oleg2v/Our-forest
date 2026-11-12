// Visual QA helper for agents.
// Usage: node scripts/shot.mjs <url> <outPrefix> [--mobile] [--desktop] [--scroll=0,900,1800] [--wait=1500]
//        [--reduced] [--click=<selector>] [--full] [--eval="js expression run before shots"]
// Prints console errors/warnings and page errors; saves PNGs <outPrefix>-<vp>-<y>.png (deviceScaleFactor 1).
// WebGL works headless via SwiftShader (software) — slow but real.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const url = args[0]; const out = args[1];
if (!url || !out) { console.error('usage: node scripts/shot.mjs <url> <outPrefix> [--mobile] [--desktop] ...'); process.exit(1); }
const flag = (n) => args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
const val = (n, d) => { const f = flag(n); return f && f.includes('=') ? f.slice(f.indexOf('=') + 1) : d; };
const vps = [];
if (flag('mobile') || !flag('desktop')) vps.push({ name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
if (flag('desktop') || !flag('mobile')) vps.push({ name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
const ys = val('scroll', '0').split(',').map(Number);
const wait = Number(val('wait', '1500'));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const vp of vps) {
  const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: 1, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', reducedMotion: flag('reduced') ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(wait);
  if (flag('eval')) { try { console.log('eval →', await page.evaluate(val('eval', ''))); } catch (e) { logs.push('[eval] ' + e.message); } }
  if (flag('click')) { try { await page.click(val('click', ''), { timeout: 5000 }); await page.waitForTimeout(wait); } catch (e) { logs.push('[click] ' + e.message); } }
  for (const y of ys) {
    await page.evaluate((yy) => { window.scrollTo(0, yy); (window).__lenis?.scrollTo?.(yy, { immediate: true }); }, y);
    await page.waitForTimeout(Math.max(600, wait / 2));
    const file = `${out}-${vp.name}-${y}.png`;
    await page.screenshot({ path: file, fullPage: !!flag('full') });
    console.log('saved', file);
  }
  const m = await page.evaluate(() => ({ docH: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 }));
  console.log(`[${vp.name}] docHeight=${m.docH} horizontalOverflow=${m.overflowX}`);
  console.log(logs.length ? logs.join('\n') : `[${vp.name}] no console errors`);
  await ctx.close();
}
await browser.close();
