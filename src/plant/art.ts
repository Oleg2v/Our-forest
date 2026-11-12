/* Line art for the configurator — same language as the site icons:
   stroke only (currentColor), 1.5px, round caps/joins.
   Trees live in a 240×260 viewBox, ground at y=214. Each species has a closed trunk
   outline and a closed crown outline (the sapling morphs into them with MorphSVG)
   plus small details (fruit, leaves, blossoms) that pop in after the growth. */
import type { SpeciesId } from '../components/forest-map';

export const TREE_VB = '0 0 240 260';
export const SAPLING = {
  trunk: 'M118.6 214 C119.2 204 118.4 196 119.4 186 L120.6 186 C121.6 196 120.8 204 121.4 214 Z',
  crown: 'M120 188 C113 181 105 180 99 184 C105 190 113 191 120 188 C126 180 134 177 141 180 C136 188 128 191 120 188 Z',
};
export const GROUND = 'M20 214 C64 212.5 176 215.5 220 214';
export const GRASS = 'M38 214 l-2.5 -6 M42 214 l1 -7 M46 214 l2.5 -5 M190 214 l-2 -6 M194 214 l1.5 -7.5 M198 214 l3 -5';
export const ROOTS =
  'M120 214 C118 226 108 232 96 239 C88 244 80 245 70 250 M120 214 C124 228 134 236 148 241 C158 245 166 246 176 252 ' +
  'M118 216 C116 230 117 242 112 255 M122 216 C126 226 124 238 129 248 M104 236 C98 244 98 250 92 256 M140 238 C146 244 148 250 154 255';

/* ---------- detail primitives ---------- */
const f = (n: number) => Math.round(n * 10) / 10;
const ellipse = (x: number, y: number, rx: number, ry: number) =>
  `M${f(x - rx)} ${f(y)} a${rx} ${ry} 0 1 0 ${f(2 * rx)} 0 a${rx} ${ry} 0 1 0 ${f(-2 * rx)} 0`;
const leaf = (x: number, y: number, len: number, deg: number, w = len * 0.28) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const x1 = x + c * len, y1 = y + s * len, mx = (x + x1) / 2, my = (y + y1) / 2;
  return `M${f(x)} ${f(y)} Q${f(mx - s * w)} ${f(my + c * w)} ${f(x1)} ${f(y1)} Q${f(mx + s * w)} ${f(my - c * w)} ${f(x)} ${f(y)} Z`;
};
const figLeaf = (x: number, y: number) =>
  `M${x} ${y + 6} C${x - 2} ${y + 2} ${x - 9} ${y + 3} ${x - 8} ${y - 2} C${x - 7} ${y - 6} ${x - 3} ${y - 4} ${x - 2} ${y - 6} C${x - 2} ${y - 10} ${x + 2} ${y - 10} ${x + 2} ${y - 6} C${x + 3} ${y - 4} ${x + 7} ${y - 6} ${x + 8} ${y - 2} C${x + 9} ${y + 3} ${x + 2} ${y + 2} ${x} ${y + 6} Z M${x} ${y + 6} L${x} ${y - 4}`;
const fig = (x: number, y: number) =>
  `M${x} ${y - 6} C${x - 4} ${y - 5} ${x - 5.5} ${y + 1} ${x - 4.5} ${y + 3.5} C${x - 3.5} ${y + 6} ${x + 3.5} ${y + 6} ${x + 4.5} ${y + 3.5} C${x + 5.5} ${y + 1} ${x + 4} ${y - 5} ${x} ${y - 6} Z M${x} ${y - 6} l0.6 -2.6`;
const pom = (x: number, y: number) =>
  `${ellipse(x, y, 6.5, 6.5)} M${x - 2.6} ${y - 6.2} l0.6 -3 l1.2 1.6 l0.8 -2.2 l0.8 2.2 l1.2 -1.6 l0.6 3`;
