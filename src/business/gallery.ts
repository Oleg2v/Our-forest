/* Gallery "יום ביער": a calm horizontal drift tied to the page scroll (desktop + motion).
   RTL: the strip starts at the right edge and the camera travels right → left (the strip moves
   right to reveal what lies to its left). Photos sit a little deeper inside their leaves and drift
   against the strip (depth). Phones: native swipe with snap + a progress line.
   Reduced motion on wide screens: the photos wrap into calm rows, all visible. */
import { gsap, ScrollTrigger } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { qs, qsa } from '../static/util';

export function initGallery() {
  const section = qs<HTMLElement>('.biz-gal');
  const viewport = qs<HTMLElement>('[data-gal]')!;
  const track = qs<HTMLElement>('[data-gal-track]');
  const bar = qs<HTMLElement>('[data-gal-bar]');
  if (!section || !viewport || !track) return;
  const inners = qsa<HTMLElement>('[data-gal-inner]', track);

  let ctx: gsap.Context | null = null;
  let mode: 'drift' | 'swipe' | 'rows' | '' = '';

  const setBar = (p: number) => { if (bar) bar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, p))})`; };
  const onNativeScroll = () => {
    const max = viewport.scrollWidth - viewport.clientWidth;
    setBar(max > 0 ? Math.abs(viewport.scrollLeft) / max : 1);
  };

  function build() {
    const next = env.isMobile() ? 'swipe' : env.motionAllowed() ? 'drift' : 'rows';
    if (next === mode) return;
    ctx?.revert(); ctx = null;
    viewport.removeEventListener('scroll', onNativeScroll);
    section!.classList.toggle('biz-gal--rows', next === 'rows');
    mode = next;
    if (next === 'swipe') {
      viewport.addEventListener('scroll', onNativeScroll, { passive: true });
      onNativeScroll();
      return;
    }
    if (next === 'rows') { setBar(1); return; }
    ctx = gsap.context(() => {
      const dist = () => Math.max(0, track!.scrollWidth - viewport!.clientWidth);
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
    ScrollTrigger.refresh();
  }

  build();
  let w = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === w) return;
    w = window.innerWidth;
    build();
  }, { passive: true });
  bus.on('motion:change', () => { mode = ''; build(); });

  // keyboard: the region is focusable; arrows scroll it natively in swipe/rows modes,
  // in drift mode they nudge the page so the strip follows
  viewport.addEventListener('keydown', (e) => {
    if (mode !== 'drift' || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    window.scrollBy({ top: e.key === 'ArrowLeft' ? 160 : -160, behavior: env.motionAllowed() ? 'smooth' : 'auto' });
  });
}
