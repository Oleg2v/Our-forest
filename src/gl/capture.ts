/* DEV ONLY — renders the hero wind as a seamless loop, frame by frame, for the phone video fallback
   (public/video/hero-loop.{webm,mp4}). Driven by Playwright; see docs/agent-notes/hero.md.
   Uses the same single stage + the same shader as the live hero (loop mode: harmonics of the period). */
import { createHeroWind } from './hero-wind';

export interface CaptureOptions { w: number; h: number; fps: number; seconds: number; src: string; mask: string; from?: number; to?: number }

let handle: Awaited<ReturnType<typeof createHeroWind>> = null;

export async function captureLoop(o: CaptureOptions): Promise<string[]> {
  if (!handle) {
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:0;top:0;width:${o.w}px;height:${o.h}px;z-index:99999;`;
    document.body.appendChild(host);
    const img = new Image();
    img.src = o.src;
    await img.decode();
    handle = await createHeroWind({ host, img, maskUrl: o.mask, season: 'autumn', quality: 'full', dprCap: 1, particles: false });
    if (!handle) throw new Error('no GL');
    handle.__loop(o.seconds);
  }
  const frames: string[] = [];
  const total = Math.round(o.fps * o.seconds);
  for (let i = o.from ?? 0; i < Math.min(total, o.to ?? total); i++) {
    handle.__renderAt(i / o.fps);
    frames.push(handle.canvas.toDataURL('image/png'));
  }
  return frames;
}
