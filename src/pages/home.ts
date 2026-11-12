/* Entry: / (home, long scroll). Section order = the "Roots" journey:
   preloader → hero (crown) → under the ground → seasons → forest map (checkout) → companies → wall → contact → footer

   First impression first: the preloader rings and the counter are CSS animations that need the main thread, so the
   below-the-fold sections are initialised one per task, each right after a rendered frame (in journey order, so
   pins and triggers are still created top → bottom). On a mid phone that keeps the rings drawing smoothly and lets
   the ring window open on a quiet main thread. A failing section no longer stops the ones after it.
   Deep links (/#map, /#contact, /?spot=0427#map …) initialise everything at once, so the landing scroll measures
   the final layout. */
import { bootPage } from '../core/app';
import { initPreloader } from '../sections/home/preloader';
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
  // after the next rendered frame (rAF → task), so every section gets its own task between frames
  const afterFrame = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn, 0));
  // a hidden tab gets no frames: finish synchronously if it is backgrounded mid-way
  const flush = () => { if (document.hidden) below.splice(0).forEach(run); };
  const next = () => {
    const item = below.shift();
    if (item) run(item);
    if (below.length) afterFrame(next);
    else document.removeEventListener('visibilitychange', flush);
  };
  document.addEventListener('visibilitychange', flush);
  afterFrame(next);
}
