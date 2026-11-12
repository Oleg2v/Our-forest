// Copies self-hosted woff2 subsets (Hebrew + Latin) from @fontsource into /public/fonts
// and detect-gpu benchmark tables into /public/detect-gpu (so nothing is fetched from a CDN at runtime).
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const out = 'public/fonts';
mkdirSync(out, { recursive: true });
const fams = [
  ['@fontsource/heebo', 'heebo'],
  ['@fontsource/frank-ruhl-libre', 'frank-ruhl-libre'],
];
for (const [pkg, id] of fams) {
  for (const subset of ['hebrew', 'latin']) {
    for (const w of [300, 400, 500]) {
      const f = `${id}-${subset}-${w}-normal.woff2`;
      cpSync(join('node_modules', pkg, 'files', f), join(out, `${id}-${subset}-${w}.woff2`));
    }
  }
}
mkdirSync('public/detect-gpu', { recursive: true });
for (const f of readdirSync('node_modules/detect-gpu/dist/benchmarks')) {
  cpSync(join('node_modules/detect-gpu/dist/benchmarks', f), join('public/detect-gpu', f));
}
console.log('fonts + gpu benchmarks copied');
