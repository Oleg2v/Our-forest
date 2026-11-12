/* ==========================================================================
   "ההרבריום שלי" (7.9) — an old botanical book, no cartoon badges.
   Each season the visitor comes, a pressed leaf of that season is laid in: paper texture,
   embossed date, the species' own leaf shape. Four seasons → the stamp "שנה שלמה עם העץ".
   Special leaves: "הפרי הראשון", "ביקור ראשון ביער" (by the QR on the plaque, ?qr=1).
   The herbarium can be pre-ordered as a poster.
   ========================================================================== */
import { he } from '../../content/he';
import { ilDate, waLink, type Season } from '../../core/format';
import { gsap } from '../../core/gsap';
import { sound } from '../../core/sound';
import type { SpeciesId } from '../../components/forest-map';
import { SPECIES, SEASON_HE } from '../model';
import type { HerbLeaf } from './store';
import { icon } from './icons';
import type { Ctx } from './ctx';

const ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/* ------------------------------------------------------------------ leaf shapes */
interface Shape { lobes: [number, number][]; w: number; base: number; serr: number; aspect: number }
const SHAPES: Record<SpeciesId, Shape> = {
  fig: { lobes: [[-112, 0.6], [-56, 0.86], [0, 1], [56, 0.86], [112, 0.6]], w: 21, base: 0.34, serr: 0.012, aspect: 1 },
  mulberry: { lobes: [[0, 1]], w: 62, base: 0.2, serr: 0.022, aspect: 0.82 },
  almond: { lobes: [[0, 1]], w: 15, base: 0.08, serr: 0.01, aspect: 1 },
  olive: { lobes: [[0, 1]], w: 9, base: 0.05, serr: 0, aspect: 1 },
  pomegranate: { lobes: [[0, 1]], w: 16, base: 0.07, serr: 0, aspect: 1 },
  carob: { lobes: [[0, 1]], w: 46, base: 0.18, serr: 0, aspect: 1 },
};
function leafD(sh: Shape, R: number, cx = 0, cy = 0, rot = 0): string {
  const pts: string[] = [];
  const N = 140;
  const rr = (rot * Math.PI) / 180;
  for (let i = 0; i <= N; i++) {
    const th = -158 + (316 * i) / N;
    let lob = 0;
    for (const [c, l] of sh.lobes) lob = Math.max(lob, l * Math.exp(-(((th - c) / sh.w) ** 2)));
    const r = R * (sh.base + (1 - sh.base) * lob) * (1 + sh.serr * Math.sin(th * 2.4));
    const a = (th * Math.PI) / 180;
    // polar around the petiole base, 0° = up
    let x = Math.sin(a) * r * sh.aspect, y = -Math.cos(a) * r;
    const xr = x * Math.cos(rr) - y * Math.sin(rr), yr = x * Math.sin(rr) + y * Math.cos(rr);
    x = cx + xr; y = cy + yr;
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}
function veins(sh: Shape, R: number, cx: number, cy: number, rot = 0): string {
  const rr = (rot * Math.PI) / 180;
  const p = (x: number, y: number) => `${(cx + x * Math.cos(rr) - y * Math.sin(rr)).toFixed(1)} ${(cy + x * Math.sin(rr) + y * Math.cos(rr)).toFixed(1)}`;
  let d = '';
  for (const [c, l] of sh.lobes) {
    const a = (c * Math.PI) / 180;
    const len = R * l * 0.92;
    d += `M${p(0, 0)}L${p(Math.sin(a) * len * sh.aspect, -Math.cos(a) * len)}`;
    if (sh.lobes.length === 1) {
      for (let k = 1; k <= 4; k++) {
        const t = k / 5, y = -len * t, side = len * 0.32 * (1 - t * 0.6) * sh.aspect * (sh.w / 30);
        d += `M${p(0, y)}L${p(side, y - len * 0.09)}M${p(0, y)}L${p(-side, y - len * 0.09)}`;
      }
    }
  }
  return d;
}

/** a pressed specimen for a species & season, in a 120×150 box */
export function specimenSvg(sp: SpeciesId, season: Season | 'firstFruit' | 'firstVisit', uid: string): string {
  const evergreen = SPECIES[sp]?.evergreen;
  const sh = SHAPES[sp] ?? SHAPES.fig;
  const tint = season === 'firstFruit' || season === 'firstVisit' ? 'summer' : season;
  const filter = `url(#hb-paper-${uid})`;
  const defs = `<defs>
    <filter id="hb-paper-${uid}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${uid.length * 7}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1" result="a"/>
      <feComposite in="SourceGraphic" in2="a" operator="in" result="tex"/>
      <feBlend in="tex" in2="SourceGraphic" mode="multiply"/>
    </filter></defs>`;
  const twig = (d: string) => `<path class="hb-twig" d="${d}"/>`;
  let body = '';
  if (!evergreen && season === 'winter') {
    // deciduous in winter: a bare twig with a dormant bud
    body = twig('M60 140C60 112 58 86 62 54') + twig('M61 92C70 84 76 80 84 70') + twig('M60 112C52 104 46 100 40 92')
      + `<path class="hb-bud" d="M62 54c-3-6-3-11 0-16 3 5 3 10 0 16Z"/><path class="hb-bud" d="M84 70c1-6 4-10 9-12-1 6-4 10-9 12Z"/>`;
  } else if (sp === 'fig' || sp === 'mulberry' || sp === 'almond' && season !== 'spring') {
    const R = sp === 'almond' ? 64 : 54;
    const rot = sp === 'almond' ? -8 : -4;
    body = twig('M60 142C60 132 61 124 61 112')
      + `<path class="hb-leaf hb-leaf--${tint}" d="${leafD(sh, R, 61, 112, rot)}" filter="${filter}"/>`
      + `<path class="hb-vein" d="${veins(sh, R, 61, 112, rot)}"/>`;
  } else if (sp === 'almond' && season === 'spring') {
    body = twig('M60 142C60 120 62 96 66 70')
      + `<path class="hb-leaf hb-leaf--spring" d="${leafD(sh, 48, 63, 96, -40)}" filter="${filter}"/>`
      + `<path class="hb-leaf hb-leaf--spring" d="${leafD(sh, 44, 64, 82, 34)}" filter="${filter}"/>`
      + [0, 72, 144, 216, 288].map((a) => `<ellipse class="hb-petal" cx="${(66 + Math.sin(a * Math.PI / 180) * 7).toFixed(1)}" cy="${(62 - Math.cos(a * Math.PI / 180) * 7).toFixed(1)}" rx="5" ry="7" transform="rotate(${a} ${(66 + Math.sin(a * Math.PI / 180) * 7).toFixed(1)} ${(62 - Math.cos(a * Math.PI / 180) * 7).toFixed(1)})"/>`).join('');
  } else {
    // sprigs: olive & pomegranate pairs, carob pinnate
    const R = sp === 'carob' ? 17 : sp === 'pomegranate' ? 30 : 36;
    body = twig('M60 142C60 120 61 82 64 26');
    const n = sp === 'carob' ? 3 : 4;
    for (let k = 0; k < n; k++) {
      const y = 116 - k * (sp === 'carob' ? 30 : 24);
      const x = 60 + k * 1.1;
      for (const s of [-1, 1]) {
        const rot = s * (sp === 'carob' ? 90 : 52);
        const cx = x + s * (sp === 'carob' ? 4 : 2);
        body += `<path class="hb-leaf hb-leaf--${tint}" d="${leafD(sh, R, cx, y, rot)}" filter="${filter}"/>`;
      }
    }
    body += `<path class="hb-leaf hb-leaf--${tint}" d="${leafD(sh, R * 0.9, 64, 30, 4)}" filter="${filter}"/>`;
  }
  if (season === 'firstFruit') body += `<g class="hb-fruit"><path d="M86 118c-9 0-14-6-14-14 0-7 6-11 11-16 2-2 4-4 6-4s3 2 3 4c0 5 8 9 8 17 0 8-5 13-14 13Z" filter="${filter}"/><path class="hb-twig" d="M89 84c0-4 1-7 3-9"/></g>`;
  if (season === 'firstVisit') body += `<g class="hb-stamp" transform="translate(88 118) rotate(-12)"><circle r="17"/><circle r="13.5"/><text y="4" text-anchor="middle">פדיה</text></g>`;
  return `<svg class="hb-svg" viewBox="0 0 120 150" aria-hidden="true">${defs}<g class="hb-spec">${body}</g></svg>`;
}

/** where the drawing sits in its <svg> box (viewBox 120×150, "meet"): the px per viewBox unit and, in box px,
    the point at 50% / 80% of the drawing's own bounds — the pivot the fall used to have on the <g> */
function spot(svg: SVGSVGElement): { scale: number; origin: string } {
  const r = svg.getBoundingClientRect();
  const scale = Math.min(r.width / 120, r.height / 150) || 1;
  const ox = (r.width - 120 * scale) / 2, oy = (r.height - 150 * scale) / 2;
  let ux = 60, uy = 120;
  try {
    const b = svg.querySelector<SVGGraphicsElement>('.hb-spec')?.getBBox();
    if (b && b.width) { ux = b.x + b.width * 0.5; uy = b.y + b.height * 0.8; }
  } catch { /* not rendered */ }
  return { scale, origin: `${(ox + ux * scale).toFixed(1)}px ${(oy + uy * scale).toFixed(1)}px` };
}

/* ------------------------------------------------------------------ the book */
export class Herbarium {
  private root: HTMLElement;
  private book: HTMLElement;
  private io: IntersectionObserver | null = null;
  constructor(private ctx: Ctx) {
    this.root = ctx.main.querySelector<HTMLElement>('[data-herb]')!;
    this.book = this.root.querySelector<HTMLElement>('[data-herb-book]')!;
  }

  render() {
    const { ctx } = this;
    const memorial = ctx.demo.mode === 'memorial';
    this.root.hidden = memorial; // no badges or collecting in memorial mode
    if (memorial) return;
    const sp = ctx.tree.species;
    const info = SPECIES[sp] ?? SPECIES.fig;
    const leaves = ctx.store.data.herb;
    const year = Number((leaves.find((l) => l.season !== 'special')?.key ?? '2026').slice(0, 4));
    const bySeason = (s: Season) => leaves.filter((l) => l.season === s).sort((a, b) => b.date.localeCompare(a.date))[0];
    const seasonsHave = ORDER.filter((s) => bySeason(s)).length;
    const full = seasonsHave === 4;
    const sheet = (key: string, season: Season | 'firstFruit' | 'firstVisit', title: string, leaf: HerbLeaf | undefined, waiting: string) => `
      <figure class="hb-sheet${leaf ? ' is-filled' : ''}${leaf && !leaf.laid ? ' is-new' : ''}" data-key="${leaf?.key ?? key}">
        <span class="hb-sheet__no" aria-hidden="true"><bdi dir="ltr" lang="en">No. ${ctx.tree.id}</bdi></span>
        <div class="hb-sheet__spec">
          ${leaf ? specimenSvg(sp, season, `${key}`) : `<svg class="hb-svg hb-svg--empty" viewBox="0 0 120 150" aria-hidden="true"><path d="${leafD(SHAPES[sp] ?? SHAPES.fig, 48, 61, 116, -4)}"/></svg>`}
          ${leaf ? '<span class="hb-tape hb-tape--a" aria-hidden="true"></span><span class="hb-tape hb-tape--b" aria-hidden="true"></span>' : ''}
        </div>
        <figcaption class="hb-label">
          <span class="hb-label__t">${title}</span>
          ${leaf ? `<span class="hb-label__date"><bdi>${ilDate(leaf.date)}</bdi></span><span class="hb-label__latin" lang="la" dir="ltr">${info.latin}</span>` : `<span class="hb-label__wait">${waiting}</span>`}
        </figcaption>
      </figure>`;
    const firstFruit = leaves.find((l) => l.special === 'firstFruit');
    const firstVisit = leaves.find((l) => l.special === 'firstVisit');
    this.book.innerHTML = `
      <div class="hb-page hb-page--seasons">
        <p class="hb-page__head"><span>${info.he}</span><span class="hb-page__latin" lang="la" dir="ltr">${info.latin}</span></p>
        <div class="hb-grid">
          ${ORDER.map((s) => sheet(`season-${s}`, s, SEASON_HE[s], bySeason(s), `מחכה לביקור ב${SEASON_HE[s]}`)).join('')}
        </div>
        <p class="hb-page__foot"><bdi>${seasonsHave}</bdi> מתוך <bdi>4</bdi> עונות</p>
      </div>
      <div class="hb-page hb-page--special">
        <div class="hb-grid hb-grid--two">
          ${sheet('firstFruit', 'firstFruit', he.tree.herbarium.firstFruit, firstFruit, 'כשהעץ ייתן פרי ותבואו')}
          ${sheet('firstVisit', 'firstVisit', he.tree.herbarium.firstVisit, firstVisit, 'סורקים את הקוד על השלט ביער')}
        </div>
        <div class="hb-seal${full ? ' is-earned' : ''}" data-seal>
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <defs><path id="hb-seal-c" d="M80 80m-58 0a58 58 0 1 1 116 0a58 58 0 1 1-116 0"/></defs>
            <circle cx="80" cy="80" r="72"/><circle cx="80" cy="80" r="44"/>
            <text><textPath href="#hb-seal-c" startOffset="0">${he.tree.herbarium.fullYear} · ${he.tree.herbarium.fullYear} ·</textPath></text>
            <g transform="translate(68 68)"><path d="M4 20A16 16 0 0 1 20 4A16 16 0 0 1 4 20Z"/><path d="M3 21L15.5 8.5"/></g>
            <text class="hb-seal__year" x="80" y="114" text-anchor="middle">${year}</text>
          </svg>
          <p class="hb-seal__t">${full ? he.tree.herbarium.fullYear : `${he.tree.herbarium.fullYear}: עוד ${4 - seasonsHave === 1 ? 'עונה אחת' : `${4 - seasonsHave} עונות`}`}</p>
        </div>
        <div class="hb-poster">
          <p class="hb-poster__eyebrow">הזמנה מוקדמת</p>
          <p class="hb-poster__t">ההרבריום כפוסטר</p>
          <p class="hb-poster__d">כל העלים שאספתם, מודפסים על נייר עבה, עם מספר העץ והתאריכים.</p>
          <a class="btn btn--outline btn--sm" href="${waLink(`שלום! נשמח להזמין מראש את ההרבריום של עץ מס׳ ${ctx.tree.id} כפוסטר`)}" target="_blank" rel="noopener" data-track="herbarium_poster">${icon('frame')}<span>מזמינים מראש</span></a>
        </div>
      </div>`;
    this.watch();
  }

  /** lay the new leaves in when the book comes into view */
  private watch() {
    this.io?.disconnect();
    const fresh = [...this.book.querySelectorAll<HTMLElement>('.hb-sheet.is-new')];
    if (!fresh.length) return;
    const lay = () => {
      this.io?.disconnect();
      const motion = this.ctx.motion();
      fresh.forEach((s, i) => {
        const svg = s.querySelector<SVGSVGElement>('.hb-svg');
        const tapes = s.querySelectorAll('.hb-tape');
        const label = s.querySelectorAll('.hb-label > *');
        if (motion && svg) {
          // The leaf falls in on the outer <svg> (a box the compositor can move), not on the <g> inside it: an SVG
          // child's transform repaints the whole drawing every frame, its paper-grain filter (feTurbulence) included.
          // Same motion as before: 60 viewBox units of drop, the pivot at 50% / 80% of the drawing itself.
          const k = spot(svg);
          const tl = gsap.timeline({ delay: 0.3 + i * 0.35 });
          tl.call(() => sound.play('paper', { volume: 0.6 }))
            .fromTo(svg, { y: -60 * k.scale, rotation: -14, opacity: 0, transformOrigin: k.origin }, { y: 0, rotation: 0, opacity: 1, duration: 1.4, ease: 'expo.out', clearProps: 'transform' })
            .fromTo(tapes, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power3.out', stagger: 0.12 }, 0.8)
            .fromTo(label, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.9);
        } else if (svg) gsap.set(svg, { clearProps: 'opacity' }); // motion turned off meanwhile: no leaf left invisible
        s.classList.remove('is-new');
      });
      this.ctx.store.markLaid(fresh.map((s) => s.dataset.key ?? ''));
      const seal = this.book.querySelector<HTMLElement>('[data-seal].is-earned');
      if (seal && motion) gsap.fromTo(seal.querySelector('svg'), { scale: 1.35, opacity: 0, rotation: -24 }, { scale: 1, opacity: 1, rotation: -8, duration: 0.9, ease: 'power4.out', delay: 0.4 + fresh.length * 0.35 });
      this.ctx.announce(`עלה חדש נכנס להרבריום: ${fresh.map((s) => s.querySelector('.hb-label__t')?.textContent).join(', ')}`);
    };
    if (!('IntersectionObserver' in window)) { lay(); return; }
    if (this.ctx.motion()) fresh.forEach((s) => gsap.set(s.querySelector('.hb-svg'), { opacity: 0 }));
    this.io = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) lay(); }, { threshold: 0.3 });
    this.io.observe(this.book);
  }
}
