/* Line-art for the three packages (same stroke language as the icons: 1.5, round, no fill).
   Every stroke has pathLength="1" and a --d delay, so a single class draws the whole picture.
   grove   — 18 trees in three rows + the company sign
   teamday — a team standing around one sapling
   holiday — a row of saplings, a name tag on each */
import { rng } from '../static/util';

const NS = 'http://www.w3.org/2000/svg';
type Attrs = Record<string, string | number>;

function el(tag: string, attrs: Attrs, delay: number, s: 'olive' | 'soft' | 'ink' = 'olive', fill = false) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  n.setAttribute('data-s', s === 'olive' ? '' : s);
  n.setAttribute('pathLength', '1');
  if (fill) n.setAttribute('data-fill', '');
  n.setAttribute('style', `--d:${delay.toFixed(2)}s`);
  return n;
}

function ground(svg: SVGSVGElement, y: number, delay = 0, w = 260) {
  svg.append(el('path', { d: `M6 ${y}C${w * 0.3} ${y - 4} ${w * 0.62} ${y + 3} ${w - 6} ${y - 1}` }, delay, 'ink'));
}

function grove(svg: SVGSVGElement) {
  const r = rng(18);
  ground(svg, 104, 0);
  // back → front so front crowns cover the trunks behind them
  const rows = [
    { y: 34, rad: 7.5, x0: 44, trunk: 7 },
    { y: 56, rad: 8.5, x0: 27, trunk: 8 },
    { y: 80, rad: 9.5, x0: 44, trunk: 10 },
  ];
  let i = 0;
  rows.forEach((row, ri) => {
    for (let c = 0; c < 6; c++) {
      const x = row.x0 + c * 34 + (r() - 0.5) * 3;
      const rad = row.rad + (r() - 0.5) * 1.2;
      const d = 0.15 + (2 - ri) * 0.05 + i * 0.045;
      svg.append(el('path', { d: `M${x} ${row.y + rad - 0.5}V${row.y + rad + row.trunk}` }, d + 0.2, 'ink'));
      svg.append(el('circle', { cx: x, cy: row.y, r: rad }, d, 'olive', true));
      i++;
    }
  });
  // the sign with the company name (reading start = right)
  const sx = 238, sy = 70;
  svg.append(el('path', { d: `M${sx} ${sy + 14}V${103}` }, 1.1, 'ink'));
  svg.append(el('rect', { x: sx - 15, y: sy, width: 30, height: 16, rx: 3 }, 1.0, 'ink', true));
  svg.append(el('path', { d: `M${sx - 8} ${sy + 6}h16M${sx - 5} ${sy + 10.5}h10` }, 1.3, 'soft'));
}

function teamday(svg: SVGSVGElement) {
  ground(svg, 104, 0);
  // the sapling in the middle
  const cx = 130;
  svg.append(el('path', { d: `M${cx} 103V62` }, 0.2));
  svg.append(el('path', { d: `M${cx} 74c0-11 6-17.5 17-18.5 0 11-6 17.5-17 18.5Z` }, 0.45));
  svg.append(el('path', { d: `M${cx} 84c0-8.5-5-13.5-13.5-14 0 8.5 5 13.5 13.5 14Z` }, 0.55));
  svg.append(el('path', { d: `M${cx - 22} 104c6-5 38-5 44 0` }, 0.35, 'soft'));
  // people: head + shoulders, a little uneven, facing the tree
  const people = [
    { x: 30, hy: 50 }, { x: 62, hy: 44 }, { x: 94, hy: 54 },
    { x: 166, hy: 52 }, { x: 198, hy: 42 }, { x: 230, hy: 50 },
  ];
  people.forEach((p, i) => {
    const d = 0.3 + i * 0.12;
    const w = 12.5;
    svg.append(el('circle', { cx: p.x, cy: p.hy, r: 7 }, d));
    svg.append(el('path', { d: `M${p.x - w} 103V${p.hy + 26}a${w} ${w} 0 0 1 ${w * 2} 0V103` }, d + 0.1));
  });
}

function holiday(svg: SVGSVGElement) {
  const r = rng(180);
  ground(svg, 104, 0);
  const xs = [36, 83, 130, 177, 224];
  xs.forEach((x, i) => {
    const top = 50 + Math.round(r() * 14);
    const d = 0.15 + i * 0.14;
    svg.append(el('path', { d: `M${x - 16} 104c5-5 27-5 32 0` }, d, 'soft'));
    svg.append(el('path', { d: `M${x} 103V${top}` }, d + 0.1));
    svg.append(el('path', { d: `M${x} ${top + 10}c0-9 5-14 14-15 0 9-5 14-14 15Z` }, d + 0.3));
    svg.append(el('path', { d: `M${x} ${top + 19}c0-7-4-11-11-11.5 0 7 4 11 11 11.5Z` }, d + 0.38));
    // name tag on a short string
    const ty = top + 26;
    svg.append(el('path', { d: `M${x} ${ty - 2}l-6 5` }, d + 0.5, 'ink'));
    svg.append(el('rect', { x: x - 20, y: ty + 2, width: 15, height: 10, rx: 2 }, d + 0.55, 'ink', true));
    svg.append(el('path', { d: `M${x - 16} ${ty + 7}h7` }, d + 0.7, 'soft'));
  });
}

const ARTS: Record<string, (svg: SVGSVGElement) => void> = { grove, teamday, holiday };

export function buildArt(root: ParentNode = document) {
  root.querySelectorAll<SVGSVGElement>('svg[data-art]').forEach((svg) => {
    if (svg.childElementCount) return;
    ARTS[svg.dataset.art || '']?.(svg);
  });
}

/** Draw each picture when its card comes into view (CSS transitions; reduced motion shows it drawn). */
export function drawArtOnView(root: ParentNode = document) {
  const svgs = Array.from(root.querySelectorAll<SVGSVGElement>('svg[data-art]'));
  if (!('IntersectionObserver' in window)) { svgs.forEach((s) => s.classList.add('is-drawn')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-drawn');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.35 });
  svgs.forEach((s) => io.observe(s));
}
