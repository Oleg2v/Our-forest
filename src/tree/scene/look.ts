/* Light & palette from the honest state: Israel time of day, weather, mode.
   dawn → pink light + birds · day → warm light · sunset → long shadows · night → moss paper,
   the engraving turns into a moonlit scratchboard (light lines on dark), moon + fireflies. */
import type { TreeSceneState } from '../scene-api';
import { P, TINT, mixC, hex, clamp, smooth, lerp, norm, type RGB, type V3 } from './util';

export interface Look {
  bg: RGB;            // paper colour behind the island
  glow: RGB; glowA: number; glowX: number; glowY: number; glowR: number;
  ink: RGB; inkA: number;
  /** 0 = dark lines on light paper (day) … 1 = light lines on dark paper (night) */
  night: number;
  dawn: number; dusk: number; day: number;
  light: V3;          // direction toward the light (world)
  lightC: RGB;
  amb: number;        // ambient term
  fill: number;       // fill brightness multiplier
  shadowLen: number;  // ground shadow stretch
  shadowA: number;
  rain: number; haze: number; memorial: number;
  fogC: RGB;
}

const bell = (h: number, c: number, w: number) => {
  let d = Math.abs(h - c);
  d = Math.min(d, 24 - d);
  return smooth(w, 0, d);
};

const DAWN_BG = mixC(P.cream, hex('#F4CFC4'), 0.62);
const DUSK_BG = mixC(P.cream, hex('#F1CFAA'), 0.62);
const RAIN_BG = mixC(mixC(P.sand, P.sage, 0.28), P.bark, 0.04);
const HAZE_BG = mixC(P.cream, hex('#EFD5A6'), 0.7);
const NIGHT_BG = mixC(P.moss, P.soil, 0.15);

export function computeLook(s: TreeSceneState): Look {
  const h = ((s.hours % 24) + 24) % 24;
  const day = smooth(4.3, 5.7, h) * (1 - smooth(18.5, 19.9, h));
  const dawn = bell(h, 5.9, 1.6) * (0.5 + 0.5 * day);
  const dusk = bell(h, 18.25, 1.7) * (0.45 + 0.55 * day);
  const night = 1 - day;
  const rain = s.weather === 'rain' ? 1 : 0;
  const haze = s.weather === 'hamsin' ? 1 : 0;
  const mem = s.mode === 'memorial' ? 1 : 0;

  let bg = P.cream;
  bg = mixC(bg, DAWN_BG, dawn);
  bg = mixC(bg, DUSK_BG, dusk);
  bg = mixC(bg, RAIN_BG, rain * 0.75 * day);
  bg = mixC(bg, HAZE_BG, haze * 0.8 * day);
  bg = mixC(bg, mixC(P.cream, P.sand, 0.55), mem * 0.45 * day);
  bg = mixC(bg, mixC(NIGHT_BG, P.sage, rain * 0.06), night);

  // glow: dawn east (right, low) · day high · dusk west (left, low) · night moon (left, high)
  let glow = mixC(hex('#FCE7C4'), hex('#F6C9BC'), dawn);
  glow = mixC(glow, hex('#F4C08E'), dusk);
  glow = mixC(glow, mixC(P.sage, P.cream, 0.4), night);
  const sunA = ((h - 6) / 12) * Math.PI; // 0 at 6:00 (east), π at 18:00 (west)
  const elev = Math.max(0, Math.sin(sunA));
  const glowX = lerp(lerp(0.5 + Math.cos(sunA) * 0.32, 0.24, night), 0.5, 0);
  const glowY = lerp(lerp(0.62 - elev * 0.45, 0.17, night), 0.3, 0);
  const glowA = (0.55 + 0.25 * (dawn + dusk)) * (1 - rain * 0.85) * (1 - mem * 0.35) * lerp(1, 0.6, night);

  const sunDir = norm([Math.cos(sunA) - 0.25, Math.max(0.12, Math.sin(sunA)) * 0.95 + 0.1, 0.62]);
  const moonDir = norm([-0.55, 0.75, 0.6]);
  const light = norm(sunDir.map((v, i) => lerp(v, moonDir[i], night)) as V3);
  let lightC = mixC([1, 0.97, 0.9], hex('#FFD7CC'), dawn);
  lightC = mixC(lightC, hex('#FFC896'), dusk);
  lightC = mixC(lightC, mixC(P.sage, P.cream, 0.5), night);

  const ink = mixC(P.bark, mixC(P.sage, P.cream, 0.45), night);
  const fogC = mixC(bg, P.cream, 0.4 * day);
  const shadowLen = lerp(1 / Math.max(0.28, elev * 1.1), 1.2, night);
  return {
    bg, glow, glowA, glowX, glowY, glowR: lerp(0.62, 0.45, night),
    ink, inkA: lerp(0.95, 0.78, night),
    night, dawn, dusk, day,
    light, lightC,
    amb: clamp(lerp(0.36, 0.5, rain) + mem * 0.08),
    fill: lerp(1, 0.4, night) * lerp(1, 0.93, rain),
    shadowLen: clamp(shadowLen, 1, 3.4),
    shadowA: lerp(0.9, 0.35, rain) * lerp(1, 0.5, night) * (1 - mem * 0.25),
    rain, haze, memorial: mem, fogC,
  };
}

const KEYS_RGB = ['bg', 'glow', 'ink', 'lightC', 'fogC'] as const;
const KEYS_NUM = ['glowA', 'glowX', 'glowY', 'glowR', 'inkA', 'night', 'dawn', 'dusk', 'day', 'amb', 'fill', 'shadowLen', 'shadowA', 'rain', 'haze', 'memorial'] as const;
/** smooth approach of the live look toward a target look */
export function approachLook(cur: Look, target: Look, k: number): Look {
  for (const key of KEYS_RGB) {
    const a = cur[key], b = target[key];
    for (let i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * k;
  }
  for (const key of KEYS_NUM) (cur as any)[key] += ((target as any)[key] - (cur as any)[key]) * k;
  for (let i = 0; i < 3; i++) cur.light[i] += (target.light[i] - cur.light[i]) * k;
  return cur;
}
export function cloneLook(l: Look): Look {
  return { ...l, bg: [...l.bg] as RGB, glow: [...l.glow] as RGB, ink: [...l.ink] as RGB, lightC: [...l.lightC] as RGB, fogC: [...l.fogC] as RGB, light: [...l.light] as V3 };
}
export { TINT };
