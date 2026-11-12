/* The stage: sticky visual summary. One idea — the scene assembles as you configure:
   the chosen species grows from a sapling (MorphSVG trunk + crown, roots draw under the
   ground), the plaque stands at its foot and burns live, extras appear around the tree,
   a paper tag hangs from a branch when it is a gift. */
import { he } from '../content/he';
import { priceHtml, ilDate } from '../core/format';
import { pictureHtml } from '../content/images';
import { gsap, EASE } from '../core/gsap';
import { sound } from '../core/sound';
import type { SpeciesId } from '../components/forest-map';
import { SAPLING, SPECIES_ART, TREE_VB, GROUND, GRASS, ROOTS, ICONS, icon, type IconName } from './art';
import { createOdometer, type Odometer } from './odometer';
import { summaryRows } from './steps-flow';
import { speciesText, stepShort, WORKSHOPS, type StepId, type ExtraId, type BenchItemId, type WorkshopId } from './catalog';
import type { PlantState } from './store';
import type { Ctx } from './types';

const NS = 'vector-effect="non-scaling-stroke"';
const BIRD = 'M0 0 C3 -4.5 8 -4.5 10.5 -1 L15 -2.8 L12.6 1 C11.4 4.4 6.2 5.6 1.6 3.6 Z M8 -1.6 l0.01 0 M4 1 C5.5 -1 7.5 -1.2 9 0';

/* scene props (stage coordinates, ground y = 214) */
const PROPS: Record<ExtraId, { icon: IconName; t: string }> = {
  family: { icon: 'family', t: 'translate(198 181) scale(1.38)' },
  guardians: { icon: 'can', t: 'translate(14 190) scale(1.05)' },
  certificate: { icon: 'certificate', t: 'translate(44 194) rotate(-7) scale(0.86)' },
  box: { icon: 'box', t: 'translate(173 195) scale(0.82)' },
};
/* corner mode: the corner's own parts sit on the left of the plaque (bench, two herb pots) and the lantern
   hangs in front of the crown's lower edge, so the extras keep their own room and nothing overlaps:
   left 16–52 bench + herbs · 54–69 watering can · plaque 70–168 · right 171–223 certificate, box, family */
const CORNER_PROPS: { icon: IconName; t: string; hang?: string }[] = [
  { icon: 'bench', t: 'translate(12.5 191) scale(1.15)' },
  { icon: 'herbs', t: 'translate(33 198.2) scale(0.72)' },
  { icon: 'herbs', t: 'translate(42.3 200.7) scale(0.6)' },
  { icon: 'lantern', t: 'translate(68.8 153.2) scale(1.1)', hang: 'M82 136 V157' },
];
const PROPS_CORNER: Record<ExtraId, { icon: IconName; t: string }> = {
  family: { icon: 'family', t: 'translate(199.8 189) scale(1.2)' },
  guardians: { icon: 'can', t: 'translate(49.3 195) scale(0.95)' },
  certificate: { icon: 'certificate', t: 'translate(168.2 197) rotate(-7) scale(0.8)' },
  box: { icon: 'box', t: 'translate(184.7 197.4) scale(0.78)' },
};

/* carpentry: the piece itself, drawn in the stage's coordinates (ground y = 214) in front of the olive, which steps
   aside (.pst__grove, plant.css). Wood parts are filled, so no line of the tree shows through them. The plaque is
   mounted on the piece (positions in plant.css, [data-item]). */
