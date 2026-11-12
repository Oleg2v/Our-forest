/* Line icons for the forest map (viewBox 24, stroke 1.5, round) — species, objects, UI.
   Same hand as the rest of the site's icons. */
import type { SpeciesId } from '../forest-map';

const petals = (() => {
  // almond blossom: five rounded petals around a small heart
  let d = '';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    const u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]];
    const p = (s: number, t: number) => `${(12 + u[0] * s + v[0] * t).toFixed(2)} ${(12 + u[1] * s + v[1] * t).toFixed(2)}`;
    d += `M${p(2.1, 0)}C${p(3.6, 3.4)} ${p(7.6, 2.9)} ${p(8, 0)}C${p(7.6, -2.9)} ${p(3.6, -3.4)} ${p(2.1, 0)}Z`;
  }
  return `${d}M10.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0Z`;
})();

const drupes = [[12, 8.2], [10.4, 10.4], [13.6, 10.4], [12, 12.6], [10.4, 14.8], [13.6, 14.8], [12, 17]]
  .map(([x, y]) => `M${x - 1.6} ${y}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0Z`).join('');

export const SPECIES_ICON: Record<SpeciesId, string> = {
  olive:
    'M4.5 19.5C8.4 15.6 12.6 11.4 18.5 5.5M8 16c-2.6-.2-4.2-1.7-4.4-3.6 2.4.1 4 1.5 4.4 3.6ZM10.6 13.4c2.5.3 4 1.8 4.2 3.8-2.4-.2-3.9-1.6-4.2-3.8ZM13.6 10.4c-2.4-.4-3.8-2-3.9-3.9 2.3.3 3.7 1.8 3.9 3.9ZM16 8v1.4M14.4 11.4a1.7 2 0 1 0 3.4 0a1.7 2 0 1 0-3.4 0Z',
  fig:
    'M12 5.6c.3 1.5 1.3 2.4 2.6 3.4 2.1 1.6 3.4 3.6 3.4 6.1 0 3.3-2.7 5.4-6 5.4s-6-2.1-6-5.4c0-2.5 1.3-4.5 3.4-6.1 1.3-1 2.3-1.9 2.6-3.4ZM12 5.6V3.4M12 4.4c1-1.3 2.4-1.8 3.8-1.6-.5 1.4-1.9 2.2-3.8 1.6ZM11.2 18.2h1.6',
  pomegranate:
    'M5.8 14.2a6.2 6.2 0 1 0 12.4 0a6.2 6.2 0 1 0-12.4 0ZM9.5 8.6 9.3 5.4l1.7 1.5L12 4.7l1 2.2 1.7-1.5-.2 3.2M8.7 12.3c.4-1.1 1.2-1.9 2.2-2.3',
  carob:
    'M4 17.6C9.6 19.6 16.6 15 20 6.6 15.6 11.6 10 15.4 4 17.6ZM20 6.6l.9-1.7M8.6 16.6h.01M11.9 15.1h.01M14.9 12.7h.01',
  almond: petals,
  mulberry: `${drupes}M12 6.6V3.6M12 4.6c1.4-1.2 3-1.4 4.4-.8-1.1 1.3-2.7 1.6-4.4.8Z`,
};

export const ICON = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  list: 'M9.5 6.5h10M9.5 12h10M9.5 17.5h10M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  map: 'M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5ZM9 4v13.5M15 6.5V20',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  lock: 'M7.5 11V8.2a4.5 4.5 0 0 1 9 0V11M5.8 11h12.4v9H5.8Z',
  arrow: 'M19 12H5M11 6l-6 6 6 6',
  move: 'M12 3.5v17M3.5 12h17M12 3.5 9.6 5.9M12 3.5l2.4 2.4M12 20.5l-2.4-2.4M12 20.5l2.4-2.4M3.5 12l2.4-2.4M3.5 12l2.4 2.4M20.5 12l-2.4-2.4M20.5 12l-2.4 2.4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0Z',
  sapling: 'M12 21v-8M12 13c0-3.6-2.6-6.1-6.5-6.1 0 3.7 2.7 6.1 6.5 6.1ZM12 15.6c0-3.1 2.3-5.4 5.8-5.4 0 3.2-2.4 5.4-5.8 5.4ZM7 21h10',
  bench: 'M4 13.5h16M5.5 13.5V19M18.5 13.5V19M5.5 9.8h13M5.5 6.6h13M6.6 6.6v6.9M17.4 6.6v6.9',
  table: 'M3.5 8.5h17M5.6 8.5 4.6 19M18.4 8.5l1 10.5M5.1 13.4h13.8',
  fire: 'M12 20.5c-3.3 0-5.5-2.2-5.5-5.1 0-3.4 3-5.1 3.6-8.9 2.3 1.5 3.4 3.3 3.5 5.4.8-.6 1.3-1.6 1.5-2.6 1.5 1.4 2.4 3.4 2.4 5.6 0 3.2-2.3 5.6-5.5 5.6ZM10.2 20.4c-.5-1.7.5-3.2 1.8-4.3 1.3 1.1 2.3 2.6 1.8 4.3',
  corner: 'M7 21V9.5M5 9.5h4l-.6-3H5.6ZM7 6.5V4.8M12 21h8.5M16.5 21v-3.6M16.5 17.4c0-2.4-1.7-4.2-4.2-4.2 0 2.4 1.7 4.2 4.2 4.2ZM16.5 18.8c0-2.2 1.5-3.8 3.7-3.8 0 2.2-1.5 3.8-3.7 3.8Z',
  people: 'M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19.5c.4-3 2.4-5 5-5s4.6 2 5 5M15.8 10.4a2.6 2.6 0 1 0 0-5.2M15.6 13.8c2.6.3 4.4 2.3 4.8 5.2',
} as const;
export type IconName = keyof typeof ICON;

export const svgIcon = (d: string, cls = 'icon') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
export const icon = (name: IconName, cls?: string) => svgIcon(ICON[name], cls);
export const speciesIcon = (s: SpeciesId, cls?: string) => svgIcon(SPECIES_ICON[s], cls);
