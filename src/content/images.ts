/* JS access to the responsive image manifest (same data the HTML <img data-img> plugin uses). */
import manifest from './images.json';

export interface ImageEntry {
  pending?: boolean; w: number; h: number; color?: string; lqip?: string; alt?: string; purpose?: string;
  sources?: { avif?: [number, string][]; webp?: [number, string][]; jpg?: [number, string][] };
  credit?: { title?: string; author?: string; license?: string; licenseUrl?: string; source?: string };
}
export type ImageKey = keyof typeof manifest;
export const images = manifest as unknown as Record<ImageKey, ImageEntry>;

/** Best JPEG/WebP URL for a target pixel width (for WebGL textures, canvas, OG). */
export function imageUrl(key: ImageKey, targetW = 1600, format: 'jpg' | 'webp' | 'avif' = 'jpg'): string | null {
  const e = images[key];
  const list = e?.sources?.[format] ?? e?.sources?.jpg;
  if (!list?.length) return null;
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  return (sorted.find(([w]) => w >= targetW) ?? sorted[sorted.length - 1])[1];
}

/** Build a <picture> element in JS (for dynamic UI). */
export function pictureHtml(key: ImageKey, opts: { sizes?: string; className?: string; alt?: string; eager?: boolean } = {}): string {
  const e = images[key];
  const alt = (opts.alt ?? e?.alt ?? '').replace(/"/g, '&quot;');
  const style = `background-color:${e?.color ?? '#C9CFA0'};${e?.lqip ? `background-image:url(${e.lqip});background-size:cover;background-position:center;` : ''}`;
  const sizes = opts.sizes ?? '100vw';
  const cls = opts.className ? ` class="${opts.className}"` : '';
  if (!e || e.pending || !e.sources?.jpg?.length) {
    return `<img${cls} src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${e?.w ?? 16} ${e?.h ?? 10}'/>`)}" width="${e?.w ?? 1600}" height="${e?.h ?? 1000}" alt="${alt}" style="${style}">`;
  }
  const ss = (l?: [number, string][]) => (l ?? []).map(([w, u]) => `${u} ${w}w`).join(', ');
  const jpg = e.sources.jpg;
  return `<picture>${e.sources.avif ? `<source type="image/avif" srcset="${ss(e.sources.avif)}" sizes="${sizes}">` : ''}${e.sources.webp ? `<source type="image/webp" srcset="${ss(e.sources.webp)}" sizes="${sizes}">` : ''}<img${cls} src="${jpg[Math.min(1, jpg.length - 1)][1]}" srcset="${ss(jpg)}" sizes="${sizes}" width="${e.w}" height="${e.h}" alt="${alt}" loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async" style="${style}"></picture>`;
}
