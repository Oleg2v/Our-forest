// Generate share images from the live renderer: node og.mjs <url> <outdir>
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url, outdir] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
await ctx.addInitScript(() => { try { localStorage.setItem('of:consent', JSON.stringify({ v: 'all', t: Date.now() })); } catch {} });
await ctx.routeWebSocket(/\/(\?token=.*)?$/, (ws) => { ws.send(JSON.stringify({ type: 'connected' })); ws.onMessage(() => {}); });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(7000);
for (const [f, type, name] of [['og', 'image/jpeg', 'og.jpg'], ['story', 'image/png', 'story.png'], ['square', 'image/png', 'square.png']]) {
  const data = await page.evaluate(async ([f, type]) => (await window.__tree.renderShare(f)).toDataURL(type, 0.88), [f, type]);
  writeFileSync(`${outdir}/${name}`, Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', `${outdir}/${name}`);
}
await browser.close();
