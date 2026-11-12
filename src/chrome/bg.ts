/* ==========================================================================
   Section background system.
   Sections declare data-bg="cream|sand|soil|moss|season". When a section crosses the
   reading line (55% of the viewport) the page background (--page-bg) and, for dark ones,
   --ink / --ink-soft / --line tween to it (CSS transition .9s on body, base.css).
   "season" sections paint their own colours — the page bg is left as it was.
   Sections without data-bg count as cream. Emits bus 'theme:section' {bg, dark}.
   ========================================================================== */
import { bus } from '../core/bus';
import { qsa } from './util';

const HEX: Record<string, string> = { cream: '#FBF1E6', sand: '#EDE5D4', soil: '#2A2118', moss: '#232E1C' };
const DARK = new Set(['soil', 'moss']);
const root = document.documentElement;
const observed = new WeakSet<Element>();
const active = new Set<HTMLElement>();
let io: IntersectionObserver | null = null;
let current = '';
let meta: HTMLMetaElement | null = null;

export function initBg() {
  meta = document.querySelector('meta[name="theme-color"]');
  // first paint of the right colour without a tween (restored scroll, deep links)
  root.classList.add('bg-instant');
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      if (e.isIntersecting) active.add(el); else active.delete(el);
    }
    pick();
    if (root.classList.contains('bg-instant')) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('bg-instant')));
  }, { rootMargin: '-55% 0px -45% 0px', threshold: 0 });
  scanBg(document);
  if (!document.querySelector('[data-bg]')) { pick(); setTimeout(() => root.classList.remove('bg-instant'), 300); }
  // a11y high-contrast changes the soft ink on dark sections
  bus.on('a11y:change', () => { const c = current; current = ''; if (c) apply(c); });
}

export function scanBg(scope: ParentNode = document) {
  if (!io) return;
  const list = qsa<HTMLElement>('[data-bg]', scope);
  if (scope instanceof HTMLElement && scope.matches('[data-bg]')) list.unshift(scope);
  for (const el of list) {
    if (observed.has(el)) continue;
    observed.add(el);
    io.observe(el);
  }
}

function pick() {
  // the deepest / last section on the reading line wins
  let chosen: HTMLElement | null = null;
  for (const el of active) {
    if (!el.isConnected) { active.delete(el); continue; }
    if (!chosen || chosen.contains(el) || (!el.contains(chosen) && chosen.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) chosen = el;
  }
  const bg = chosen ? (chosen.dataset.bg || 'cream') : 'cream';
  if (bg === 'season') { root.dataset.bgSection = 'season'; bus.emit('theme:section', { bg: 'season', dark: null }); return; }
  delete root.dataset.bgSection;
  apply(bg);
}

function apply(bg: string) {
  if (!HEX[bg] || bg === current) return;
  current = bg;
  const dark = DARK.has(bg);
  const s = root.style;
  s.setProperty('--page-bg', `var(--${bg})`);
  if (dark) {
    const hc = root.dataset.a11yContrast === 'high';
    s.setProperty('--ink', 'var(--cream)');
    s.setProperty('--ink-soft', hc ? 'var(--cream)' : 'rgb(var(--cream-rgb) / 0.76)');
    s.setProperty('--line', `rgb(var(--cream-rgb) / ${hc ? 0.4 : 0.16})`);
    s.setProperty('--line-strong', `rgb(var(--cream-rgb) / ${hc ? 0.6 : 0.32})`);
  } else {
    ['--ink', '--ink-soft', '--line', '--line-strong'].forEach((p) => s.removeProperty(p));
  }
  root.dataset.bg = bg;
  root.dataset.theme = dark ? 'dark' : 'light';
  // the mobile browser chrome follows the forest too
  meta?.setAttribute('content', HEX[bg]);
  bus.emit('theme:section', { bg, dark });
}

export function currentBg() { return current || 'cream'; }
