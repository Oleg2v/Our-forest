/* Spot markers (SVG markup, centred at 0,0 inside a translated group).
   planted → olive crown (shape per species, size by age) · reserved → outline + stake ·
   free → --fruit ring with a soft pulse · benches/tables/fire nooks/corners → small plan symbols. */
import type { Spot, SpeciesId } from '../forest-map';
import { rng, hashSeed, crown, branches, sketchCircle, rectPath } from './sketch';
import { daysBetween } from '../../core/format';

const CROWN: Record<SpeciesId, { lobes: number; bulge: number; irr: number }> = {
  olive: { lobes: 9, bulge: 1.12, irr: 0.15 },
  fig: { lobes: 5, bulge: 1.36, irr: 0.06 },
  pomegranate: { lobes: 7, bulge: 1.2, irr: 0.1 },
  carob: { lobes: 12, bulge: 1.1, irr: 0.05 },
  almond: { lobes: 6, bulge: 1.24, irr: 0.08 },
  mulberry: { lobes: 8, bulge: 1.18, irr: 0.12 },
};

export interface SpotGeom { r: number; hit: number }

/** crown radius by age: saplings are small, two-year-olds fill their place */
export function crownR(s: Spot, today = new Date()): number {
  if (s.status !== 'planted' || !s.date) return 12;
  const age = Math.max(0, daysBetween(s.date, today));
  return 11.5 + 7.5 * Math.min(1, age / 640);
}

export function spotInner(s: Spot, touch: boolean): { html: string; geom: SpotGeom } {
  const r = rng(hashSeed(s.id));
  if (s.kind === 'tree') {
    if (s.status === 'free') {
      const rr = touch ? 13 : 11;
      const hit = touch ? 30 : 22;
      return {
        geom: { r: rr, hit },
        html: `<circle class="fmap__hit" r="${hit}"/>`
          + `<circle class="fmap__ring" r="${rr}"/><circle class="fmap__seed" r="${(rr * 0.26).toFixed(1)}"/>`
          + `<path class="fmap__check" d="M-4.6 .2l3 3 6.2-6.4"/>`,
      };
    }
    const sp = s.species ?? 'olive';
    const c = CROWN[sp];
    const rad = crownR(s);
    const hit = touch ? 28 : Math.max(20, rad + 4);
    if (s.status === 'reserved') {
      return {
        geom: { r: rad, hit },
        html: `<circle class="fmap__hit" r="${hit}"/><path class="fmap__crown fmap__crown--reserved" d="${crown(rad, c.lobes, r, c.bulge, c.irr)}"/>`
          + `<path class="fmap__stake" d="M-3 -3l6 6M3 -3l-6 6"/>`,
      };
    }
    let extra = '';
    if (sp === 'almond') {
      // a few blossoms on the almond crown
      for (let i = 0; i < 4; i++) {
        const a = r() * Math.PI * 2, d = rad * (0.35 + r() * 0.4);
        extra += `M${(Math.cos(a) * d).toFixed(1)} ${(Math.sin(a) * d).toFixed(1)}h.01`;
      }
    }
    return {
      geom: { r: rad, hit },
      html: `<circle class="fmap__hit" r="${hit}"/><path class="fmap__crown" d="${crown(rad, c.lobes, r, c.bulge, c.irr)}"/>`
        + `<path class="fmap__twig" d="${branches(rad, r, sp === 'carob' ? 4 : 3)}"/>`
        + (extra ? `<path class="fmap__bloom" d="${extra}"/>` : '')
        + `<circle class="fmap__trunk" r="1.9"/>`,
    };
  }

  const free = s.status === 'free';
  const rot = s.rot ?? 0;
  if (s.kind === 'corner') {
    const hit = touch ? 44 : 40;
    return {
      geom: { r: 32, hit },
      html: `<circle class="fmap__hit" r="${hit}"/>`
        + `<path class="fmap__corner" d="${sketchCircle(0, 0, 30, r, 0.04, 14)}"/>`
        + `<path class="fmap__corner-plus" d="M-6 0h12M0 -6v12"/>`
        + `<path class="fmap__check" d="M-4.6 .2l3 3 6.2-6.4"/>`,
    };
  }
  const hit = touch ? 28 : 22;
  let sym = '';
  if (s.kind === 'bench') {
    const a = (rot * Math.PI) / 180;
    sym = rectPath(0, 0, 30, 9, rot, r, 0.3) + rectPath(Math.sin(a) * 9, -Math.cos(a) * 9, 30, 3, rot, r, 0.2);
  }
  else if (s.kind === 'table') {
    sym = rectPath(0, 0, 32, 16, rot, r, 0.4);
    const a = (rot * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
    for (const [x, y] of [[-10, -15], [10, -15], [-10, 15], [10, 15]]) {
      const px = x * cs - y * sn, py = x * sn + y * cs;
      sym += `M${(px - 3).toFixed(1)} ${py.toFixed(1)}a3 3 0 1 0 6 0a3 3 0 1 0 -6 0`;
    }
  } else {
    // fire nook: ring of stones + a small flame
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      sym += `M${(Math.cos(a) * 11 - 2.2).toFixed(1)} ${(Math.sin(a) * 11).toFixed(1)}a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0`;
    }
    sym += 'M0 4.5c-2.6 0-4.2-1.6-4.2-3.8 0-2.6 2.4-3.8 2.8-6.6 1.8 1.1 2.6 2.5 2.7 4.1.6-.5 1-1.2 1.2-2 1.2 1.1 1.8 2.6 1.8 4.2 0 2.4-1.8 4.1-4.3 4.1Z';
  }
  return {
    geom: { r: 16, hit },
    html: `<circle class="fmap__hit" r="${hit}"/>`
      + `<path class="fmap__furn${free ? ' fmap__furn--free' : ''}" d="${sym}"/>`
      + (free ? '<path class="fmap__check" d="M-4.6 .2l3 3 6.2-6.4"/>' : ''),
  };
}
