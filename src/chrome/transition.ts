/* ==========================================================================
   Page transitions — a leaf grows from the click point, covers the page in --moss
   and the next page opens through a growing leaf.
   · Leaving (all browsers): GSAP leaf cover from the click point, then navigation
     (a sessionStorage flag carries the moment across).
   · Arriving: the head pre-paint script paints a moss cover from the very first frame
     (html.pt-in). Where cross-document View Transitions exist (Chrome 126+, Safari 18.2+)
     the head script opens the new page with ::view-transition-new(root) clip-path;
     everywhere else this module opens it with an evenodd clip-path "hole".
   Same-origin links only — never anchors on the same page (smooth scrollTo instead),
   new tabs, downloads, modifier clicks or data-no-transition.
   ========================================================================== */
import { gsap, ScrollTrigger } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { sound } from '../core/sound';
import { session } from '../core/storage';
import { scrollTo } from '../core/scroll';
import { closeMenu, isMenuOpen } from './menu';
import { qs } from './util';

const root = document.documentElement;
const w = window as any;
let pt: HTMLElement | null = null;
let leafEl: HTMLElement | null = null;
let mark: SVGElement | null = null;
let leaving = false;
let tl: gsap.core.Timeline | null = null;

const leafPath = (x: number, y: number, s: number) => {
  const r = s / 2, a = x - r, b = y - r, c = x + r, e = y + r;
  return `M${a} ${b + r}A${r} ${r} 0 0 1 ${a + r} ${b}L${c} ${b}L${c} ${e - r}A${r} ${r} 0 0 1 ${c - r} ${e}L${a} ${e}Z`;
};

export function initTransitions() {
  pt = qs('[data-pt]');
  leafEl = pt?.querySelector<HTMLElement>('.pt__leaf') ?? null;
  mark = pt?.querySelector<SVGElement>('.pt__mark') ?? null;
  document.addEventListener('click', onClick);
  window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) restore(); });
  entry();
  deepLink();
}

function onClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.('a') as HTMLAnchorElement | null;
  if (!a || !a.hasAttribute('href')) return;
  if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-no-transition') || /\bexternal\b/.test(a.rel)) return;
  let url: URL;
  try { url = new URL(a.href, location.href); } catch { return; }
  if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
  const norm = (p: string) => p.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
  const samePage = norm(url.pathname) === norm(location.pathname) && url.search === location.search;
  if (samePage) {
    if (url.hash && url.hash.length > 1) {
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (target) { e.preventDefault(); goAnchor(target, url.hash); }
      return;
    }
    e.preventDefault();
    if (isMenuOpen()) closeMenu({ restoreFocus: false });
    scrollTo(0);
    return;
  }
  if (/\.(pdf|zip|png|jpe?g|webp|avif|svg|mp4|webm|ics|vcf)$/i.test(url.pathname)) return;
  e.preventDefault();
  // keyboard activation has no pointer position → grow from the link itself
  let x = e.clientX, y = e.clientY;
  if (e.detail === 0 || (x === 0 && y === 0)) { const r = a.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  navigate(url.href, { x, y });
}

function goAnchor(target: HTMLElement, hash: string) {
  const go = () => {
    scrollTo(target);
    try { history.replaceState(history.state, '', hash); } catch { /* ignore */ }
    if (!target.hasAttribute('tabindex') && !target.matches('a,button,input,select,textarea')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  if (isMenuOpen()) { closeMenu({ restoreFocus: false }); setTimeout(go, env.motionAllowed() ? 420 : 0); }
  else go();
}

/** Navigate with the leaf transition (used by JS-driven navigation, e.g. after "payment"). */
export function navigate(href: string, origin?: { x: number; y: number }) {
  if (leaving) return;
  if (!pt || !leafEl || !env.motionAllowed()) { location.href = href; return; }
  leaving = true;
  bus.emit('page:leave', { href });
  sound.play('whoosh');
  const W = window.innerWidth, H = window.innerHeight;
  const x = origin?.x ?? W / 2, y = origin?.y ?? H / 2;
  const far = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y));
  const S = 2 * far + 24;
  Object.assign(leafEl.style, { width: `${S}px`, height: `${S}px`, left: `${x - S / 2}px`, top: `${y - S / 2}px` });
  pt.classList.add('is-active');
  pt.classList.remove('is-entering');
  tl?.kill();
  let went = false;
  const go = () => {
    if (went) return; went = true;
    session.set('pt', JSON.stringify({ x, y, t: Date.now() }));
    location.href = href;
    // a cancelled navigation (204, download) must never leave the cover on
    setTimeout(() => { if (document.visibilityState === 'visible') restore(); }, 5000);
  };
  tl = gsap.timeline({ onComplete: go })
    .fromTo(leafEl, { scale: 0, rotate: -38 }, { scale: 1, rotate: 0, duration: 0.78, ease: 'power3.inOut' }, 0)
    .fromTo(mark, { opacity: 0, scale: 0.7, rotate: -20 }, { opacity: 1, scale: 1, rotate: 0, duration: 0.4, ease: 'power2.out' }, 0.5);
}

/* ---------------------------------------------------------------- arriving */
function entry() {
  if (w.__ofPTvt || !root.classList.contains('pt-in')) return;
  // a browser with cross-document View Transitions decides at pagereveal — wait for it
  if ('onpagereveal' in window && !w.__ofRevealed) {
    window.addEventListener('pagereveal', () => setTimeout(entry, 0), { once: true });
    setTimeout(() => { if (root.classList.contains('pt-in') && !w.__ofPTvt) { w.__ofRevealed = 1; entry(); } }, 600);
    return;
  }
  if (!pt || !env.motionAllowed()) { root.classList.remove('pt-in'); return; }
  pt.classList.add('is-active', 'is-entering');
  root.classList.remove('pt-in');
  const W = window.innerWidth, H = window.innerHeight;
  const S = Math.hypot(W, H) * 1.03 + 8;
  const st = { s: 1 };
  const draw = () => { pt!.style.clipPath = `path(evenodd, 'M0 0H${W}V${H}H0Z ${leafPath(W / 2, H / 2, st.s)}')`; };
  draw();
  gsap.timeline({
    delay: 0.08,
    onComplete: () => { pt!.classList.remove('is-active', 'is-entering'); pt!.style.removeProperty('clip-path'); },
  })
    .to(mark, { opacity: 0, scale: 0.85, duration: 0.3, ease: 'power1.in' }, 0)
    .to(st, { s: S, duration: 1, ease: 'power3.inOut', onUpdate: draw }, 0.05);
}

function restore() {
  leaving = false;
  tl?.kill(); tl = null;
  pt?.classList.remove('is-active', 'is-entering');
  pt?.style.removeProperty('clip-path');
  if (leafEl) gsap.set(leafEl, { scale: 0 });
  root.classList.remove('pt-in');
  bus.emit('page:restore');
}

/* deep links (/#map from another page): land precisely once pins and fonts have settled */
function deepLink() {
  const hash = location.hash;
  if (!hash || hash.length < 2) return;
  const land = () => {
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    ScrollTrigger.refresh();
    scrollTo(el, { immediate: true });
  };
  if (document.readyState === 'complete') setTimeout(land, 60);
  else window.addEventListener('load', () => setTimeout(land, 60), { once: true });
}
