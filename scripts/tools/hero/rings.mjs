// Generates the tree-ring SVG paths for partials/home/preloader.html (deterministic, seeded).
// usage: node rings.mjs > rings.svg.txt
let seed = 427;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const R = 168;            // outer growth ring radius (viewBox -200..200)
const pith = [-7, 9];
const drift = [9, -12];   // eccentric growth: later rings shift this way (thicker on one side)
// ring widths (years): mostly even, a few narrow "dry years"
const widths = [12, 13, 15, 12, 14, 7, 11, 13, 9, 7, 12, 10, 9, 11];
const sumW = widths.reduce((a, b) => a + b, 0);
const radii = []; let acc = 0;
for (const w of widths) { acc += w; radii.push((acc / sumW) * R); }
// shared low-frequency shape (all rings follow the same lobes, more so outward)
const shared = [
  { k: 1, a: 0.035, p: rnd() * 6.28 },
  { k: 2, a: 0.045, p: rnd() * 6.28 },
  { k: 3, a: 0.022, p: rnd() * 6.28 },
  { k: 5, a: 0.008, p: rnd() * 6.28 },
];
const f = (n) => n.toFixed(1);

function ringPoints(r, i, total, extra = []) {
  const t = r / R;
  const own = [
    { k: 4 + Math.floor(rnd() * 4), a: (0.5 + rnd() * 0.7) * Math.min(1, r / 60) / Math.max(r, 1), p: rnd() * 6.28 },
    { k: 8 + Math.floor(rnd() * 5), a: (0.25 + rnd() * 0.4) * Math.min(1, r / 60) / Math.max(r, 1), p: rnd() * 6.28 },
    ...extra,
  ];
  const cx = pith[0] + drift[0] * t * t, cy = pith[1] + drift[1] * t * t;
  const n = Math.max(20, Math.round(16 + r * 0.2));
  const start = rnd() * Math.PI * 2;
  const pts = [];
  for (let j = 0; j < n; j++) {
    const th = start + (j / n) * Math.PI * 2;
    let d = 1;
    for (const s of shared) d += s.a * Math.min(1, t * 1.4) * Math.sin(s.k * th + s.p);
    for (const s of own) d += s.a * Math.sin(s.k * th + s.p);
    // RTL-friendly: draw counter-clockwise visually for the even rings, clockwise for odd — subtle variety
    pts.push([cx + Math.cos(th) * r * d, cy + Math.sin(th) * r * d]);
  }
  if (i % 2) pts.reverse();
  return pts;
}
function closedPath(pts) {
  const n = pts.length; let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

const out = [];
radii.forEach((r, i) => {
  const late = i % 3 === 2; // a few darker latewood lines
  out.push({ d: closedPath(ringPoints(r, i, radii.length)), cls: late ? 'pl-r pl-r--late' : 'pl-r', r });
});
// cambium + bark: bumpier, a bit wider
const barkIn = closedPath(ringPoints(R + 7, 1, 0, [{ k: 13, a: 0.009, p: 1.2 }, { k: 19, a: 0.006, p: 0.4 }]));
const barkOut = closedPath(ringPoints(R + 15, 0, 0, [{ k: 11, a: 0.014, p: 2.1 }, { k: 17, a: 0.01, p: 0.9 }, { k: 27, a: 0.006, p: 2.7 }]));
// a radial drying check from the bark inwards
const th = -1.02; const crack = [];
for (let j = 0; j <= 9; j++) {
  const r = R + 11 - j * (R * 0.42) / 9;
  const wob = (rnd() - 0.5) * 0.035;
  let d = 1; for (const s of shared) d += s.a * Math.min(1, (r / R) * 1.4) * Math.sin(s.k * (th + wob) + s.p);
  const t = r / R, cx = pith[0] + drift[0] * t * t, cy = pith[1] + drift[1] * t * t;
  crack.push([cx + Math.cos(th + wob) * r * d, cy + Math.sin(th + wob) * r * d]);
}
const crackD = 'M' + crack.map((p) => `${f(p[0])} ${f(p[1])}`).join('L');

let svg = '';
out.forEach((o, i) => { svg += `<path class="${o.cls}" style="--i:${i};--s:${(o.r / R).toFixed(2)}" pathLength="1" d="${o.d}"/>\n`; });
svg += `<path class="pl-r pl-r--cambium" style="--i:${out.length};--s:1.04" pathLength="1" d="${barkIn}"/>\n`;
svg += `<path class="pl-r pl-r--bark" style="--i:${out.length + 1};--s:1.09" pathLength="1" d="${barkOut}"/>\n`;
svg += `<path class="pl-r pl-r--crack" style="--i:${out.length + 1};--s:.6" pathLength="1" d="${crackD}"/>\n`;
svg += `<circle class="pl-pith" cx="${pith[0]}" cy="${pith[1]}" r="2.2"/>\n`;
process.stdout.write(svg);
console.error('rings', out.length, 'bytes', svg.length);
