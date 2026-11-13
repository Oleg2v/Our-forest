/* Lazy photos sharpen in from their own blurred colour preview (LQIP is the <img> background,
   set at build time). Critical path: runs with the first chrome pass.
   Only where it can be seen: lazy loading starts well ahead of the viewport, so most photos finish loading
   out of sight — those are simply shown sharp (the end state of the same 1 s blur → sharp). While a blur
   transition runs, Blink treats the photo as possibly covering anything painted after it, so every positioned
   box below it on the page (heading line masks, icons, the footer) was lifted into one page-tall layer for
   that second (390×2808 on the /business phone) — for a transition nobody was looking at. */
import { env } from '../core/env';
import { qsa } from './util';

const seenImg = new WeakSet<HTMLImageElement>();
/** in or near the viewport (half a screen above / below): true / false; unknown until the first callback */
const near = new WeakMap<Element, boolean>();
let io: IntersectionObserver | null = null;
const watch = (img: HTMLImageElement) => {
  if (!('IntersectionObserver' in window)) return;
  io ??= new IntersectionObserver((entries) => { for (const e of entries) near.set(e.target, e.isIntersecting); }, { rootMargin: '50% 0px' });
  io.observe(img);
};
const unwatch = (img: HTMLImageElement) => { io?.unobserve(img); near.delete(img); };

export function scanImages(scope: ParentNode = document) {
  if (!env.motionAllowed()) return;
  qsa<HTMLImageElement>('img[data-img-key][loading="lazy"]:not([data-img-pending])', scope).forEach((img) => {
    if (seenImg.has(img)) return;
    seenImg.add(img);
    if (img.complete && img.naturalWidth > 0) return;
    img.classList.add('img-sharpen');
    watch(img);
    const clear = () => setTimeout(() => img.classList.remove('img-sharpen', 'is-loaded'), 1100);
    img.addEventListener('load', () => {
      img.decode?.().catch(() => {}).finally(() => requestAnimationFrame(() => {
        const seen = near.get(img) !== false;
        unwatch(img);
        // out of sight: sharp at once (no transition — the class that carries it goes with the blur)
        if (!seen) { img.classList.remove('img-sharpen'); return; }
        img.classList.add('is-loaded');
        clear();
      }));
    }, { once: true });
    img.addEventListener('error', () => { unwatch(img); img.classList.remove('img-sharpen'); }, { once: true });
  });
}
