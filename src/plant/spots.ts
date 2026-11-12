/* Which places on the forest map fit the order: a tree → a free tree spot, a corner → a free corner,
   carpentry → a free bench / table / fire place (the chosen item's kind when the map has that kind).
   Used to check a ?spot= deep link and to give the map picker the right kinds. Reads the map's data file
   directly, so the map component itself loads only when someone opens it. */
import type { Spot, SpotKind } from '../components/forest-map';
import raw from '../data/trees.json';
import type { BenchItemId, Product } from './catalog';

const SPOTS = raw as unknown as Spot[];
const FURNITURE: SpotKind[] = ['bench', 'table', 'fire'];

export function spotKinds(product: Product, item: BenchItemId): SpotKind[] {
  if (product === 'corner') return ['corner'];
  if (product === 'bench') return (FURNITURE as string[]).includes(item) ? [item as SpotKind] : FURNITURE;
  return ['tree'];
}

/** the spot exists, is free and fits the product */
export function spotFits(id: string, product: Product, item: BenchItemId): boolean {
  if (!id || product === 'workshop') return false;
  const s = SPOTS.find((x) => x.id === id);
  return !!s && s.status === 'free' && spotKinds(product, item).includes(s.kind);
}
