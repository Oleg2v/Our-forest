/* A modal sheet (bottom sheet on phones, centred paper card on desktop):
   role=dialog, focus trap, Esc, scroll lock, bus 'modal:open|close' (hides the phone bar). */
import { gsap } from '../../core/gsap';
import { bus } from '../../core/bus';
import { env } from '../../core/env';
import { lockScroll, unlockScroll } from '../../core/scroll';
import { icon } from './icons';
import { el } from './ctx';

export interface SheetHandle { root: HTMLElement; body: HTMLElement; close(): void; onClose(fn: () => void): void }

let openCount = 0;

export function openSheet(opts: { title: string; eyebrow?: string; cls?: string; html: string; label?: string }): SheetHandle {
  const id = `tsheet-${Math.random().toString(36).slice(2, 8)}`;
  const root = el(`
    <div class="tsheet ${opts.cls ?? ''}" role="dialog" aria-modal="true" aria-labelledby="${id}-t">
      <div class="tsheet__scrim" data-close></div>
      <div class="tsheet__panel" data-lenis-prevent>
        <div class="tsheet__grip" aria-hidden="true"></div>
        <header class="tsheet__head">
          ${opts.eyebrow ? `<p class="tsheet__eyebrow">${opts.eyebrow}</p>` : ''}
          <h2 class="tsheet__title" id="${id}-t">${opts.title}</h2>
          <button class="tsheet__x" type="button" data-close aria-label="סגירה">${icon('close')}</button>
        </header>
        <div class="tsheet__body">${opts.html}</div>
      </div>
    </div>`);
  document.body.appendChild(root);
  const panel = root.querySelector<HTMLElement>('.tsheet__panel')!;
  const body = root.querySelector<HTMLElement>('.tsheet__body')!;
  const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const closers: (() => void)[] = [];
  const motion = env.motionAllowed();
  // inert background
  const main = document.querySelectorAll<HTMLElement>('body > *:not(.tsheet)');
  const wasInert = new Map<HTMLElement, boolean>();
  main.forEach((n) => { wasInert.set(n, n.inert); n.inert = true; });
  lockScroll();
  if (openCount++ === 0) bus.emit('modal:open');
  const mobile = env.isMobile();
  if (motion) {
    gsap.fromTo(root.querySelector('.tsheet__scrim'), { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(panel, mobile ? { yPercent: 100 } : { opacity: 0, y: 30 }, mobile ? { yPercent: 0, duration: 0.7, ease: 'expo.out' } : { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' });
  }
  const focusables = () => [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  root.addEventListener('keydown', onKey);
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close()));
  // swipe down to close (phones)
  let y0 = -1;
  const grip = root.querySelector<HTMLElement>('.tsheet__grip')!;
  grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointerup', (e) => { if (y0 >= 0 && e.clientY - y0 > 60) close(); y0 = -1; });
  requestAnimationFrame(() => (focusables()[1] ?? focusables()[0])?.focus({ preventScroll: true }));
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    root.removeEventListener('keydown', onKey);
    const fin = () => {
      root.remove();
      main.forEach((n) => { n.inert = wasInert.get(n) ?? false; });
      unlockScroll();
      if (--openCount === 0) bus.emit('modal:close');
      prev?.focus({ preventScroll: true });
      closers.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    };
    if (!motion) { fin(); return; }
    gsap.to(root.querySelector('.tsheet__scrim'), { opacity: 0, duration: 0.35 });
    gsap.to(panel, mobile ? { yPercent: 100, duration: 0.45, ease: 'power3.in', onComplete: fin } : { opacity: 0, y: 20, duration: 0.35, ease: 'power2.in', onComplete: fin });
  }
  return { root, body, close, onClose: (fn) => closers.push(fn) };
}
