/* ==========================================================================
   Section background system.
   Sections declare data-bg="cream|sand|soil|moss|season". When a section crosses the
   reading line (55% of the viewport) the page background and, for dark ones,
   --ink / --ink-soft / --line tween to it (CSS transition .9s on body, base.css).
   "season" sections paint their own colours — the page bg is left as it was.
   Sections without data-bg count as cream. Emits bus 'theme:section' {bg, dark}.

   Cost (phones): a custom property written on <html> restyles every element of the page
   (≈ 1700 on the home page: 50 ms at 4× CPU). So mid-scroll:
   · the page colour is one non-inherited property (background-color) on <html> and <body>;
   · the ink variables + html[data-theme] change only when the page turns light ↔ dark —
     every text colour changes then, so that one restyle is the effect itself;
   · --page-bg (read by a few hover states / buttons) follows in the same write on a light ↔ dark
     turn, otherwise at the next scroll-quiet moment (cream ↔ sand costs nothing while scrolling).
   ========================================================================== */
import { bus } from '../core/bus';
import { whenScrollQuiet } from '../core/scroll';
import { qsa } from './util';

const HEX: Record<string, string> = { cream: '#FBF1E6', sand: '#EDE5D4', soil: '#2A2118', moss: '#232E1C' };
const DARK = new Set(['soil', 'moss']);
const root = document.documentElement;
const observed = new WeakSet<Element>();
const active = new Set<HTMLElement>();
let io: IntersectionObserver | null = null;
let current = '';
let theme = '';            // 'light' | 'dark' as last written (ink variables + html[data-theme])
let pageVar = 'cream';     // the --page-bg value on <html> (tokens.css default: cream)
let pageVarQueued = false;
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
  bus.on('a11y:change', () => { const c = current; current = ''; theme = ''; if (c) apply(c); });
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
  if (bg === 'season') {
    if (root.dataset.bgSection !== 'season') { root.dataset.bgSection = 'season'; bus.emit('theme:section', { bg: 'season', dark: null }); }
    return;
  }
  if (root.dataset.bgSection) delete root.dataset.bgSection;
  apply(bg);
}

function apply(bg: string) {
  if (!HEX[bg] || bg === current) return;
  current = bg;
  const dark = DARK.has(bg);
  // the page colour: one non-inherited property, no cascade (<body> fades it, <html> paints the overscroll)
  const colour = `var(--${bg})`;
  root.style.backgroundColor = colour;
  document.body.style.backgroundColor = colour;
  const t = dark ? 'dark' : 'light';
  if (t !== theme) {
    // light ↔ dark: every text colour turns — one restyle for all of it (ink + --page-bg + data-theme together)
    theme = t;
    const s = root.style;
    if (dark) {
      const hc = root.dataset.a11yContrast === 'high';
      s.setProperty('--ink', 'var(--cream)');
      s.setProperty('--ink-soft', hc ? 'var(--cream)' : 'rgb(var(--cream-rgb) / 0.76)');
      s.setProperty('--line', `rgb(var(--cream-rgb) / ${hc ? 0.4 : 0.16})`);
      s.setProperty('--line-strong', `rgb(var(--cream-rgb) / ${hc ? 0.6 : 0.32})`);
    } else {
      ['--ink', '--ink-soft', '--line', '--line-strong'].forEach((p) => s.removeProperty(p));
    }
    writePageVar();
    root.dataset.theme = t;
  } else if (bg !== pageVar && !pageVarQueued) {
    pageVarQueued = true;
    whenScrollQuiet(() => { pageVarQueued = false; writePageVar(); });
  }
  if (root.dataset.bg !== bg) root.dataset.bg = bg;
  // the mobile browser chrome follows the forest too
  meta?.setAttribute('content', HEX[bg]);
  bus.emit('theme:section', { bg, dark });
}

/** --page-bg for the few rules that paint "the page colour" (outline-button hover text, the wall's talk button) */
function writePageVar() {
  if (!current || pageVar === current) return;
  pageVar = current;
  root.style.setProperty('--page-bg', `var(--${current})`);
}

export function currentBg() { return current || 'cream'; }