const pod = (x: number, y: number, bend = 1) => `M${x} ${y} q${5 * bend} 10 ${1 * bend} 21 q${-4 * bend} -10 ${-1 * bend} -21 Z`;
const blossom = (x: number, y: number) => {
  let d = '';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    d += ellipse(x + Math.cos(a) * 2.7, y + Math.sin(a) * 2.7, 1.9, 1.9) + ' ';
  }
  return d + `M${x} ${y} l0.01 0`;
};
const berry = (x: number, y: number) => `${ellipse(x, y, 2.8, 4.4)} M${x - 1} ${y - 1} l0.01 0 M${x + 1} ${y + 1.5} l0.01 0 M${x} ${y - 4.4} l0.4 -2.4`;
const heartLeaf = (x: number, y: number) =>
  `M${x} ${y + 6} C${x - 7} ${y + 1} ${x - 6} ${y - 6} ${x} ${y - 3} C${x + 6} ${y - 6} ${x + 7} ${y + 1} ${x} ${y + 6} Z M${x} ${y + 6} L${x} ${y - 2}`;
const pinnate = (x: number, y: number, deg: number) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  let d = `M${f(x)} ${f(y)} L${f(x + c * 16)} ${f(y + s * 16)}`;
  for (const t of [5, 10]) {
    const px = x + c * t, py = y + s * t;
    d += ' ' + leaf(px, py, 6, deg - 60, 2.2) + ' ' + leaf(px, py, 6, deg + 60, 2.2);
  }
  return d;
};

export interface SpeciesArt { trunk: string; crown: string; details: string[]; marks: string[] }

