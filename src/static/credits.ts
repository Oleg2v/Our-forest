/* Credits page: photo credits rendered at runtime from src/content/images.json (credit fields are
   filled by the assets agent). Same photo used twice (e.g. hero + its portrait crop) is listed once
   with both places. Pending images are counted, not listed. */
import manifest from '../content/images.json';
import { pictureHtml, type ImageKey, type ImageEntry } from '../content/images';
import { qs } from './util';
import './credits.css';

const PLACES: [RegExp, string][] = [
  [/^hero/, 'עמוד הבית · הפתיחה'],
  [/^roots/, 'עמוד הבית · מתחת לפני השטח'],
  [/^exp/, 'עמוד הבית · קונים חוויה'],
  [/^ws/, 'עמוד הבית · הסדנאות הקרובות'],
  [/^companies$/, 'עמוד הבית · חברות'],
  [/^biz/, 'לחברות וארגונים'],
  [/^tree/, 'עמוד העץ'],
  [/^forest/, 'היער'],
];
const placeOf = (key: string) => PLACES.find(([re]) => re.test(key))?.[1] ?? '';

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeUrl = (u?: string) => (u && /^https?:\/\//.test(u) ? u : '');
function sourceName(u: string) {
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    if (h.includes('wikimedia')) return 'Wikimedia Commons';
    if (h.includes('flickr')) return 'Flickr';
    if (h.includes('unsplash')) return 'Unsplash';
    if (h.includes('pexels')) return 'Pexels';
    return h;
  } catch { return ''; }
}

export function initCredits() {
  const list = qs<HTMLElement>('[data-credits-photos]');
  const summary = qs<HTMLElement>('[data-credits-summary]');
  if (!list) return;
  const entries = Object.entries(manifest as unknown as Record<string, ImageEntry>);
  const groups = new Map<string, { keys: string[]; e: ImageEntry }>();
  let pending = 0;
  let missing = 0;
  for (const [key, e] of entries) {
    if (e.pending || !e.sources?.jpg?.length) { pending++; continue; }
    if (!e.credit) { missing++; continue; }
    const id = e.credit.source || e.credit.title || key;
    const g = groups.get(id);
    if (g) g.keys.push(key); else groups.set(id, { keys: [key], e });
  }

  const items = Array.from(groups.values()).map(({ keys, e }) => {
    const c = e.credit!;
    const places = Array.from(new Set(keys.map(placeOf).filter(Boolean)));
    const src = safeUrl(c.source);
    const lic = safeUrl(c.licenseUrl);
    return `<li class="credits__photo">
      <div class="credits__thumb">${pictureHtml(keys[0] as ImageKey, { sizes: '96px', alt: '' })}</div>
      <div class="credits__meta">
        <p class="credits__title" lang="en" dir="ltr">${esc(c.title || '')}</p>
        <p class="credits__who">צילום: <bdi lang="en">${esc(c.author || 'לא ידוע')}</bdi></p>
        <p class="credits__links">
          ${lic ? `<a href="${esc(lic)}" target="_blank" rel="noopener license" lang="en"><bdi>${esc(c.license || 'License')}</bdi></a>` : `<bdi lang="en">${esc(c.license || '')}</bdi>`}
          ${src ? `<a href="${esc(src)}" target="_blank" rel="noopener"><bdi lang="en">${esc(sourceName(src))}</bdi></a>` : ''}
        </p>
        ${places.length ? `<p class="credits__where">${places.map(esc).join(' · ')}</p>` : ''}
      </div>
    </li>`;
  });
  list.innerHTML = items.join('');

  if (summary) {
    const n = groups.size;
    const parts = [n === 1 ? 'צילום אחד' : `${n} צילומים`];
    let text = `באתר ${parts[0]} בתנאי רישיונות פתוחים. תודה לצלמים.`;
    if (!n) text = 'הצילומים באתר עדיין זמניים, והקרדיטים שלהם יופיעו כאן.';
    if (pending) text += ` ${pending === 1 ? 'תמונה אחת עדיין זמנית' : `${pending} תמונות עדיין זמניות`} ומחכה לצילום של היער.`;
    if (missing) text += ` לעוד ${missing} חסרים פרטי קרדיט, והם יתווספו כאן.`;
    summary.textContent = text;
  }
}
