/// <reference types="node" />
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ *
 * 1) HTML partials:  <!--#include partials/home/hero.html -->
 *    Paths are relative to the project root. Includes nest (depth 8).
 * 2) Responsive pictures:  <img data-img="hero" sizes="100vw" class="x" alt-override="…">
 *    expands to <picture> with AVIF/WebP/JPEG srcsets from src/content/images.json,
 *    width/height (no CLS) and a blurred LQIP background. Missing/pending entries
 *    render a sized, coloured placeholder so layouts never jump.
 * ------------------------------------------------------------------ */

const INCLUDE_RE = /<!--\s*#include\s+([\w./-]+)\s*-->/g;
function expandIncludes(html: string, depth = 0): string {
  if (depth > 8) return html;
  return html.replace(INCLUDE_RE, (_m, p: string) => {
    const file = resolve(root, p);
    if (!existsSync(file)) return `<!-- include not found: ${p} -->`;
    return expandIncludes(readFileSync(file, 'utf8'), depth + 1);
  });
}

type ImgEntry = {
  alt?: string; w: number; h: number; color?: string; lqip?: string; pending?: boolean;
  sources?: { avif?: [number, string][]; webp?: [number, string][]; jpg?: [number, string][] };
};
function loadManifest(): Record<string, ImgEntry> {
  try { return JSON.parse(readFileSync(resolve(root, 'src/content/images.json'), 'utf8')); } catch { return {}; }
}
const ATTR_RE = /([\w:-]+)(?:\s*=\s*"([^"]*)")?/g;
function parseAttrs(s: string) {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(ATTR_RE)) out[m[1]] = m[2] ?? '';
  return out;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function srcset(list?: [number, string][]) { return (list ?? []).map(([w, u]) => `${u} ${w}w`).join(', '); }

const IMG_RE = /<img\b([^>]*?\bdata-img="[^"]+"[^>]*?)\/?>/g;
function expandPictures(html: string): string {
  const manifest = loadManifest();
  return html.replace(IMG_RE, (_m, rawAttrs: string) => {
    const a = parseAttrs(rawAttrs);
    const key = a['data-img'];
    const e = manifest[key];
    const sizes = a.sizes || '100vw';
    const eager = 'data-eager' in a || a.loading === 'eager';
    const pictureClass = a['data-picture-class'];
    const alt = a.alt ?? e?.alt ?? '';
    const pass = Object.entries(a)
      .filter(([k]) => !['data-img', 'sizes', 'alt', 'loading', 'decoding', 'data-picture-class', 'src', 'srcset', 'width', 'height', 'style'].includes(k))
      .map(([k, v]) => (v === '' ? k : `${k}="${esc(v)}"`)).join(' ');
    const w = e?.w ?? 1600, h = e?.h ?? 1067;
    const bg = e?.lqip ? `background-image:url(${e.lqip});background-size:cover;background-position:center;` : '';
    const style = `${bg}background-color:${e?.color ?? '#C9CFA0'};${a.style ?? ''}`;
    const loading = eager ? 'eager' : 'lazy';
    const prio = eager ? ' fetchpriority="high"' : '';
    if (!e || e.pending || !e.sources?.jpg?.length) {
      const svg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"/>`)}`;
      return `<img data-img-key="${esc(key)}" data-img-pending src="${svg}" width="${w}" height="${h}" alt="${esc(alt)}" style="${esc(style)}" ${pass}>`;
    }
    const jpg = e.sources.jpg;
    const fallback = jpg[Math.min(1, jpg.length - 1)][1];
    const sources = [
      e.sources.avif?.length ? `<source type="image/avif" srcset="${srcset(e.sources.avif)}" sizes="${esc(sizes)}">` : '',
      e.sources.webp?.length ? `<source type="image/webp" srcset="${srcset(e.sources.webp)}" sizes="${esc(sizes)}">` : '',
    ].join('');
    return `<picture${pictureClass ? ` class="${esc(pictureClass)}"` : ''}>${sources}<img data-img-key="${esc(key)}" src="${fallback}" srcset="${srcset(jpg)}" sizes="${esc(sizes)}" width="${w}" height="${h}" alt="${esc(alt)}" loading="${loading}" decoding="async"${prio} style="${esc(style)}" ${pass}></picture>`;
  });
}

/* Clean URLs in dev/preview: /plant → /plant/ (index.html), /tree/0427 → /tree/0427/,
   unknown page routes → /404.html. Static hosts do the same in production. */
function cleanUrls(): import('vite').Connect.NextHandleFunction {
  return (req, _res, next) => {
    const [path, query] = (req.url ?? '/').split('?');
    if (path.includes('.') || path.startsWith('/@') || path.startsWith('/src/') || path.startsWith('/node_modules/')) return next();
    const clean = path.endsWith('/') ? path : `${path}/`;
    if (existsSync(resolve(root, `.${clean}index.html`))) {
      req.url = `${clean}${query ? `?${query}` : ''}`;
    } else if (path !== '/') {
      req.url = '/404.html';
    }
    next();
  };
}

function htmlComposer(): Plugin {
  let server: ViteDevServer | undefined;
  return {
    name: 'our-forest-html-composer',
    configurePreviewServer(s) {
      s.middlewares.use((req, res, next) => {
        const [path, query] = (req.url ?? '/').split('?');
        if (path.includes('.') || path === '/') return next();
        const clean = path.endsWith('/') ? path : `${path}/`;
        const dist = resolve(root, s.config.build.outDir);
        if (existsSync(resolve(dist, `.${clean}index.html`))) { req.url = `${clean}${query ? `?${query}` : ''}`; return next(); }
        req.url = '/404.html'; res.statusCode = 404; next();
      });
    },
    configureServer(s) {
      s.middlewares.use(cleanUrls());
      server = s;
      s.watcher.add([resolve(root, 'partials'), resolve(root, 'src/content/images.json')]);
      s.watcher.on('change', (f) => {
        if (f.includes(`${'/'}partials${'/'}`) || f.endsWith('images.json')) server?.ws.send({ type: 'full-reload' });
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) { return expandPictures(expandIncludes(html)); },
    },
  };
}

const pages = {
  main: 'index.html',
  plant: 'plant/index.html',
  tree: 'tree/0427/index.html',
  business: 'business/index.html',
  notFound: '404.html',
  terms: 'legal/terms/index.html',
  privacy: 'legal/privacy/index.html',
  accessibility: 'legal/accessibility/index.html',
  credits: 'credits/index.html',
};

export default defineConfig({
  appType: 'mpa',
  plugins: [htmlComposer()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, resolve(root, v)])),
    },
  },
  server: { host: true },
  preview: { host: true },
});
