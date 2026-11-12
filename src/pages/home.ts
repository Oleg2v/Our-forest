/* Entry: / (home, long scroll). Section order = the "Roots" journey:
   preloader → hero (crown) → under the ground → seasons → forest map (checkout) → companies → wall → contact → footer

   First impression first. The preloader rings and counter are CSS animations that need the main thread, the ring
   window opening and the hero letters are GSAP — so nothing below the fold is initialised while they play:
   · the below-the-fold sections start once the intro has settled (≈ 0.9 s after the window opened, when the title
     letters have landed), or at once on the first scroll — whichever comes first;
   · then one section per task, each right after a rendered frame, in journey order (pins and triggers are still
     created top → bottom), and one ScrollTrigger.refresh() at the end if the page had already finished loading;
   · deep links (/#map, /#contact, /?spot=0427#map …) initialise everything now, so the landing scroll measures the
     final layout (the preloader is skipped on deep links anyway);
   · a section that throws no longer stops the ones after it.
   Measured on a throttled phone profile (4× CPU, 9 Mbps / 150 ms): the rings get frames while they draw, the window
   opens on a quiet main thread and the counter reaches 100 on time. */
import { bootPage } from '../core/app';
import { bus } from '../core/bus';
import { env } from '../core/env';
import { ScrollTrigger } from '../core/gsap';
import { initPreloader, preloaderPlaying } from '../sections/home/preloader';
import { initHero } from '../sections/home/hero';
import { initRoots } from '../sections/home/roots';
import { initSeasons } from '../sections/home/seasons';
import { initMap } from '../sections/home/map';
import { initCompanies } from '../sections/home/companies';
import { initWall } from '../sections/home/wall';
import { initContact } from '../sections/home/contact';

bootPage('home');
const ready = initPreloader();
initHero(ready);

const below: Array<[string, () => void]> = [
  ['roots', initRoots], ['seasons', initSeasons], ['map', initMap],
  ['companies', initCompanies], ['wall', initWall], ['contact', initContact],
];
const run = ([name, init]: [string, () => void]) => {
  try { init(); } catch (e) { console.error(`[home] ${name}`, e); }
};

if (location.hash.length > 1 || document.visibilityState === 'hidden') {
  below.forEach(run);
} else {
  let started = false;
  let finished = false;
  const afterFrame = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn, 0));
  const finish = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onHidden);
    // triggers made at boot (reveals, page colours, footer) were measured before these pins existed;
    // before 'load' the boot's own load-time refresh still covers it
    if (document.readyState === 'complete') ScrollTrigger.refresh();
  };
  const start = () => {
    if (started) return;
    started = true;
    const next = () => {
      const item = below.shift();
      if (item) run(item);
      if (below.length) afterFrame(next); else finish();
    };
    next();
  };
  // the first real scroll means "take me down": start now (the intro locks scroll, so it cannot fire before)
  const onScroll = () => { if (!preloaderPlaying() && window.scrollY > 0) start(); };
  // a hidden tab gets no frames: finish synchronously
  const onHidden = () => {
    if (!document.hidden) return;
    started = true;
    below.splice(0).forEach(run);
    finish();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onHidden);
  const soon = (ms: number) => window.setTimeout(() => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(start, { timeout: 500 }); else start();
  }, ms);
  if (!env.motionAllowed()) afterFrame(start);
  else if (preloaderPlaying()) bus.on('preloader:done', () => soon(900));
  else ready.then(() => soon(1500), () => soon(1500));
}