/** marks = internal foliage contours (engraving-like depth); details = fruit / leaves that pop in */
export const SPECIES_ART: Record<SpeciesId, SpeciesArt> = {
  olive: {
    trunk: 'M104 214 C109 205 111 196 108 186 C105 176 110 168 108 158 C106 150 98 144 90 138 L94 133 C102 139 110 145 114 152 C118 146 126 140 134 132 L138 136 C132 144 124 152 122 162 C120 172 127 180 126 190 C125 200 129 207 136 214 Z',
    crown: 'M70 142 C52 142 40 128 48 114 C36 104 44 84 62 84 C62 66 82 56 98 64 C108 50 132 50 142 62 C158 54 180 62 180 80 C198 86 200 108 188 118 C196 132 182 146 166 142 C158 152 140 152 132 144 C124 150 108 150 100 144 C90 152 74 152 70 142 Z',
    marks: ['M58 120 C66 112 78 110 88 114', 'M150 96 C160 90 172 92 178 100', 'M98 84 C108 78 120 78 128 84', 'M124 128 C134 122 146 122 154 126'],
    details: [
      ellipse(78, 120, 2.6, 3.6), ellipse(92, 130, 2.6, 3.6), ellipse(140, 116, 2.6, 3.6), ellipse(160, 110, 2.6, 3.6), ellipse(116, 98, 2.6, 3.6), ellipse(64, 100, 2.6, 3.6), ellipse(170, 128, 2.6, 3.6),
      leaf(60, 92, 12, -20), leaf(82, 78, 12, 15), leaf(104, 68, 12, -10), leaf(134, 70, 12, 20), leaf(158, 80, 12, -15), leaf(174, 100, 12, 10), leaf(70, 132, 12, 25), leaf(148, 134, 12, -20), leaf(126, 104, 12, 10), leaf(98, 108, 12, -15),
    ],
  },
  fig: {
    trunk: 'M108 214 C112 204 112 194 110 184 C100 176 88 168 76 160 L80 156 C92 162 104 170 114 176 C116 166 116 156 114 146 L120 144 C122 154 122 166 122 176 C132 168 144 160 156 152 L160 156 C148 166 136 176 128 186 C128 196 128 206 134 214 Z',
    crown: 'M56 160 C38 156 30 138 40 124 C30 108 40 88 60 88 C66 70 88 62 104 70 C114 58 136 58 146 70 C164 62 184 72 186 90 C204 96 210 120 198 132 C206 148 192 162 176 158 C164 168 146 166 138 158 C126 166 108 166 100 158 C90 168 70 168 56 160 Z',
    marks: ['M52 132 C60 124 72 122 82 126', 'M160 112 C170 106 182 108 188 116', 'M104 90 C114 84 126 84 134 90'],
    details: [
      fig(80, 136), fig(98, 148), fig(150, 142), fig(168, 128), fig(124, 122), fig(60, 120),
      figLeaf(70, 98), figLeaf(104, 82), figLeaf(140, 80), figLeaf(172, 100), figLeaf(118, 104), figLeaf(150, 112), figLeaf(84, 118),
    ],
  },
  pomegranate: {
    trunk: 'M112 214 C110 200 104 186 94 172 L98 169 C106 180 112 190 116 200 C116 186 117 172 116 158 L121 158 C122 172 122 186 121 200 C126 188 134 178 144 168 L148 171 C138 182 130 196 128 214 Z',
    crown: 'M74 172 C56 166 52 146 62 134 C50 120 58 98 76 96 C76 78 94 64 112 70 C122 56 146 60 152 74 C170 72 184 90 178 106 C192 118 188 140 174 146 C180 162 164 176 148 170 C140 180 122 182 114 174 C102 182 82 182 74 172 Z',
    marks: ['M66 140 C74 132 86 130 94 134', 'M142 100 C152 94 164 96 170 104', 'M104 88 C112 82 124 82 132 88'],
    details: [
      pom(86, 144), pom(110, 158), pom(148, 150), pom(160, 120), pom(96, 112), pom(130, 128),
      leaf(76, 108, 10, -30), leaf(120, 80, 10, 20), leaf(150, 86, 10, -20), leaf(170, 132, 10, 30), leaf(70, 156, 10, 15), leaf(112, 98, 10, -10), leaf(140, 108, 10, 35),
    ],
  },
  carob: {
    trunk: 'M102 214 C108 204 110 192 108 180 C102 172 92 166 82 162 L86 158 C96 160 106 166 112 172 C114 164 114 156 112 150 L124 150 C124 158 124 166 126 172 C134 164 144 158 154 156 L156 160 C146 166 138 172 134 182 C132 194 134 206 140 214 Z',
    crown: 'M52 168 C32 162 26 140 38 126 C28 106 40 82 62 80 C66 58 90 44 112 50 C124 38 148 40 158 54 C180 52 200 70 196 92 C212 104 212 130 198 140 C204 158 188 172 170 168 C160 178 140 178 130 170 C120 178 100 178 92 170 C80 178 60 178 52 168 Z',
    marks: ['M44 130 C54 120 68 118 80 122', 'M150 74 C160 68 174 70 182 78', 'M96 66 C106 60 120 60 128 66', 'M170 128 C178 122 190 122 196 128', 'M100 140 C110 134 124 134 132 140'],
    details: [
      pod(76, 150), pod(92, 156, -1), pod(150, 154), pod(166, 146, -1), pod(122, 160), pod(60, 136, -1), pod(180, 120),
      pinnate(64, 104, -30), pinnate(100, 86, -60), pinnate(140, 84, -120), pinnate(170, 104, -150), pinnate(118, 112, -90),
    ],
  },
  almond: {
    trunk: 'M112 214 C114 202 114 190 112 178 C106 166 96 152 82 136 L86 133 C100 148 110 160 116 170 C118 156 118 140 116 124 L122 124 C124 140 124 156 122 170 C130 156 142 142 156 130 L160 134 C146 148 134 162 128 178 C126 190 126 202 130 214 Z',
    crown: 'M76 146 C58 140 52 122 62 110 C50 96 56 72 76 70 C80 52 100 42 116 50 C128 38 150 42 156 56 C174 56 188 74 182 92 C194 104 190 126 176 132 C178 146 162 154 150 146 C140 152 128 150 122 142 C112 150 98 152 92 144 C86 152 76 152 76 146 Z',
    marks: ['M84 134 C78 122 72 112 68 100', 'M158 131 C164 118 168 106 170 94', 'M119 124 C118 108 116 92 114 74', 'M117 100 C110 92 102 86 94 82', 'M121 96 C130 88 140 82 150 80'],
    details: [
      blossom(70, 100), blossom(88, 76), blossom(112, 62), blossom(140, 58), blossom(164, 72), blossom(176, 98), blossom(160, 122),
      blossom(132, 108), blossom(100, 120), blossom(80, 132), blossom(126, 82), blossom(150, 92), blossom(96, 96),
    ],
  },
  mulberry: {
    trunk: 'M108 214 C112 204 112 192 110 180 C102 170 90 162 78 156 L81 152 C94 158 106 166 114 170 C116 160 118 150 116 140 L122 140 C124 150 124 160 122 170 C132 162 146 156 160 152 L162 156 C148 162 136 170 130 180 C128 192 128 204 132 214 Z',
    crown: 'M60 164 C42 158 36 138 46 126 C36 108 46 86 66 84 C70 64 92 52 110 58 C122 46 146 48 154 60 C174 56 194 72 192 92 C206 104 204 128 192 136 C198 154 182 168 166 162 C158 172 140 174 132 166 C122 174 104 174 96 166 C86 174 66 174 60 164 Z',
    marks: ['M54 132 C62 124 74 122 84 126', 'M152 84 C162 78 176 80 182 88', 'M100 76 C110 70 122 70 130 76', 'M140 140 C150 134 162 134 170 140'],
    details: [
      berry(78, 142), berry(96, 152), berry(144, 152), berry(164, 140), berry(120, 134), berry(70, 116), berry(174, 112),
      heartLeaf(66, 96), heartLeaf(98, 78), heartLeaf(132, 74), heartLeaf(162, 86), heartLeaf(182, 112), heartLeaf(110, 106), heartLeaf(146, 110),
    ],
  },
};

