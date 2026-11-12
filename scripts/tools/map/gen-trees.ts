/* Demo data generator for src/data/trees.json (forest map).
   Run: node --experimental-strip-types gen-trees.ts /home/user/Our-forest
   Deterministic (seeded). Trees stand on curved contour rows (swales) between the paths of PLAN. */
import { writeFileSync } from 'node:fs';
import { PLAN, type Pt } from '../../../src/components/forest-map/plan.ts';

const root = process.argv[2] ?? new URL('../../../', import.meta.url).pathname.replace(//$/, '');

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20260214);
const pick = <T,>(a: readonly T[]) => a[Math.floor(R() * a.length)];
const r1 = (n: number) => Math.round(n * 10) / 10;

/* ---------- rows: quadratic curves from → to, bent by `bend` (perpendicular) ---------- */
type Row = { zone: string; row: number; from: Pt; to: Pt; bend: number; n: number };
const rows: Row[] = [
  // zone 01 — north-west (newest, outer edge)
  { zone: '01', row: 1, from: [196, 160], to: [548, 146], bend: 10, n: 7 },
  { zone: '01', row: 2, from: [132, 222], to: [556, 206], bend: 12, n: 8 },
  { zone: '01', row: 3, from: [126, 282], to: [568, 270], bend: 10, n: 8 },
  { zone: '01', row: 4, from: [124, 340], to: [590, 330], bend: 12, n: 8 },
  // zone 02 — north
  { zone: '02', row: 1, from: [690, 150], to: [1150, 144], bend: -10, n: 8 },
  { zone: '02', row: 2, from: [664, 210], to: [1162, 206], bend: -12, n: 8 },
  { zone: '02', row: 3, from: [676, 268], to: [1166, 264], bend: -10, n: 8 },
  { zone: '02', row: 4, from: [700, 326], to: [1164, 324], bend: -12, n: 8 },
  // zone 03 — west
  { zone: '03', row: 1, from: [122, 466], to: [684, 456], bend: 12, n: 10 },
  { zone: '03', row: 2, from: [118, 526], to: [664, 522], bend: 12, n: 10 },
  { zone: '03', row: 3, from: [120, 588], to: [556, 592], bend: 10, n: 8 },
  // zone 04 — south (the oldest rows, near the gate and the fire)
  { zone: '04', row: 1, from: [944, 700], to: [528, 690], bend: -10, n: 8 },
  { zone: '04', row: 2, from: [1036, 764], to: [424, 752], bend: -12, n: 10 },
  { zone: '04', row: 3, from: [1098, 826], to: [392, 818], bend: -12, n: 11 },
  { zone: '04', row: 4, from: [1036, 888], to: [376, 882], bend: -10, n: 10 },
  // zone 05 — east
  { zone: '05', row: 1, from: [1500, 420], to: [1262, 444], bend: -8, n: 5 },
  { zone: '05', row: 2, from: [1508, 488], to: [1150, 506], bend: -10, n: 7 },
  { zone: '05', row: 3, from: [1516, 552], to: [1096, 566], bend: -10, n: 8 },
  { zone: '05', row: 4, from: [1520, 620], to: [1058, 630], bend: -10, n: 8 },
];

