/* ==========================================================================
   Home section 6 — "מחברים את העסק לשורשים" (companies). Markup: partials/home/companies.html
   ONE motion idea: the banner photo opens on scroll from a small leaf to the full screen.
   · desktop + motion  → CSS-sticky stage inside a 260vh banner, scrubbed clip-path
                         (leaf → rectangle), inner photo scale 1.32 → 1, then a short hold.
   · phones + motion   → no pin: the same opening, scrubbed while the stage crosses the screen.
   · reduced motion    → static: title, a leaf-shaped photo, everything visible.
   The title changes colour exactly at the leaf's edge: a cream twin of the copy lives inside the
   clipped photo layer (aria-hidden), the bark original sits underneath.
   Packages / logos / buttons are plain markup (chrome reveals); their line marks draw themselves.
   ========================================================================== */
import './companies.css';
import { gsap, ScrollTrigger } from '../../core/gsap';
import { env } from '../../core/env';
import { bus } from '../../core/bus';
import { he, NBSP } from '../../content/he';
import { ils } from '../../core/format';

type Mode = 'static' | 'pin' | 'scrub';

const heGet = (path: string): unknown => path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), he);

/** HTML carries the verbatim copy (no-JS, SEO); keep it in sync with he.ts. Prices: smaller ₪ sign. */
function syncCopy(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-he]').forEach((el) => {
    const v = heGet(el.dataset.he!);
    if (typeof v === 'string' && el.textContent !== v) el.textContent = v;
  });
  root.querySelectorAll<HTMLElement>('[data-ils]').forEach((el) => {
    const v = heGet(el.dataset.ils!);
    if (typeof v !== 'number') return;
    const [num, cur] = ils(v).split(NBSP);
    el.innerHTML = `${num}<span class="companies__cur">${NBSP}${cur}</span>`;
  });
}

/** Line marks (package icons, placeholder logos) draw themselves once when they come into view. */
function drawMarks(root: HTMLElement): () => void {
  const groups = Array.from(root.querySelectorAll<SVGSVGElement>('svg[data-draw]'));
  if (!env.motionAllowed() || !groups.length) return () => {};
  const shapes = (svg: SVGSVGElement) => Array.from(svg.querySelectorAll<SVGGeometryElement>('path, circle'));
  groups.forEach((svg) => gsap.set(shapes(svg), { drawSVG: '0%' }));
  const triggers = groups.map((svg, i) => ScrollTrigger.create({
    trigger: svg,
    start: 'top 88%',
    once: true,
    onEnter: () => gsap.to(shapes(svg), {
      drawSVG: '100%', duration: 1.1, ease: 'power2.out', stagger: 0.09,
      delay: svg.closest('.companies__marks') ? (i % 6) * 0.08 : 0.25,
      onComplete() { gsap.set(shapes(svg), { clearProps: 'all' }); },
    }),
  }));
  return () => { triggers.forEach((t) => t.kill()); groups.forEach((svg) => gsap.set(shapes(svg), { clearProps: 'all' })); };
}

