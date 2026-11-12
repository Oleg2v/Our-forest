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
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); opts.onEscape(); return; }
    if (e.key !== 'Tab') return;
    const list = focusables(dialog);
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0], last = list[list.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !dialog.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !dialog.contains(active))) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey, true);
  return () => {
    document.removeEventListener('keydown', onKey, true);
    touched.forEach((el) => { el.inert = false; });
  };
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
/** Is the background behind (x, y) dark? Looks at data-header/data-tone hints, media and painted backgrounds. */
export function isDarkAt(x: number, y: number, skip: (el: Element) => boolean): boolean {
  const stack = document.elementsFromPoint(Math.round(x), Math.round(y));
  for (const el of stack) {
    if (skip(el)) continue;
    if (el === document.documentElement || el === document.body) break;
    const hinted = (el as HTMLElement).closest?.('[data-header]:not(.site-header),[data-tone-hint]') as HTMLElement | null;
    if (hinted) {
      const v = hinted.dataset.header || hinted.dataset.toneHint;
      if (v === 'light') return true;   // section asks for light chrome (it is dark)
      if (v === 'dark') return false;
    }
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement || el.tagName === 'PICTURE') return true;
    const cs = getComputedStyle(el);
    const c = parseRGB(cs.backgroundColor);
    if (c && c[3] > 0.5) return luminance(c) < 0.22;
    const bgAttr = (el as HTMLElement).dataset?.bg;
    if (bgAttr && bgAttr !== 'season') return DARK_BG.has(bgAttr);
  }
  return document.documentElement.dataset.theme === 'dark';
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const raf = (fn: () => void) => requestAnimationFrame(fn);
