/* Home section 5 — "Forest map — the checkout". Markup: partials/home/map.html.
   Mounts the forest map (src/components/forest-map.ts) in idle time (or at once on a #map deep link),
   keeps the participation-card prices in sync with prices.ts, and draws the card icons on reveal.
   Deep link: /?spot=0427#map centres that place on the map and opens its card.
   Dev only: /?mappicker=1#map mounts the picker mode under the map (add &product=bench|corner,
   &spot=0105 to test kinds and the preselect). */
import './map.css';
import { createForestMap, type ForestMapHandle } from '../../components/forest-map';
import { prices } from '../../content/prices';
import { ils } from '../../core/format';
import { env } from '../../core/env';
import { gsap, ScrollTrigger } from '../../core/gsap';

export function initMap(): void {
  const sec = document.querySelector<HTMLElement>('section.mapsec');
  if (!sec) return;
  const mount = sec.querySelector<HTMLElement>('[data-forest-map]');

  /* prices: one source of truth (the static HTML mirrors them for no-JS) */
  const P: Record<string, number> = { tree: prices.tree, bench: prices.bench, workshop: prices.workshopMin, corner: prices.corner };
  sec.querySelectorAll<HTMLElement>('[data-price]').forEach((el) => {
    const n = P[el.dataset.price ?? ''];
    if (n) el.innerHTML = `החל מ־<bdi class="price">${ils(n)}</bdi>`;
  });

  /* the map: built in idle time so the first screen stays light; the heavy parts
     (draw-in, pulses) start only when it is seen */
  let map: ForestMapHandle | null = null;
  const build = () => {
    if (map || !mount) return;
    const h0 = sec.offsetHeight;
    try { map = createForestMap(mount, { mode: 'home' }); } catch (e) { console.error('[map]', e); return; }
    if (Math.abs(sec.offsetHeight - h0) > 2) ScrollTrigger.refresh();
    // deep link: /?spot=0427#map centres that place and opens its card
    const spot = new URLSearchParams(location.search).get('spot');
    if (spot && /^\w{1,8}$/.test(spot)) map.select(spot);
  };
  if (location.hash === '#map') build();
  else {
    const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
    if (ric) ric(build, { timeout: 1500 }); else setTimeout(build, 600);
    // and in any case before it can be seen
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); build(); } }, { rootMargin: '150% 0px' });
    io.observe(sec);
  }

  /* card icons draw themselves with a line when they appear */
  const icons = sec.querySelectorAll<SVGPathElement>('.mapsec__ico path');
  if (icons.length && env.motionAllowed()) {
    ScrollTrigger.create({
      trigger: sec.querySelector('.mapsec__cards'),
      start: 'top 82%',
      once: true,
      onEnter: () => {
        if (!env.motionAllowed()) return;
        gsap.fromTo(icons, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.6, ease: 'power2.inOut', stagger: 0.14, delay: 0.15, clearProps: 'strokeDasharray,strokeDashoffset' });
      },
    });
  }

  if (import.meta.env.DEV) devPicker(sec);
}

/** dev-only: ?mappicker=1 mounts the configurator's picker mode under the map */
function devPicker(sec: HTMLElement) {
  const q = new URLSearchParams(location.search);
  if (q.get('mappicker') !== '1') return;
  const box = document.createElement('div');
  box.className = 'mapsec__dev container';
  box.innerHTML = `<p class="mapsec__dev-t">picker (dev, ?mappicker=1)</p><div class="mapsec__dev-map"></div><p class="mapsec__dev-out" aria-live="polite">—</p>`;
  sec.querySelector('.mapsec__map')!.after(box);
  const out = box.querySelector<HTMLElement>('.mapsec__dev-out')!;
  const handle = createForestMap(box.querySelector<HTMLElement>('.mapsec__dev-map')!, {
    mode: 'picker',
    initialSpotId: q.get('spot') ?? undefined,
    onSelect: (s) => { out.textContent = `onSelect → ${s.id} (${s.kind})`; },
  });
  (window as any).__ofMapPicker = handle;
}