/** Static grown tree (cards, certificate). */
export function treeSvg(id: SpeciesId, opts: { className?: string; details?: number; ground?: boolean; roots?: boolean; title?: string; viewBox?: string } = {}): string {
  const a = SPECIES_ART[id];
  const det = a.details.slice(0, opts.details ?? a.details.length);
  const vb = opts.viewBox ?? (opts.roots ? TREE_VB : '20 36 200 186');
  return `<svg viewBox="${vb}" class="${opts.className ?? ''}" ${opts.title ? `role="img" aria-label="${opts.title}"` : 'aria-hidden="true" focusable="false"'}>
    ${opts.roots ? `<path class="art-roots" d="${ROOTS}" vector-effect="non-scaling-stroke"/>` : ''}
    ${opts.ground !== false ? `<path class="art-ground" d="${GROUND}" vector-effect="non-scaling-stroke"/>` : ''}
    <path class="art-trunk" d="${a.trunk}" vector-effect="non-scaling-stroke"/>
    <path class="art-crown" d="${a.crown}" vector-effect="non-scaling-stroke"/>
    <g class="art-marks">${a.marks.map((d) => `<path d="${d}" vector-effect="non-scaling-stroke"/>`).join('')}</g>
    <g class="art-details">${det.map((d) => `<path d="${d}" vector-effect="non-scaling-stroke"/>`).join('')}</g>
  </svg>`;
}

