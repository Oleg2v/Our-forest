# Генераторы ассетов (не входят в сборку)

| скрипт | что делает | запуск |
|---|---|---|
| `../build-images.mjs` | фото: кадрирование, цветокор, AVIF/WebP/JPEG + LQIP → `public/img`, `src/content/images.json` | `node scripts/build-images.mjs --only <key>` |
| `hero/make-mask.mjs` + `mask-config.json` | маски ветра для фото героя → `public/img/hero-mask*.png` | `node scripts/tools/hero/make-mask.mjs <root> scripts/tools/hero/mask-config.json <key>` |
| `hero/render-video.mjs` | видео-петля героя для телефонов (H.264 + WebM) из шейдера через Playwright + ffmpeg → `public/video` | `node scripts/tools/hero/render-video.mjs public/video` (нужен запущенный dev-сервер) |
| `hero/rings.mjs` | геометрия колец прелоадера (inline SVG) | `node scripts/tools/hero/rings.mjs` |
| `map/gen-trees.ts` | детерминированная раскладка деревьев карты → `src/data/trees.json` | `node --experimental-strip-types scripts/tools/map/gen-trees.ts` |
| `tree/og.mjs` | OG-картинка страницы дерева 1200×630 | `node scripts/tools/tree/og.mjs '<dev-url>/tree/0427?state=visit&hours=10' <outdir>` → `public/og/tree-0427.jpg` |