const W = `class="pst__wood" ${NS}`, G = `class="pst__grain" ${NS}`;
const BUILD_ART: Record<BenchItemId, string> = {
  bench: `<path ${W} d="M42 140h6v74h-6z M136 140h6v74h-6z"/>
    <path ${W} d="M34 144h116v11H34z M34 158h116v11H34z"/>
    <path ${W} d="M26 176h132v8H26z"/>
    <path ${G} d="M38 149.5h14 M130 163.5h14 M32 180h16 M134 180h18"/>`,
  table: `<path ${W} d="M38 174h7v40h-7z M139 174h7v40h-7z"/>
    <path ${G} d="M45 201h94"/>
    <path ${W} d="M30 168h124v8H30z"/>
    <path ${W} d="M20 159h144v9H20z"/>
    <path ${G} d="M28 163.5h22 M118 163.5h36 M66 176v3 M118 176v3"/>`,
  fire: `<path class="pst__flame" ${NS} d="M104 158c7 8 12 15 12 24a12 12 0 0 1-24 0c0-7 3-10 6-14 1 5 3 7 6 8 0-7-1-12 0-18z"/>
    <path class="pst__sticks" ${NS} d="M88 207 L104 176 M120 207 L104 176 M98 208 L108 178"/>
    <path class="pst__wood pst__stone" ${NS} d="M72 214c0-6 4-9 9-9s8 3 8 9z M88 214c0-7 5-10 10-10s9 3 9 10z M106 214c0-6 4-9 9-9s9 3 9 9z M123 214c0-5 3-8 7-8s7 3 7 8z"/>`,
  kitchen: `<path ${W} d="M30 170h120v44H30z"/>
    <path ${W} d="M24 163h132v8H24z"/>
    <path ${G} d="M38 178v28 M142 178v28"/>
    <path class="pst__wood pst__stone" ${NS} d="M40 147h24v16H40z"/>
    <path ${G} d="M36 147h32 M52 147v-4 M48 143h8 M118 163v-14 M118 149c-4-4-4-9 0-12 4 3 4 8 0 12z M126 163v-10 M126 153c3-3 3-7 0-9-3 2-3 6 0 9z"/>`,
  class: `<path ${W} d="M34 120h7v94h-7z M143 120h7v94h-7z"/>
    <path ${G} d="M28 111l-7-9 M52 111l-7-9 M76 111l-7-9 M100 111l-7-9 M124 111l-7-9 M148 111l-7-9 M66 120v6 M118 120v6"/>
    <path ${W} d="M22 111h140v9H22z"/>
    <path ${W} d="M52 194h80v6H52z"/>
    <path ${G} d="M58 200v14 M126 200v14"/>`,
};
const WS_IMG: Record<WorkshopId, 'wsCarpentry' | 'wsDogs' | 'wsGarden'> = { carpentry: 'wsCarpentry', dogs: 'wsDogs', garden: 'wsGarden' };
const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'long' });

export interface Stage {
  el: HTMLElement;
  plaqueHome: HTMLElement;
  update(s: PlantState, prev: PlantState | null): void;
  setStep(step: StepId): void;
  setMotion(allowed: boolean): void;
}

