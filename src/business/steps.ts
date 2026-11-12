/* "How it works" — the page's one motion idea: a single root grows through the four steps.
   Desktop: the root runs right → left (RTL reading) through the four nodes; phone: one vertical
   root down the node column. The path is generated from the measured layout, so it always meets
   the rings; it is drawn by scroll (scrub), each node lights when the tip reaches it (ring + halo,
   icon draws itself, the words rise once). Reduced motion: drawn and lit, nothing moves. */
import { gsap, ScrollTrigger } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { sound } from '../core/sound';
import { qs, qsa, onResize, smoothPath, rng } from '../static/util';

const NS = 'http://www.w3.org/2000/svg';

interface Node { item: HTMLElement; node: HTMLElement; icon: SVGSVGElement | null; at: number; lit: boolean; tl: gsap.core.Timeline | null }

export function initSteps() {
  const section = qs<HTMLElement>('.biz-steps');
  const stage = qs<HTMLElement>('[data-steps]');
  const svg = qs<SVGSVGElement>('[data-steps-svg]');
  const line = qs<SVGPathElement>('[data-steps-line]');
  const ghost = qs<SVGPathElement>('[data-steps-ghost]');
  const rootletsG = qs<SVGGElement>('[data-steps-rootlets]');
  if (!section || !stage || !svg || !line || !ghost || !rootletsG) return;

  const nodes: Node[] = qsa<HTMLElement>('[data-step]', stage).map((item) => ({
    item,
    node: item.querySelector<HTMLElement>('.biz-steps__node')!,
    icon: item.querySelector<SVGSVGElement>('.biz-steps__icon'),
    at: 0, lit: false, tl: null,
  }));
  let length = 1;
  let rootlets: { el: SVGPathElement; at: number; len: number }[] = [];
  let tip: SVGCircleElement | null = null;
  let st: ScrollTrigger | null = null;
  let live = false;

  /* ------------------------------------------------------------ geometry */
  function layout() {
    const sr = stage!.getBoundingClientRect();
    if (!sr.width) return;
    svg!.setAttribute('viewBox', `0 0 ${sr.width.toFixed(1)} ${sr.height.toFixed(1)}`);
    const centers = nodes.map((n) => {
      const r = n.node.getBoundingClientRect();
      return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top };
    });
    const vertical = centers.length > 1 && Math.abs(centers[1].y - centers[0].y) > Math.abs(centers[1].x - centers[0].x);
    const R = nodes[0].node.offsetWidth / 2;
    const rand = rng(46);
    const pts: { x: number; y: number }[] = [];

    if (vertical) {
      // a short lead-in above the first node, a gentle S between nodes, out below the last one
      const x0 = centers[0].x;
      pts.push({ x: x0 + 6, y: Math.max(-20, centers[0].y - R - 34) });
      centers.forEach((c, i) => {
        pts.push(c);
        const next = centers[i + 1];
        if (next) pts.push({ x: c.x + (i % 2 ? 7 : -7), y: (c.y + next.y) / 2 });
      });
      const last = centers[centers.length - 1];
      pts.push({ x: last.x + 6, y: last.y + R + 44 });
    } else {
      // in from the right edge of the screen, dipping between the nodes, out to the left and down
      const edge = window.innerWidth - sr.right;
      pts.push({ x: sr.width + edge + 30, y: centers[0].y - 46 }, { x: centers[0].x + R + 64, y: centers[0].y - 10 });
      centers.forEach((c, i) => {
        pts.push(c);
        const next = centers[i + 1];
        if (next) pts.push({ x: (c.x + next.x) / 2 + (rand() - 0.5) * 30, y: c.y + (i % 2 ? 6 : 20) + (rand() - 0.5) * 6 });
      });
      const last = centers[centers.length - 1];
      pts.push({ x: last.x - R - 70, y: last.y + 22 }, { x: -sr.left - 30, y: last.y + 70 });
    }

    const d = smoothPath(pts, 0.55);
    line!.setAttribute('d', d);
    ghost!.setAttribute('d', d);
    length = line!.getTotalLength() || 1;

    // where along the root each node sits
    nodes.forEach((n, i) => { n.at = nearestAt(centers[i]); });

    // rootlets: short, thin side roots that fork off between the nodes
    rootletsG!.replaceChildren();
    rootlets = [];
    const count = vertical ? 8 : 13;
    for (let k = 0; k < count; k++) {
      const at = 0.05 + (k / count) * 0.92 + (rand() - 0.5) * 0.035;
      // keep clear of the rings
      if (nodes.some((n) => Math.abs(n.at - at) * length < R + 16)) continue;
      const p = line!.getPointAtLength(at * length);
      const p2 = line!.getPointAtLength(Math.min(length, at * length + 2));
      const ang = Math.atan2(p2.y - p.y, p2.x - p.x);
      let dir: number;
      if (vertical) {
        // towards the screen edge only (the words are on the other side)
        dir = ang - (0.75 + rand() * 0.45);
      } else {
        // hang into the soil below the line
        const a1 = ang + (0.6 + rand() * 0.6), a2 = ang - (0.6 + rand() * 0.6);
        dir = Math.sin(a1) > Math.sin(a2) ? a1 : a2;
      }
      const len = vertical ? 12 + rand() * 14 : 26 + rand() * 46;
      const bend = (rand() - 0.5) * 0.7;
      const q = { x: p.x + Math.cos(dir) * len * 0.5, y: p.y + Math.sin(dir) * len * 0.5 };
      const e = { x: p.x + Math.cos(dir + bend) * len, y: p.y + Math.sin(dir + bend) * len };
      let d2 = `M${p.x.toFixed(1)} ${p.y.toFixed(1)}Q${q.x.toFixed(1)} ${q.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
      // a fork on the longer ones
      if (!vertical && len > 48) {
        const fd = dir + bend + (rand() > 0.5 ? 0.6 : -0.6);
        const fl = len * 0.35;
        d2 += `M${q.x.toFixed(1)} ${q.y.toFixed(1)}l${(Math.cos(fd) * fl).toFixed(1)} ${(Math.sin(fd) * fl).toFixed(1)}`;
      }
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('class', 'biz-steps__rootlet');
      path.setAttribute('d', d2);
      rootletsG!.append(path);
      rootlets.push({ el: path, at, len: path.getTotalLength() || 1 });
    }
    tip = document.createElementNS(NS, 'circle');
    tip.setAttribute('class', 'biz-steps__tip');
    tip.setAttribute('r', '2.6');
    tip.style.opacity = '0';
    rootletsG!.append(tip);
  }

  function nearestAt(c: { x: number; y: number }) {
    let best = 0, bestD = Infinity;
    const steps = 160;
    for (let s = 0; s <= steps; s++) {
      const p = line!.getPointAtLength((s / steps) * length);
      const dd = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      if (dd < bestD) { bestD = dd; best = s / steps; }
    }
    // refine
    for (let s = -10; s <= 10; s++) {
      const a = Math.min(1, Math.max(0, best + s / (steps * 10)));
      const p = line!.getPointAtLength(a * length);
      const dd = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      if (dd < bestD) { bestD = dd; best = a; }
    }
    return best;
  }

  /* ------------------------------------------------------------ drawing */
  function draw(p: number) {
    line!.style.strokeDasharray = `${length} ${length}`;
    line!.style.strokeDashoffset = `${length * (1 - p)}`;
    rootlets.forEach((r) => {
      const local = Math.min(1, Math.max(0, (p - r.at) / 0.07));
      r.el.style.strokeDasharray = `${r.len} ${r.len}`;
      r.el.style.strokeDashoffset = `${r.len * (1 - local)}`;
    });
    if (tip) {
      const pt = line!.getPointAtLength(p * length);
      tip.setAttribute('cx', pt.x.toFixed(1));
      tip.setAttribute('cy', pt.y.toFixed(1));
      tip.style.opacity = p > 0.003 && p < 0.997 ? '1' : '0';
    }
    nodes.forEach((n, i) => {
      const on = p >= n.at - 0.004;
      if (on === n.lit) return;
      n.lit = on;
      n.item.classList.toggle('is-lit', on);
      if (on) {
        n.item.classList.add('is-seen');
        n.tl?.play();
        if (live) sound.play('pop', { volume: 0.22, rate: 1 + i * 0.06 });
      } else n.tl?.reverse();
    });
  }

  function buildNodeTimelines() {
    nodes.forEach((n) => {
      n.tl?.kill();
      const paths = n.icon ? Array.from(n.icon.querySelectorAll('path, rect, circle')) : [];
      const tl = gsap.timeline({ paused: true });
      if (paths.length) tl.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.1, ease: 'power2.out', stagger: 0.08 }, 0.05);
      n.tl = tl;
    });
  }

  function staticState() {
    live = false;
    section!.removeAttribute('data-live');
    line!.style.strokeDasharray = '';
    line!.style.strokeDashoffset = '';
    rootlets.forEach((r) => { r.el.style.strokeDasharray = ''; r.el.style.strokeDashoffset = ''; });
    if (tip) tip.style.opacity = '0';
    nodes.forEach((n) => {
      n.tl?.kill(); n.tl = null;
      n.lit = true;
      n.item.classList.add('is-lit', 'is-seen');
      n.icon?.querySelectorAll('path, rect, circle').forEach((p) => gsap.set(p, { clearProps: 'all' }));
    });
  }

  function start() {
    st?.kill();
    if (!env.motionAllowed()) { staticState(); return; }
    section!.setAttribute('data-live', '');
    nodes.forEach((n) => { n.lit = false; n.item.classList.remove('is-lit'); });
    buildNodeTimelines();
    live = false;
    const vertical = env.isMobile();
    st = ScrollTrigger.create({
      trigger: stage!,
      start: vertical ? 'top 72%' : 'top 82%',
      end: vertical ? 'bottom 72%' : 'bottom 38%',
      scrub: vertical ? 0.4 : 0.9,
      onUpdate: (self) => draw(self.progress),
      onRefresh: (self) => draw(self.progress),
    });
    draw(st.progress);
    requestAnimationFrame(() => { live = true; });
  }

  layout();
  start();
  let lastMobile = env.isMobile();
  onResize(() => {
    layout();
    if (env.isMobile() !== lastMobile) { lastMobile = env.isMobile(); start(); }
    else if (st) draw(st.progress);
    ScrollTrigger.refresh();
  });
  // web fonts change line breaks → node positions
  document.fonts?.ready.then(() => { layout(); if (st) draw(st.progress); });
  bus.on('motion:change', () => { layout(); start(); });
}