export function initCompanies(): void {
  const root = document.getElementById('companies');
  if (!root) return;
  syncCopy(root);

  const banner = root.querySelector<HTMLElement>('[data-companies-banner]');
  const stage = root.querySelector<HTMLElement>('[data-companies-stage]');
  const photo = root.querySelector<HTMLElement>('[data-companies-photo]');
  const media = root.querySelector<HTMLElement>('[data-companies-media]');
  const copy = root.querySelector<HTMLElement>('[data-companies-copy]');
  if (!banner || !stage || !photo || !media || !copy) return;
  const scrim = photo.querySelector<HTMLElement>('.companies__scrim');

  const mq = window.matchMedia('(max-width: 768px)');
  let mode: Mode | null = null;
  let ctx: gsap.Context | null = null;
  let clone: HTMLElement | null = null;
  let undraw: () => void = () => {};

  function teardown() {
    ctx?.revert();
    ctx = null;
    clone?.remove();
    clone = null;
    photo!.style.clipPath = '';
    media!.style.transform = '';
    if (scrim) scrim.style.opacity = '';
    root!.classList.remove('companies--stage', 'companies--pin', 'companies--scrub');
  }

  function build(force = false) {
    const next: Mode = !env.motionAllowed() ? 'static' : mq.matches ? 'scrub' : 'pin';
    if (next === mode && !force) return;
    const first = mode === null;
    teardown();
    undraw();
    mode = next;
    undraw = drawMarks(root!);
    if (next === 'static') { if (!first) ScrollTrigger.refresh(); return; }

    root!.classList.add('companies--stage', `companies--${next}`);
    clone = copy!.cloneNode(true) as HTMLElement;
    clone.classList.add('companies__copy--clone');
    clone.removeAttribute('data-companies-copy');
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    // the twin is decoration only: no second heading in the accessibility tree
    const h = clone.querySelector('h2');
    if (h) { const d = document.createElement('div'); d.className = h.className; d.innerHTML = h.innerHTML; h.replaceWith(d); }
    photo!.append(clone);

    ctx = gsap.context(() => {
      let W = 1;
      let H = 1;
      const measure = () => { W = stage!.clientWidth || 1; H = stage!.clientHeight || 1; };
      const easeOpen = gsap.parseEase('power2.inOut');
      const pin = next === 'pin';

      const render = (p: number) => {
        // pin: open over the first 72% of the run, then hold full-screen
        const e = easeOpen(gsap.utils.clamp(0, 1, pin ? p / 0.72 : p));
        const w0 = pin ? Math.min(W * 0.25, 380) : W * 0.42;
        const h0 = pin ? Math.min(H * 0.44, 420) : H * 0.34;
        const w = w0 + (W - w0) * e;
        const hh = h0 + (H - h0) * e;
        const t = (H - hh) / 2;
        const s = (W - w) / 2;
        // the leaf: two opposite rounded corners, flattening into a full-bleed rectangle
        const r = Math.min(w, hh) * 0.5 * Math.pow(1 - e, 1.35);
        photo!.style.clipPath = `inset(${t.toFixed(1)}px ${s.toFixed(1)}px ${t.toFixed(1)}px ${s.toFixed(1)}px round ${r.toFixed(1)}px 0 ${r.toFixed(1)}px 0)`;
        media!.style.transform = `scale(${(1.32 - 0.32 * e).toFixed(4)})`;
        if (scrim) scrim.style.opacity = (0.55 + 0.45 * e).toFixed(3);
      };

      measure();
      render(0);
      const proxy = { p: 0 };
      gsap.to(proxy, {
        p: 1,
        ease: 'none',
        onUpdate: () => render(proxy.p),
        scrollTrigger: {
          trigger: banner,
          start: pin ? 'top top' : 'top 72%',
          end: pin ? 'bottom bottom' : 'top 4%',
          scrub: pin ? 0.6 : 0.35,
          invalidateOnRefresh: true,
          onRefresh: () => { measure(); render(proxy.p); },
        },
      });

      // title: lines rise from their masks (original + twin together, pairwise)
      const lines = Array.from(root!.querySelectorAll<HTMLElement>('.companies__line-in'));
      const brows = Array.from(root!.querySelectorAll<HTMLElement>('.companies__eyebrow'));
      gsap.timeline({ scrollTrigger: { trigger: stage, start: pin ? 'top 72%' : 'top 82%', once: true } })
        .from(brows, { opacity: 0, y: 14, duration: 1, ease: 'expo.out' }, 0)
        .from(lines, {
          yPercent: 112, rotate: 1.5, duration: 1.2, ease: 'expo.out',
          stagger: (_i: number, el: HTMLElement) => Number(el.dataset.i || 0) * 0.1,
        }, 0.08);
    }, root!);

    if (!first) ScrollTrigger.refresh();
  }

  build();
  bus.on('motion:change', () => build());
  mq.addEventListener?.('change', () => build());
}