/* ---------- 24px line icons ---------- */
export const ICONS = {
  fwd: 'M19 12H5M11 6l-6 6 6 6',
  back: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  pin: 'M12 21s-6.5-6.2-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.8-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  map: 'M3.5 6l5.5-2 6 2 5.5-2v14l-5.5 2-6-2-5.5 2zM9 4v14M15 6v14',
  leaf: 'M5 19C5 11 10 5 19 5c0 9-6 14-14 14zM5 19l8-8',
  family: 'M7 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM3.5 20v-5a3.5 3.5 0 0 1 7 0v5M17 10.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM14.5 20v-3.5a2.5 2.5 0 0 1 5 0V20M12 20v-4.5M12 17c-1.5 0-2.5-1-2.5-2.5 1.5 0 2.5 1 2.5 2.5zM12 16c0-1.5 1-2.5 2.5-2.5',
  guardians: 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6zM9 15c0-3.2 2-5.4 6-5.4 0 4-2 6-6 5.4zM9 15l3-3',
  certificate: 'M3.5 3.5h17v17h-17zM6.5 6.5h11v11h-11zM9 10h6M9 13h4',
  box: 'M4 10h16v10H4zM3 6.5h18V10H3zM10 13.5h4M12 6.5V4M12 4.5c-1-1.6-2.8-2-4-1.4M12 4.5c1-1.6 2.8-2 4-1.4',
  gift: 'M4 10.5h16V20H4zM3 7h18v3.5H3zM12 7v13M12 7c-2-3-6-3.2-6-1.2S10 7 12 7zM12 7c2-3 6-3.2 6-1.2S14 7 12 7z',
  chat: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.2A8 8 0 1 1 20 12zM9 10.5h6M9 13.5h4',
  mail: 'M3.5 6.5h17v11h-17zM3.5 7l8.5 6.5L20.5 7',
  card: 'M3 6.5h18v11H3zM3 10h18M6.5 14.5h4',
  phone: 'M7.5 3h9v18h-9zM11 18h2',
  tap: 'M6 3.5h8v17H6zM17 9c1 .8 1.5 1.8 1.5 3s-.5 2.2-1.5 3M19.5 7c1.5 1.4 2.3 3 2.3 5s-.8 3.6-2.3 5',
  print: 'M6.5 9V3.5h11V9M6.5 17.5h-3v-8h17v8h-3M6.5 14h11v6.5h-11z',
  share: 'M12 3v12M7.5 7.5L12 3l4.5 4.5M5 12v8h14v-8',
  calendar: 'M4 5.5h16v15H4zM4 10h16M8 3v4M16 3v4',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 11 0M16 11a2.5 2.5 0 1 0 0-5M17.5 14.5a4.5 4.5 0 0 1 3 4.5',
  bench: 'M4 6.5h16M4 9.5h16M3 13h18M6 6.5V19M18 6.5V19M3 16h3M18 16h3',
  table: 'M2.5 8.5h19M7 8.5L4 19.5M17 8.5l3 11M3.5 14h17',
  fire: 'M12 3c2.5 3 5 5 5 8.5A5 5 0 0 1 7 11.5C7 9 8.5 8 9.5 6.5c.5 2 1.5 3 2.5 3.5C12 7.5 11.5 5 12 3zM4 21l16-4M4 17l16 4',
  kitchen: 'M5 10h14v5.5a4.5 4.5 0 0 1-4.5 4.5h-5A4.5 4.5 0 0 1 5 15.5zM3 10h18M9 7c0-1 1-1 1-2s-1-1-1-2M14 7c0-1 1-1 1-2s-1-1-1-2',
  class: 'M2.5 9.5L12 4l9.5 5.5M5 9v11M19 9v11M8.5 12h7v5h-7zM12 17v3',
  saw: 'M3.5 16.5l9-9 4 4-9 9zM12.5 7.5l2-2a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3l-2 2M5.5 18.5l1-1M7.5 16.5l1-1M9.5 14.5l1-1',
  dog: 'M5 12h9.5l2-4.5h1.8l.8 1.5H21l-.4 1.8-2.6.7V14l-1 1v4.5M15 15v4.5M8.5 15v4.5M5 12v7.5M5 12c0 1.7 1.3 3 3 3h7.5M5 12L3 9.5',
  sprout: 'M12 21v-9M12 12c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6zM12 14c0-3 2-5 5.5-5 0 3-2 5-5.5 5zM7 21h10',
  lantern: 'M9 6.5h6l1.5 3v8a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5v-8zM10 3.5h4v3h-4zM12 11.5v3.5',
  herbs: 'M7 14h10l-1.5 6.5h-7zM12 14V6M12 9c-2 0-3.5-1.5-3.5-3.5 2 0 3.5 1.5 3.5 3.5zM12 11.5c2 0 3.5-1.5 3.5-3.5-2 0-3.5 1.5-3.5 3.5z',
  plaque: 'M4 6.5h16v7H4zM12 13.5V21M9 21h6',
  tree: 'M12 21v-7M12 14l-3-3M12 15.5l3-3M12 3a6 6 0 0 0-6 6 4 4 0 0 0 3 4h6a4 4 0 0 0 3-4 6 6 0 0 0-6-6z',
  guarantee: 'M12 20v-6M12 14c0-2.5-2-4.5-4.5-4.5 0 2.5 2 4.5 4.5 4.5zM12 15.5c0-2 1.6-3.5 3.5-3.5 0 2-1.6 3.5-3.5 3.5zM20 12a8 8 0 1 1-2.3-5.6M20 3.5V7h-3.5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  edit: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  can: 'M5 10.5h9V19H5zM14 13.5l5.5-4.5M18.2 7.6l2.6 2.6M7 10.5V8a2.5 2.5 0 0 1 5 0v2.5',
  seat: 'M12 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM7 21v-6.5a5 5 0 0 1 10 0V21',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
} as const;
export type IconName = keyof typeof ICONS;

export function icon(name: IconName, cls = 'icon'): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[name]}"/></svg>`;
}
/** icon paths for an SVG <g> inside a bigger drawing (stroke set by the parent) */
export function iconPath(name: IconName, transform: string, cls = ''): string {
  return `<g transform="${transform}" class="${cls}"><path d="${ICONS[name]}" vector-effect="non-scaling-stroke"/></g>`;
}