export function createStage(ctx: Ctx, host: HTMLElement): Stage {
  host.innerHTML = `
    <div class="pst">
      <div class="pst__scene" data-focus="">
        <p class="pst__season">${icon('calendar')}<span>${he.seasonalBanner}</span></p>
        <div class="pst__ws" hidden><div class="pst__ws-ph"></div><p class="pst__ws-meta"></p></div>
        <div class="pst__art">
        <svg class="pst__svg" viewBox="${TREE_VB}" aria-hidden="true" focusable="false">
          <path class="pst__ground" d="${GROUND}" ${NS}/>
          <path class="pst__grass" d="${GRASS}" ${NS}/>
          <g class="pst__grove">
            <path class="pst__roots" d="${ROOTS}" ${NS}/>
            <g class="pst__tree">
              <path class="pst__trunk" d="${SAPLING.trunk}" ${NS}/>
              <path class="pst__crown" d="${SAPLING.crown}" ${NS}/>
              <g class="pst__marks"></g>
              <g class="pst__details"></g>
            </g>
            <g class="pst__tag" opacity="0">
              <path d="M156 146 L160 170" ${NS}/>
              <g transform="translate(152 168) rotate(10)"><path class="pst__tagcard" d="M0 0 h20 l5 6.5 l-5 6.5 h-20 Z M19 6.5 a1.6 1.6 0 1 0 0.01 0" ${NS}/><path d="M4 6.5 h9" ${NS}/></g>
            </g>
            <g class="pst__bird" data-playful opacity="0"><g transform="translate(150 54)"><path d="${BIRD}" ${NS}/></g></g>
          </g>
          <g class="pst__build"></g>
          <g class="pst__corner"></g>
          <g class="pst__props"></g>
        </svg>
        <div class="pst__plaque">
          <div class="pst__glow" aria-hidden="true"></div>
          <span class="pst__stake" aria-hidden="true"></span>
          <div class="pst__plaque-home" data-plaque-home></div>
        </div>
        <p class="pst__pin" hidden></p>
        </div>
      </div>
      <div class="pst__info">
        <div class="pst__head"><p class="pst__name"></p><p class="pst__sub"></p></div>
        <dl class="pst__lines"></dl>
        <div class="pst__total">
          <span class="pst__tl">${he.plant.summary.total}</span>
          <span class="pst__odo price"></span>
          <span class="pst__monthly"></span>
        </div>
        <button type="button" class="btn btn--fruit btn--lg pst__cta" data-cursor="שתלו" data-cursor-fill="fruit" data-magnetic>
          <span>${he.plant.summary.checkout}</span>${icon('fwd', 'icon arrow-fwd')}
        </button>
        <p class="pst__trust">${icon('guarantee')}<span>${he.plant.includes.items[5]}</span></p>
      </div>
    </div>`;
  const q = <T extends Element>(s: string) => host.querySelector<T>(s)!;
  const svg = q<SVGSVGElement>('.pst__svg');
  const trunk = q<SVGPathElement>('.pst__trunk');
  const crown = q<SVGPathElement>('.pst__crown');
  const marks = q<SVGGElement>('.pst__marks');
  const details = q<SVGGElement>('.pst__details');
  const roots = q<SVGPathElement>('.pst__roots');
  const props = q<SVGGElement>('.pst__props');
  const corner = q<SVGGElement>('.pst__corner');
  const tag = q<SVGGElement>('.pst__tag');
  const bird = q<SVGGElement>('.pst__bird');
  const build = q<SVGGElement>('.pst__build');
  const wsBox = q<HTMLElement>('.pst__ws');
  const wsPh = q<HTMLElement>('.pst__ws-ph');
  const wsMeta = q<HTMLElement>('.pst__ws-meta');
  const season = q<HTMLElement>('.pst__season');
  const scene = q<HTMLElement>('.pst__scene');
  const pin = q<HTMLElement>('.pst__pin');
  const lines = q<HTMLElement>('.pst__lines');
  const monthly = q<HTMLElement>('.pst__monthly');
  const name = q<HTMLElement>('.pst__name');
  const sub = q<HTMLElement>('.pst__sub');
  const odo: Odometer = createOdometer(q<HTMLElement>('.pst__odo'), ctx.pricing().total, { motion: ctx.motion, speed: ctx.speed });

  let grown: SpeciesId | null = null;
  let growTl: gsap.core.Timeline | null = null;
  let shownProps = new Set<string>();

  const fillDetails = (sp: SpeciesId) => {
    const a = SPECIES_ART[sp];
    marks.innerHTML = a.marks.map((d) => `<path d="${d}" ${NS}/>`).join('');
    details.innerHTML = a.details.map((d) => `<path d="${d}" ${NS}/>`).join('');
  };

  const growTo = (sp: SpeciesId, first: boolean) => {
    if (grown === sp) return;
    const a = SPECIES_ART[sp];
    growTl?.kill();
    if (!ctx.motion()) {
      trunk.setAttribute('d', a.trunk); crown.setAttribute('d', a.crown);
      fillDetails(sp); grown = sp;
      gsap.set([marks, details, roots], { clearProps: 'all' });
      gsap.set(bird, { opacity: 0 });
      return;
    }
    const sp1 = ctx.speed();
    const tl = gsap.timeline();
    growTl = tl;
    if (grown) {
      // back to a sapling first (quick), then grow the new one
      tl.to([details, marks], { opacity: 0, duration: 0.25 * sp1, ease: 'power2.out' })
        .to(bird, { opacity: 0, y: -14, x: 10, duration: 0.3, ease: 'power2.in' }, 0)
        .to(trunk, { morphSVG: SAPLING.trunk, duration: 0.5 * sp1, ease: 'power3.inOut' }, 0.05)
        .to(crown, { morphSVG: SAPLING.crown, duration: 0.5 * sp1, ease: 'power3.inOut' }, 0.05)
        .to(roots, { drawSVG: '0% 12%', duration: 0.4 * sp1, ease: 'power2.inOut' }, 0.05);
    } else {
      tl.set(trunk, { attr: { d: SAPLING.trunk } }).set(crown, { attr: { d: SAPLING.crown } }).set(roots, { drawSVG: '0% 0%' })
        .set([details, marks], { opacity: 0 });
      if (first) tl.fromTo([trunk, crown], { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.6, ease: EASE.appear });
    }
    tl.add(() => { fillDetails(sp); gsap.set(details.children, { opacity: 0 }); sound.play('rustle', { volume: 0.5 }); })
      .to(trunk, { morphSVG: a.trunk, duration: 1.3 * sp1, ease: 'expo.out' })
      .to(crown, { morphSVG: a.crown, duration: 1.5 * sp1, ease: 'expo.out' }, '<0.12')
      .to(roots, { drawSVG: '0% 100%', duration: 1.4 * sp1, ease: 'power3.out' }, '<')
      .to(marks, { opacity: 1, duration: 0.8 * sp1 }, '<0.5')
      .set(details, { opacity: 1 }, '<')
      .add(() => {
        gsap.fromTo(Array.from(details.children), { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' },
          { opacity: 1, scale: 1, duration: 0.7 * sp1, stagger: { each: 0.035 * sp1, from: 'random' }, ease: ctx.memorial() ? EASE.soft : 'back.out(2.2)' });
      }, '<0.1');
    if (!ctx.memorial()) {
      tl.fromTo(bird, { opacity: 0, y: -26, x: -18 }, { opacity: 1, y: 0, x: 0, duration: 0.9, ease: 'power3.out' }, '-=0.2')
        .to(bird.firstElementChild, { y: -2, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' });
    }
    grown = sp;
  };

  let propsLayout = '';
  const setProps = (s: PlantState) => {
    const want = new Set<string>(s.product === 'workshop' ? [] : s.extras);
    const layout = s.product === 'corner' ? PROPS_CORNER : PROPS;
    // tree ↔ corner: the extras move to the other layout (re-drawn in place, no animation)
    if (propsLayout !== s.product) {
      propsLayout = s.product;
      props.querySelectorAll<SVGGElement>('[data-prop]').forEach((g) => {
        const p = layout[g.dataset.prop as ExtraId];
        g.firstElementChild?.setAttribute('transform', p.t);
      });
    }
    // remove
    props.querySelectorAll<SVGGElement>('[data-prop]').forEach((g) => {
      if (want.has(g.dataset.prop!)) return;
      if (ctx.motion()) gsap.to(g, { opacity: 0, y: 6, duration: 0.3, onComplete: () => g.remove() });
      else g.remove();
      shownProps.delete(g.dataset.prop!);
    });
    // add
    for (const id of want) {
      if (shownProps.has(id)) continue;
      shownProps.add(id);
      const p = layout[id as ExtraId];
      const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      wrap.dataset.prop = id;
      wrap.innerHTML = `<g transform="${p.t}"><path d="${ICONS[p.icon]}" ${NS}/></g>`;
      props.appendChild(wrap);
      if (ctx.motion()) {
        const path = wrap.querySelector('path')!;
        gsap.fromTo(path, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.1 * ctx.speed(), ease: 'power2.inOut' });
        gsap.fromTo(wrap, { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 * ctx.speed(), ease: ctx.memorial() ? EASE.soft : EASE.game });
      }
    }
  };

  const setCorner = (on: boolean) => {
    if (!on) { corner.innerHTML = ''; return; }
    if (corner.childElementCount) return;
    corner.innerHTML = CORNER_PROPS.map((p) => `${p.hang ? `<path d="${p.hang}" ${NS}/>` : ''}<g transform="${p.t}"><path d="${ICONS[p.icon]}" ${NS}/></g>`).join('');
    if (ctx.motion()) gsap.fromTo(corner.querySelectorAll('path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2, stagger: 0.12, ease: 'power2.inOut' });
  };

  /** carpentry: the piece draws itself in front of the olive (lines first, then the wood fills in) */
  const setItem = (s: PlantState) => {
    const key = s.product === 'bench' ? s.item : '';
    if (build.dataset.item === key) return;
    build.dataset.item = key;
    host.dataset.item = key;
    build.innerHTML = key ? BUILD_ART[s.item] : '';
    if (key && ctx.motion()) {
      const sp = ctx.speed();
      const paths = build.querySelectorAll('path');
      gsap.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2 * sp, stagger: 0.08 * sp, ease: 'power2.inOut' });
      gsap.fromTo(build.querySelectorAll('.pst__wood, .pst__flame'), { fillOpacity: 0 }, { fillOpacity: 1, duration: 0.7 * sp, delay: 0.7 * sp, ease: 'power1.out' });
    }
  };

  /** a workshop: its photo in a leaf, with the chosen date and the number of places */
  const setWorkshop = (s: PlantState, prev: PlantState | null) => {
    const on = s.product === 'workshop';
    wsBox.hidden = !on;
    if (!on) { wsPh.dataset.ws = ''; return; }
    const d = new Date(`${s.date}T12:00:00`);
    wsMeta.innerHTML = `<span>${icon('calendar')}<span>${weekday.format(d)}, <bdi>${ilDate(d)}</bdi> · <bdi>09:00</bdi></span></span>`
      + `<span>${icon('users')}<span><bdi>${s.seats}</bdi> ${s.seats === 1 ? 'משתתף' : 'משתתפים'}</span></span>`;
    if (wsPh.dataset.ws === s.ws) return;
    wsPh.dataset.ws = s.ws;
    const old = Array.from(wsPh.children);
    wsPh.insertAdjacentHTML('beforeend', `<div class="pst__ws-img">${pictureHtml(WS_IMG[s.ws], { sizes: '(max-width: 768px) 100vw, 40vw', className: 'cover', alt: '', eager: true })}</div>`);
    const fresh = wsPh.lastElementChild as HTMLElement;
    if (ctx.motion() && prev) {
      gsap.fromTo(fresh, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.9, ease: EASE.appear, onComplete: () => old.forEach((o) => o.remove()) });
    } else old.forEach((o) => o.remove());
  };

  const setTag = (s: PlantState, prev: PlantState | null) => {
    const on = s.gift && s.product !== 'workshop';
    if (!!prev && prev.gift === s.gift && prev.product === s.product) return;
    if (!ctx.motion()) { gsap.set(tag, { opacity: on ? 1 : 0 }); return; }
    if (on) {
      gsap.fromTo(tag, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.8 * ctx.speed(), ease: EASE.appear });
      if (!ctx.memorial()) gsap.fromTo(tag.querySelector('g'), { rotate: 22, transformOrigin: '0px 0px' }, { rotate: 10, duration: 1.6, ease: 'elastic.out(1, 0.35)' });
    } else gsap.to(tag, { opacity: 0, duration: 0.3 });
  };

  const paintInfo = (s: PlantState) => {
    const pr = ctx.pricing(s);
    name.textContent = ctx.mainLabel(s);
    if (s.product === 'tree' || s.product === 'corner') sub.textContent = speciesText(s.species);
    else if (s.product === 'workshop') sub.innerHTML = `${priceHtml(WORKSHOPS.find((w) => w.id === s.ws)!.price)} ${he.pricing.perParticipant}`;
    else sub.textContent = he.participate.cards[1].title;
    // compact: all extras in one row
    const rows = summaryRows(ctx, s).slice(1);
    const ex = rows.filter((r) => r.step === 'extras');
    const compact = rows.filter((r) => r.step !== 'extras');
    if (ex.length) {
      const extras = pr.lines.filter((l) => l.id !== 'main');
      const once = extras.filter((l) => !l.monthly).reduce((a, l) => a + l.amount, 0);
      const at = compact.findIndex((r) => r.step === 'gift');
      compact.splice(at < 0 ? compact.length : at, 0, {
        step: 'extras', label: stepShort('extras', s.product),
        value: extras.map((l) => l.label).join(' · '),
        price: once ? priceHtml(once) : undefined,
      });
    }
    // each value is a button back to its step: its name says so ("שינוי שלט: …"), a pencil shows on hover / focus
    lines.innerHTML = compact.map((r) => `
      <div class="pst__line"><dt>${r.label || '<span class="sr-only">תוספת</span>'}</dt>
      <dd><button type="button" class="pst__go" data-go="${r.step}"><span class="sr-only">שינוי ${r.label || stepShort(r.step, s.product)}: </span><span class="pst__v">${r.value}</span>${icon('edit', 'icon pst__edit')}</button>${r.price ? `<span class="pst__p">${r.price}</span>` : ''}</dd></div>`).join('');
    odo.set(pr.total);
    monthly.innerHTML = pr.monthly ? `+ ${priceHtml(pr.monthly, { suffix: he.pricing.perMonth })}` : '';
    // pin chip
    const spot = s.spotMode === 'map' && s.spot ? s.spot : '';
    pin.hidden = !spot || s.product === 'workshop';
    if (spot) pin.innerHTML = `${icon('pin')}<bdi>${spot}</bdi>`;
  };

  host.querySelector('.pst__lines')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
    if (b) ctx.go(b.dataset.go as StepId, { focus: true });
  });
  host.querySelector('.pst__cta')!.addEventListener('click', () => {
    sound.play('click');
    ctx.go('checkout', { focus: true });
  });

  return {
    el: host,
    plaqueHome: q<HTMLElement>('[data-plaque-home]'),
    update(s, prev) {
      host.dataset.product = s.product;
      const treeMode = s.product === 'tree' || s.product === 'corner';
      if (treeMode) growTo(s.species, !prev);
      else if (s.product === 'bench' && grown !== 'olive') growTo('olive', !prev); // a quiet olive behind the bench
      setCorner(s.product === 'corner');
      setItem(s);
      setWorkshop(s, prev);
      // "…והעץ נכנס לאדמה…" — only for orders that plant a tree
      season.hidden = !treeMode;
      setProps(s);
      setTag(s, prev);
      paintInfo(s);
      svg.dataset.mode = s.product;
    },
    setStep(step) {
      scene.dataset.focus = step === 'plaque' ? 'plaque' : '';
      host.querySelector('.pst__cta')!.toggleAttribute('hidden', step === 'checkout');
    },
    setMotion(allowed) {
      if (!allowed) {
        growTl?.progress(1);
        gsap.set([marks, details, roots], { clearProps: 'opacity' });
        gsap.set(Array.from(details.children), { clearProps: 'all' });
      }
    },
  };
}
