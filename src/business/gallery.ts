/* Gallery "יום ביער": a calm horizontal drift tied to the page scroll (desktop + motion).
   RTL: the strip starts at the right edge and the camera travels right → left (the strip moves
   right to reveal what lies to its left). Photos sit a little deeper inside their leaves and drift
   against the strip (depth). Phones: native swipe with snap + a progress line.
   Reduced motion on wide screens: the photos wrap into calm rows, all visible.
   Wide screens (≥ 769 × 561): the section holds still while the strip drifts. Unpinned, the drift could only end
   as the strip left the screen (at 1768×900 photo 06 was never seen whole, 05 only in its upper half), and
   finishing it with the strip in view would have needed 2–6 px of travel per px of scroll. Pinned, the strip
   rests in view, the drift runs at ~1 px per px of scroll, and it ends with the last photo whole on screen.
   Landscape phones (short, wide) keep the unpinned drift as it was. */
import { gsap, ScrollTrigger } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { qs, qsa } from '../static/util';

/** the same "wide screen" as the site's desktop rules: tablets, laptops, monitors — not landscape phones */
const wideMQ = matchMedia('(min-width: 769px) and (min-height: 561px)');
/** pinned run: a short rest as the strip arrives, the drift, a rest on the last photo before the page moves on */
const HOLD_IN = 0.04;
const HOLD_OUT = 0.1;

export function initGallery() {
  const section = qs<HTMLElement>('.biz-gal');
  const viewport = qs<HTMLElement>('[data-gal]')!;
  const track = qs<HTMLElement>('[data-gal-track]');
  const bar = qs<HTMLElement>('[data-gal-bar]');
  const head = section?.querySelector<HTMLElement>('.biz-head') ?? null;
  const progress = section?.querySelector<HTMLElement>('.biz-gal__progress') ?? null;
  if (!section || !viewport || !track) return;
  const inners = qsa<HTMLElement>('[data-gal-inner]', track);

  let ctx: gsap.Context | null = null;
  let mode: 'pin' | 'drift' | 'swipe' | 'rows' | '' = '';

  const setBar = (p: number) => { if (bar) bar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, p))})`; };
  const onNativeScroll = () => {
    const max = viewport.scrollWidth - viewport.clientWidth;
    setBar(max > 0 ? Math.abs(viewport.scrollLeft) / max : 1);
  };
  const modeFor = () => (env.isMobile() ? 'swipe' : !env.motionAllowed() ? 'rows' : wideMQ.matches ? 'pin' : 'drift');

  /** where the strip's top rests while pinned (px from the top of the screen), measured on refresh. The block from
   *  the section's title to the progress line is centred when it fits with ≥ 32 px to spare; otherwise the strip and
   *  its progress line are centred with the title just above the screen — never half a title cut by the top edge */
  const restTop = () => {
    const vh = window.innerHeight;
    const s = viewport.getBoundingClientRect();
    const h = head ? head.getBoundingClientRect() : s;
    const pr = progress ? progress.getBoundingClientRect() : s;
    const headTop = h.top - s.top;          // ≤ 0: the title block sits above the strip
    const gap = s.top - h.bottom;           // title block → strip
    const below = pr.bottom - s.top;        // strip top → progress line bottom
    const full = below - headTop;
    if (full <= vh - 64) return Math.round((vh - full) / 2 - headTop);
    return Math.round(Math.max(16, Math.min((vh - below) / 2, gap)));
  };

  function build() {
    const next = modeFor();
    if (next === mode) return;
    ctx?.revert(); ctx = null;
    viewport.removeEventListener('scroll', onNativeScroll);
    section!.classList.toggle('biz-gal--rows', next === 'rows');
    // compositor layers (will-change) only while the drift moves the strip — not on the phone's swipe strip
    section!.classList.toggle('biz-gal--drift', next === 'drift' || next === 'pin');
    mode = next;
    if (next === 'swipe') {
      viewport.addEventListener('scroll', onNativeScroll, { passive: true });
      onNativeScroll();
      return;
    }
    if (next === 'rows') { setBar(1); return; }
    ctx = gsap.context(() => {
      const dist = () => Math.max(0, track!.scrollWidth - viewport!.clientWidth);
      if (next === 'pin') {
        // ~1 px of travel per px of scroll (never shorter than one screen), plus the two rests
        const run = () => Math.max(dist(), window.innerHeight) * (1 + HOLD_IN + HOLD_OUT);
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: viewport,
            start: () => `top ${restTop()}px`,
            end: () => `+=${run()}`,
            pin: section,
            scrub: 1.1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => setBar((self.progress * (1 + HOLD_IN + HOLD_OUT) - HOLD_IN)),
          },
        });
        tl.to({}, { duration: HOLD_IN })
          .fromTo(track, { x: 0 }, { x: () => dist(), duration: 1 })
          .to({}, { duration: HOLD_OUT });
        // the photos drift inside their leaves over the whole pass: in, the pinned run, out
        inners.forEach((el) => {
          gsap.fromTo(el, { xPercent: -4 }, {
            xPercent: 4, ease: 'none',
            scrollTrigger: {
              trigger: section, start: 'top bottom', scrub: true, invalidateOnRefresh: true,
              end: () => `+=${window.innerHeight + section!.offsetHeight + run()}`,
            },
          });
        });
        return;
      }
      gsap.fromTo(track, { x: 0 }, {
        x: () => dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 40%',
          end: 'bottom 12%',
          scrub: 1.1,
          invalidateOnRefresh: true,
          onUpdate: (self) => setBar(self.progress),
        },
      });
      inners.forEach((el) => {
        gsap.fromTo(el, { xPercent: -4 }, {
          xPercent: 4, ease: 'none',
          scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
    });
    // the pin adds its run to the page: triggers further down (FAQ, form, footer — some created before this one)
    // must be measured after it, so refresh in page order
    if (next === 'pin') ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }

  build();
  // a mode change only (phone ↔ desktop width, a desktop window made shorter than 561 px): the iOS toolbar's
  // height changes never cross it, and a resize within one mode is ScrollTrigger's own refresh
  window.addEventListener('resize', () => build(), { passive: true });
  bus.on('motion:change', () => { mode = ''; build(); });

  // keyboard: the region is focusable; arrows scroll it natively in swipe/rows modes,
  // in drift mode they nudge the page so the strip follows
  viewport.addEventListener('keydown', (e) => {
    if ((mode !== 'drift' && mode !== 'pin') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    window.scrollBy({ top: e.key === 'ArrowLeft' ? 160 : -160, behavior: env.motionAllowed() ? 'smooth' : 'auto' });
  });
}