function bez(a: Pt, b: Pt, bend: number, t: number): Pt {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const c: Pt = [mx - (dy / len) * bend * 2, my + (dx / len) * bend * 2];
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

/* ---------- clearance check against the paths and features ---------- */
function distSeg(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function inPoly(p: Pt, poly: readonly Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const warn: string[] = [];
function check(id: string, p: Pt, rad: number) {
  for (const path of PLAN.paths) for (let i = 0; i < path.pts.length - 1; i++) {
    const d = distSeg(p, path.pts[i], path.pts[i + 1]);
    if (d < path.w / 2 + rad) warn.push(`${id} too close to path ${path.id} (${d.toFixed(0)})`);
  }
  const c = PLAN.clearing;
  if (Math.hypot(p[0] - c.x, p[1] - c.y) < c.r + rad) warn.push(`${id} in clearing`);
  if (inPoly(p, PLAN.dogYard.poly)) warn.push(`${id} in dog yard`);
  if (!inPoly(p, PLAN.fence)) warn.push(`${id} outside fence`);
  const k = PLAN.kitchen;
  if (Math.abs(p[0] - k.x) < k.w / 2 + rad && Math.abs(p[1] - k.y) < k.h / 2 + rad) warn.push(`${id} in kitchen`);
  const cl = PLAN.classroom;
  if (Math.hypot(p[0] - cl.x, p[1] - cl.y) < cl.r[2] + 12 + rad) warn.push(`${id} in classroom`);
}

/* ---------- tree positions ---------- */
type Spot = Record<string, unknown> & { id: string; x: number; y: number; kind: string; status: string };
const trees: { id: string; x: number; y: number; zone: string; row: string; age: number }[] = [];
const zoneSeq: Record<string, number> = {};
for (const r of rows) {
  for (let i = 0; i < r.n; i++) {
    const t = r.n === 1 ? 0.5 : i / (r.n - 1);
    const [x, y] = bez(r.from, r.to, r.bend, t);
    const jx = (R() - 0.5) * 8, jy = (R() - 0.5) * 8;
    zoneSeq[r.zone] = (zoneSeq[r.zone] ?? 0) + 1;
    const id = `${r.zone}${String(zoneSeq[r.zone]).padStart(2, '0')}`;
    const p: Pt = [x + jx, y + jy];
    check(id, p, 16);
    trees.push({ id, x: r1(p[0]), y: r1(p[1]), zone: r.zone, row: `${r.zone}${r.row}`, age: 0 });
  }
}

{
  const want: Pt = [700, 752];
  const near = trees.filter((t) => t.zone === '04').sort((a, b) => Math.hypot(a.x - want[0], a.y - want[1]) - Math.hypot(b.x - want[0], b.y - want[1]))[0];
  const cur = trees.find((t) => t.id === '0427')!;
  if (near !== cur) { const tmp = near.id; near.id = cur.id; cur.id = tmp; }
}

/* ---------- status: the forest grows outward from the fire and the gate ---------- */
const centre: Pt = [880, 640];
for (const t of trees) t.age = Math.hypot(t.x - centre[0], (t.y - centre[1]) * 1.25) + (R() - 0.5) * 160;
const byAge = [...trees].sort((a, b) => a.age - b.age);
const N_PLANTED = 100, N_RESERVED = 20;
const status = new Map<string, 'planted' | 'reserved' | 'free'>();
byAge.forEach((t, i) => status.set(t.id, i < N_PLANTED ? 'planted' : i < N_PLANTED + N_RESERVED ? 'reserved' : 'free'));
// a few gaps inside the old rows ("the tree did not take — we replant"): swap with outer planted trees
const inner = byAge.slice(10, 70).filter((t) => t.id !== '0427');
const outerFree = byAge.slice(N_PLANTED + N_RESERVED);
for (let i = 0; i < 7; i++) {
  const a = inner[Math.floor(R() * inner.length)];
  const b = outerFree[i];
  if (!a || !b || status.get(a.id) !== 'planted' || a.id === '0427') continue;
  status.set(a.id, 'free'); status.set(b.id, 'planted');
}
status.set('0427', 'planted');

/* ---------- demo stories ---------- */
const SPECIES = ['olive', 'fig', 'pomegranate', 'carob', 'almond', 'mulberry'] as const;
const SPECIES_W = [22, 20, 18, 12, 14, 14];
function weighted<T>(list: readonly T[], w: number[]): T {
  const s = w.reduce((a, b) => a + b, 0);
  let x = R() * s;
  for (let i = 0; i < list.length; i++) { x -= w[i]; if (x <= 0) return list[i]; }
  return list[list.length - 1];
}
const OCC = ['birth', 'mitzvah', 'wedding', 'birthday', 'memorial', 'team', 'justbecause'] as const;
const OCC_W = [22, 10, 14, 16, 16, 12, 10];
const babies = ['איתי', 'תמר', 'יואב', 'מאיה', 'אורי', 'שירה', 'אלה', 'דניאל', 'הילה', 'עומר', 'ליה', 'אביב', 'נגה', 'רון', 'יהלי', 'אגם', 'עמית', 'גפן', 'ארבל', 'שקד'];
const ded: Record<(typeof OCC)[number], string[]> = {
  birth: babies.map((n) => `לכבוד הולדת ${n}`),
  mitzvah: ['לבר המצווה של איתן', 'לבת המצווה של רוני', 'לבר המצווה של נדב', 'לבת המצווה של יעל', 'לבת המצווה של אלמה', 'לבר המצווה של אסף'],
  wedding: ['לחתונה של שני ואלון', 'לכבוד הנישואים של דנה ורועי', 'עשר שנים ביחד, מיכל ודני', 'לחתונה של נוי ואביב', 'שנה ראשונה ביחד', 'לכבוד החתונה של הדר ותום'],
  birthday: ['לסבא משה בן 80', 'לאמא, ליום הולדת 60', 'ליום ההולדת של רותם', 'לגלעד בן 40', 'לסבתא זהבה בת 90', 'לנטע, בת 7', 'לאבא, ליום הולדת 70'],
  memorial: ['לזכר סבתא רחל', 'לזכרו של אבא, יוסף', 'לזכר חנה, שאהבה כל עץ', 'לזכר רמי, החבר הכי טוב', 'לזכר בוני, הכלב הכי טוב', 'לזכר סבא אברהם', 'לזכר לוסי, הכלבה שלנו', 'לזכר אסתר'],
  team: ['צוות המחקר, 2026', 'מחלקת שירות הלקוחות', 'צוות הגינה של בית הספר', 'הצוות של קומה 3', 'צוות הלוגיסטיקה', 'כיתה ה׳ 2, באהבה'],
  justbecause: ['כי בא לנו', 'סתם, כי טוב לנטוע', 'לכבוד יום שישי בבוקר', 'בשביל הנכדים', 'כי עץ זה תמיד רעיון טוב', 'לכבוד הגשם הראשון'],
};
const families = ['משפחת לוי', 'משפחת מזרחי', 'משפחת פרץ', 'משפחת ביטון', 'משפחת אברהם', 'משפחת פרידמן', 'משפחת חדד', 'משפחת אזולאי', 'משפחת דהן', 'משפחת גולן', 'משפחת שפירא', 'משפחת אוחיון', 'משפחת רוזן', 'משפחת עמר', 'משפחת נחום', 'משפחת שגיא', 'משפחת בן דוד', 'משפחת קפלן'];
const people = ['מיכל ודני', 'רועי ונועם', 'סבא וסבתא', 'החברים מהעבודה', 'יעל ש.', 'דנה א.', 'שירן ועידו', 'החבר׳ה מהמושב', 'הנכדים', 'האחים'];
const byFor: Partial<Record<(typeof OCC)[number], string[]>> = {
  team: ['שם החברה'],
  wedding: ['החברים מהעבודה', 'ההורים', 'החבר׳ה מהמושב', 'האחים', 'משפחת גולן', 'משפחת רוזן'],
};

/* planting days: winter seasons, with community days on Tu BiShvat */
function plantDate(rank: number, total: number): string {
  // rank 0 = oldest
  const seasons: [string, string][] = [['2025-01-06', '2025-04-10'], ['2025-10-26', '2026-04-08'], ['2026-10-25', '2026-11-08']];
  const tubishvat = rank / total < 0.45 ? '2025-02-13' : '2026-02-02';
  if (R() < 0.2) return tubishvat;
  const f = rank / total;
  const [a, b] = f < 0.42 ? seasons[0] : f < 0.94 ? seasons[1] : seasons[2];
  const ta = Date.parse(a), tb = Date.parse(b);
  const sub = f < 0.42 ? f / 0.42 : f < 0.94 ? (f - 0.42) / 0.52 : (f - 0.94) / 0.06;
  const t = ta + (tb - ta) * Math.min(1, Math.max(0, sub + (R() - 0.5) * 0.25));
  return new Date(t).toISOString().slice(0, 10);
}

const used = new Set<string>();
function uniqueDedication(occ: (typeof OCC)[number]) {
  const list = ded[occ].filter((d) => !used.has(d));
  const d = list.length ? pick(list) : pick(ded[occ]);
  used.add(d);
  return d;
}

const out: Spot[] = [];
const planted = byAge.filter((t) => status.get(t.id) === 'planted');
for (const t of trees) {
  const st = status.get(t.id)!;
  const s: Spot = { id: t.id, kind: 'tree', status: st, x: t.x, y: t.y, zone: t.zone, row: t.row };
  if (st === 'planted') {
    const rank = planted.findIndex((p) => p.id === t.id);
    const occ = weighted(OCC, OCC_W);
    s.species = weighted(SPECIES, SPECIES_W);
    if (occ === 'justbecause' && R() < 0.4) s.species = 'carob';
    s.occasion = occ;
    s.dedication = uniqueDedication(occ);
    s.plantedBy = pick(byFor[occ] ?? (R() < 0.7 ? families : people));
    s.date = plantDate(rank, planted.length);
    s.public = occ === 'memorial' ? R() < 0.7 : R() < 0.9;
  } else if (st === 'reserved') {
    s.species = weighted(SPECIES, SPECIES_W);
    s.occasion = weighted(OCC, OCC_W);
    s.date = R() < 0.65 ? '2027-01-23' : pick(['2026-12-04', '2026-12-18', '2027-01-08']);
    s.public = false;
  }
  out.push(s);
}

/* the brief's example tree */
const ex = out.find((s) => s.id === '0427')!;
Object.assign(ex, { status: 'planted', species: 'fig', occasion: 'birth', dedication: 'לכבוד הולדת נועה', plantedBy: 'משפחת כהן', date: '2026-02-14', public: true });

/* ---------- benches, tables, fire nooks, corners ---------- */
const objects: Spot[] = [
  { id: '0911', kind: 'bench', status: 'free', x: 1100, y: 684, rot: 36 },
  { id: '0912', kind: 'table', status: 'free', x: 1214, y: 744, rot: -5 },
  { id: '0913', kind: 'table', status: 'free', x: 1482, y: 742, rot: 84 },
  { id: '0914', kind: 'fire', status: 'free', x: 404, y: 404 },
  { id: '0915', kind: 'fire', status: 'free', x: 962, y: 394 },
  { id: '0916', kind: 'bench', status: 'free', x: 652, y: 410, rot: -54 },
  { id: '0921', kind: 'bench', status: 'planted', x: 742, y: 640, rot: 62, dedication: 'לזכר סבא יעקב, שאהב לשבת בצל', plantedBy: 'הנכדים', date: '2025-05-16', public: true },
  { id: '0922', kind: 'bench', status: 'planted', x: 1044, y: 410, rot: -18, dedication: 'מקום לנוח, מהחבר׳ה מהמושב', plantedBy: 'החבר׳ה מהמושב', date: '2025-11-21', public: true },
  { id: '0961', kind: 'corner', status: 'free', x: 178, y: 404 },
  { id: '0962', kind: 'corner', status: 'free', x: 818, y: 394 },
  { id: '0963', kind: 'corner', status: 'free', x: 1120, y: 892 },
  { id: '0964', kind: 'corner', status: 'free', x: 1486, y: 846 },
];
for (const o of objects) check(o.id, [o.x, o.y], o.kind === 'corner' ? 30 : 14);
out.push(...objects);

const counts = out.reduce<Record<string, number>>((a, s) => { const k = `${s.kind}:${s.status}`; a[k] = (a[k] ?? 0) + 1; return a; }, {});
console.log('spots', out.length, counts);
if (warn.length) console.log('WARN\n' + warn.join('\n'));

const json = '[\n' + out.map((s) => '  ' + JSON.stringify(s)).join(',\n') + '\n]\n';
writeFileSync(`${root}/src/data/trees.json`, json);
console.log('wrote', `${root}/src/data/trees.json`);
