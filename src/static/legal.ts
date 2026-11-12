/* Legal / long-form documents: table of contents as a reading root (scroll-spy + progress),
   desktop opens the TOC, phones keep it folded; print button; the "more documents" list marks
   the current page. Also used by the credits page. */
import './doc.css';
import './todo.css';
import { env } from '../core/env';
import { qs, qsa } from './util';

export function initDoc() {
  const toc = qs<HTMLDetailsElement>('.doc__toc-box');
  const list = qs<HTMLElement>('.doc__toc-list');
  const article = qs<HTMLElement>('.doc__article');

  // the TOC is open on wide screens, folded on phones (no-JS: folded, still usable)
  const wide = window.matchMedia('(min-width: 1001px)');
  const syncToc = () => { if (toc) toc.open = wide.matches; };
  syncToc();
  wide.addEventListener?.('change', syncToc);
  // wide screens: the TOC is a fixed side column, not a toggle
  toc?.querySelector('summary')?.addEventListener('click', (e) => { if (wide.matches) e.preventDefault(); });
  // on phones, picking a section folds the TOC again
  list?.addEventListener('click', (e) => {
    if (!wide.matches && (e.target as Element).closest('a') && toc) toc.open = false;
  });

  // current page in the "more documents" list
  const here = location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
  qsa<HTMLAnchorElement>('.doc__more-list a').forEach((a) => {
    const p = new URL(a.href, location.href).pathname.replace(/\/+$/, '');
    if (p === here) a.setAttribute('aria-current', 'page');
  });

  qsa<HTMLButtonElement>('[data-doc-print]').forEach((b) => b.addEventListener('click', () => window.print()));

  if (!list || !article) return;
  const links = qsa<HTMLAnchorElement>('a[href^="#"]', list);
  const sections = links
    .map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))))
    .filter((s): s is HTMLElement => !!s);
  if (!sections.length) return;

  // The spy reads every section's position and writes the TOC: worth a scroll frame only while the TOC can be seen
  // as a reading root — the sticky side column (wide screens) or an unfolded TOC on a phone; the folded phone TOC
  // catches up when it opens. Writes only on change (a scroll frame usually changes nothing).
  let ticking = false;
  let lastCurrent = -1;
  let lastRead = '';
  const live = () => wide.matches || !!toc?.open;
  const update = () => {
    ticking = false;
    if (!live()) return;
    const line = window.innerHeight * 0.32;
    let current = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) current = i; });
    if (current !== lastCurrent) {
      lastCurrent = current;
      links.forEach((a, i) => a.setAttribute('aria-current', i === current ? 'true' : 'false'));
    }
    const r = article.getBoundingClientRect();
    const read = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height - window.innerHeight * 0.4))).toFixed(3);
    if (read !== lastRead) { lastRead = read; list.style.setProperty('--read', read); }
  };
  const onScroll = () => { if (!ticking && live()) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  toc?.addEventListener('toggle', onScroll);
  update();
  if (!env.motionAllowed()) list.style.setProperty('transition', 'none');
}
