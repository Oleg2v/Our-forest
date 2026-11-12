/* Lazy photos sharpen in from their own blurred colour preview (LQIP is the <img> background,
   set at build time). Critical path: runs with the first chrome pass. */
import { env } from '../core/env';
import { qsa } from './util';

const seenImg = new WeakSet<HTMLImageElement>();
export function scanImages(scope: ParentNode = document) {
  if (!env.motionAllowed()) return;
  qsa<HTMLImageElement>('img[data-img-key][loading="lazy"]:not([data-img-pending])', scope).forEach((img) => {
    if (seenImg.has(img)) return;
    seenImg.add(img);
    if (img.complete && img.naturalWidth > 0) return;
    img.classList.add('img-sharpen');
    const clear = () => setTimeout(() => img.classList.remove('img-sharpen', 'is-loaded'), 1100);
    img.addEventListener('load', () => {
      img.decode?.().catch(() => {}).finally(() => requestAnimationFrame(() => { img.classList.add('is-loaded'); clear(); }));
    }, { once: true });
    img.addEventListener('error', () => img.classList.remove('img-sharpen'), { once: true });
  });
}

