/* ==========================================================================
   Forest map — CONTRACT (owned by the home "map" agent).
   Illustrated plan of the plot (inline SVG): paths, fire place, kitchen, dog yard, tree rows.
   Data: src/data/trees.json. Three states: planted (olive crown), reserved (outline),
   free (--fruit ring, soft pulse). Clusters when zoomed out. Zoom/pan only after a click
   on the map (never hijack page scroll). Text list of trees for screen readers.
   mode 'home'   — full map with filters, hover cards, click free spot → /plant?spot=ID
   mode 'picker' — used inside the configurator step "איפה הוא יגדל?": only free spots
                   are selectable; onSelect(spot) is called; no navigation.
   STUB until implemented.
   ========================================================================== */
export type SpotStatus = 'planted' | 'reserved' | 'free';
export type SpotKind = 'tree' | 'bench' | 'corner' | 'fire' | 'table';
export type SpeciesId = 'olive' | 'fig' | 'pomegranate' | 'carob' | 'almond' | 'mulberry';
export interface Spot {
  id: string;            // "0427"
  kind: SpotKind;
  status: SpotStatus;
  x: number; y: number;  // map coordinates (viewBox units)
  species?: SpeciesId;
  occasion?: string;     // occasion id (see he.plant.occasions)
  dedication?: string;
  plantedBy?: string;
  date?: string;         // ISO yyyy-mm-dd
  public?: boolean;      // is the dedication public
}
export interface ForestMapHandle {
  destroy(): void;
  select(id: string): void;
  getSelected(): Spot | null;
}
export function createForestMap(
  _el: HTMLElement,
  _opts: { mode: 'home' | 'picker'; onSelect?: (spot: Spot) => void; initialSpotId?: string } = { mode: 'home' },
): ForestMapHandle {
  return { destroy() {}, select() {}, getSelected: () => null };
}
