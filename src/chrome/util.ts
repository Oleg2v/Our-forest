/* Small DOM helpers shared by the chrome modules. */

export const qs = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export const qsa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'summary', '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusables(root: HTMLElement): HTMLElement[] {
  return qsa<HTMLElement>(FOCUSABLE, root).filter((el) => {
    if (el.closest('[inert],[hidden]')) return false;
    if (el instanceof HTMLInputElement && el.type === 'radio' && !el.checked) {
      // only the checked radio of a group is in the tab order
      const group = root.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
      if (Array.from(group).some((r) => r.checked)) return false;
    }
    return el.getClientRects().length > 0;
  });
}

/**
 * Modal behaviour for a dialog element: everything else becomes inert (so screen readers and
 * Tab stay inside), Tab wraps, Esc closes. Returns a release() that restores everything.
 */
export function makeModal(dialog: HTMLElement, opts: { onEscape: () => void; keep?: Element[] }): () => void {
  const keep = new Set<Element>([dialog, ...(opts.keep ?? [])]);
  const touched: HTMLElement[] = [];
  // inert every top-level sibling branch that does not contain the dialog
  let node: HTMLElement | null = dialog;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    for (const sib of Array.from(parent.children) as HTMLElement[]) {
      if (sib === node || keep.has(sib) || sib.tagName === 'SCRIPT' || sib.inert) continue;
      if ([...keep].some((k) => sib.contains(k))) continue;
      sib.inert = true; touched.push(sib);
    }
    node = parent;
  }
  const entry: ModalEntry = { dialog, onEscape: opts.onEscape };
  stack.push(entry);
  if (stack.length === 1) document.addEventListener('keydown', onModalKey, true);
  return () => {
    const i = stack.indexOf(entry);
    if (i > -1) stack.splice(i, 1);
    if (!stack.length) document.removeEventListener('keydown', onModalKey, true);
    touched.forEach((el) => { el.inert = false; });
  };
}

/* one key handler for all modals: only the topmost (a11y panel over the menu) reacts */
interface ModalEntry { dialog: HTMLElement; onEscape: () => void }
const stack: ModalEntry[] = [];
function onModalKey(e: KeyboardEvent) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); top.onEscape(); return; }
  if (e.key !== 'Tab') return;
  const list = focusables(top.dialog);
  if (!list.length) { e.preventDefault(); return; }
  const first = list[0], last = list[list.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey && (active === first || !top.dialog.contains(active))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (active === last || !top.dialog.contains(active))) { e.preventDefault(); first.focus(); }
}

/* ---------------------------------------------------------------- colour */
export function parseRGB(str: string): [number, number, number, number] | null {
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v)));
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

export function luminance([r, g, b]: [number, number, number, number] | number[]): number {
  const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const DARK_BG = new Set(['soil', 'moss']);
const pageBg = () => {
  const r = document.documentElement.dataset;
  return r.bgSection === 'season' ? 'season' : (r.bg || 'cream');
};
/** Is the background behind (x, y) dark? Looks at data-header/data-tone hints, media and painted backgrounds.
 *  Walking down the stack: a box with its own solid colour decides by that colour — also inside a hinted
 *  section (the cream form panel in the moss /business form section: the focus ring turns fruit there);
 *  media inside a hinted section, or the section itself, take the hint (the tree's WebGL stage). */
export function isDarkAt(x: number, y: number, skip: (el: Element) => boolean): boolean {
  const stack = document.elementsFromPoint(Math.round(x), Math.round(y));
  const isMedia = (el: Element) => el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement || el.tagName === 'PICTURE';
  let hint: boolean | null = null;
  for (const el of stack) {
    if (skip(el)) continue;
    if (el === document.documentElement || el === document.body) break;
    const own = parseRGB(getComputedStyle(el).backgroundColor);
    const solid = !!own && own[3] > 0.5;
    const hinted = (el as HTMLElement).closest?.('[data-header]:not(.site-header),[data-tone-hint]') as HTMLElement | null;
    // a transparent [data-bg] section shows the page background: its hint only counts while the page
    // actually wears that section's colour (e.g. the bottom of a soil section after the page turned cream)
    if (hinted && !(hinted.dataset.bg && hinted.dataset.bg !== pageBg())) {
      const v = hinted.dataset.header || hinted.dataset.toneHint;
      hint = v === 'light' ? true : v === 'dark' ? false : null; // light chrome = the section is dark
      if (hint !== null) {
        if (hinted === el || isMedia(el)) return hint;
        if (solid) return luminance(own!) < 0.22;
        continue; // a transparent box inside the section: look further down
      }
    }
    if (isMedia(el)) return true;
    if (solid) return luminance(own!) < 0.22;
  }
  if (hint !== null) return hint;
  // transparent all the way down → the page background (target theme, not a mid-tween colour)
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === 'dark';
  return DARK_BG.has(document.documentElement.dataset.bg ?? '');
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const raf = (fn: () => void) => requestAnimationFrame(fn);
