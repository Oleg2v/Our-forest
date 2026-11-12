/* ==========================================================================
   Forest map — the plot plan (top view), in plan units (1 unit ≈ 10 cm).
   Pure data, no imports: used by the art module and by the demo-data
   generator (scratchpad/agents/map/gen-trees.ts), so the trees in
   src/data/trees.json always stand between the paths, never on them.
   ========================================================================== */
export type Pt = [number, number];

export const PLAN = {
  w: 1600,
  h: 1000,
  /** drawn surroundings (fields, the moshav road, neighbours) */
  world: { x0: -460, y0: -360, x1: 2060, y1: 1360 },

  /** plot fence, closed loop */
  fence: [
    [86, 128], [300, 84], [560, 96], [820, 72], [1080, 90], [1320, 66], [1498, 100], [1546, 260],
    [1534, 490], [1554, 700], [1516, 888], [1300, 928], [1000, 946], [720, 930], [440, 950],
    [200, 926], [74, 858], [54, 620], [66, 380],
  ] as Pt[],
  gate: { x: 1240, y: 932, w: 46 },

  /** walkways (width in plan units) */
  paths: [
    { id: 'main', w: 30, pts: [[1244, 1060], [1240, 960], [1234, 900], [1196, 840], [1120, 772], [1020, 702], [930, 642], [866, 590]] as Pt[] },
    { id: 'nw', w: 20, pts: [[738, 452], [690, 392], [642, 320], [614, 240], [600, 168], [594, 124]] as Pt[] },
    { id: 'east', w: 20, pts: [[886, 494], [960, 470], [1050, 446], [1130, 414], [1222, 384]] as Pt[] },
    { id: 'west', w: 20, pts: [[712, 556], [640, 592], [560, 632], [470, 678], [384, 728], [322, 768]] as Pt[] },
  ],

  /** the clearing with the fire place */
  clearing: { x: 800, y: 524, r: 92 },

  /** outdoor kitchen under a pergola + herb beds */
  kitchen: { x: 1350, y: 752, w: 150, h: 92, rot: -5 },
  beds: [
    { x: 1296, y: 850, w: 44, h: 34, rot: -4 },
    { x: 1350, y: 852, w: 44, h: 34, rot: -4 },
    { x: 1404, y: 846, w: 44, h: 34, rot: -4 },
  ],

  /** fenced dogs' yard */
  dogYard: {
    poly: [[1196, 126], [1490, 114], [1512, 240], [1500, 350], [1252, 390], [1206, 374], [1190, 250]] as Pt[],
    gate: [1229, 382] as Pt,
    house: { x: 1438, y: 172, w: 46, h: 36, rot: 8 },
    bowl: [1266, 168] as Pt,
    poles: [[1300, 300], [1330, 296], [1360, 300], [1390, 296], [1420, 300]] as Pt[],
    tunnel: [1336, 214] as Pt,
    paws: [[1236, 336], [1262, 318], [1286, 330], [1312, 312], [1336, 322], [1358, 304]] as Pt[],
  },

  /** outdoor classroom: benches on arcs around a board */
  classroom: { x: 236, y: 808, r: [48, 74, 100] },

  /** compass + scale bar + title cartouche (outside the fence) */
  compass: [40, 58] as Pt,
  scale: { x: 112, y: 36, len: 200 },
  title: [800, 30] as Pt,
} as const;

/** map labels (micro-copy for the plan, Hebrew) */
export const PLAN_LABELS: { id: string; x: number; y: number; text: string; size?: number }[] = [
  { id: 'fire', x: 800, y: 600, text: 'מדורה' },
  { id: 'kitchen', x: 1350, y: 812, text: 'מטבח' },
  { id: 'dogs', x: 1352, y: 258, text: 'חצר הכלבים' },
  { id: 'class', x: 236, y: 904, text: 'כיתת חוץ' },
  { id: 'gate', x: 1296, y: 968, text: 'כניסה' },
];
