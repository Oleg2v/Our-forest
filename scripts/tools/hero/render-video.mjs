// Renders the hero wind loop (portrait crop) frame by frame through the real shader, then encodes it.
// usage: node render-video.mjs <outDir> [--w=720 --h=1080 --fps=30 --seconds=7]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [outDir, ...rest] = process.argv.slice(2);
const val = (n, d) => { const f = rest.find((a) => a.startsWith(`--${n}=`)); return f ? f.split('=')[1] : d; };
const W = Number(val('w', 720)), H = Number(val('h', 1080)), FPS = Number(val('fps', 30)), SEC = Number(val('seconds', 7));
mkdirSync(`${outDir}/frames`, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5182/', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => typeof (window).__ofGLCapture === 'function', null, { timeout: 30000 });
const total = Math.round(FPS * SEC);
const BATCH = 15;
for (let from = Number(val('start', 0)); from < total; from += BATCH) {
  const frames = await page.evaluate((o) => (window).__ofGLCapture(o), { w: W, h: H, fps: FPS, seconds: SEC, src: '/img/heroPortrait-1200.jpg', mask: '/img/hero-mask-portrait.png', from, to: from + BATCH });
  frames.forEach((d, i) => writeFileSync(`${outDir}/frames/f${String(from + i).padStart(4, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')));
  console.log('frames', from, '→', from + frames.length);
}
await browser.close();
