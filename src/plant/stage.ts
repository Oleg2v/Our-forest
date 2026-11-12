/* The stage: sticky visual summary. One idea — the scene assembles as you configure:
   the chosen species grows from a sapling (MorphSVG trunk + crown, roots draw under the
   ground), the plaque stands at its foot and burns live, extras appear around the tree,
   a paper tag hangs from a branch when it is a gift. */
import { he } from '../content/he';
import { priceHtml } from '../core/format';
import { gsap, EASE } from '../core/gsap';
import { sound } from '../core/sound';
import type { SpeciesId } from '../components/forest-map';
import { SAPLING, SPECIES_ART, TREE_VB, GROUND, GRASS, ROOTS, ICONS, icon, iconPath, type IconName } from './art';
import { createOdometer, type Odometer } from './odometer';
import { summaryRows } from './steps-flow';
import { speciesText, stepShort, WORKSHOPS, type StepId, type ExtraId } from './catalog';
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
const CORNER_PROPS = [
  { icon: 'bench' as IconName, t: 'translate(22 184) scale(1.3)' },
  { icon: 'lantern' as IconName, t: 'translate(200 176) scale(1.6)' },
  { icon: 'herbs' as IconName, t: 'translate(168 196) scale(0.8)' },
  { icon: 'herbs' as IconName, t: 'translate(181 199) scale(0.66)' },
];

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
        <div class="pst__art">
        <svg class="pst__svg" viewBox="${TREE_VB}" aria-hidden="true" focusable="false">
          <path class="pst__roots" d="${ROOTS}" ${NS}/>
          <path class="pst__ground" d="${GROUND}" ${NS}/>
          <path class="pst__grass" d="${GRASS}" ${NS}/>
          <g class="pst__corner"></g>
          <g class="pst__tree">
            <path class="pst__trunk" d="${SAPLING.trunk}" ${NS}/>
            <path class="pst__crown" d="${SAPLING.crown}" ${NS}/>
            <g class="pst__marks"></g>
            <g class="pst__details"></g>
          </g>
          <g class="pst__props"></g>
          <g class="pst__tag" opacity="0">
            <path d="M156 146 L160 170" ${NS}/>
            <g transform="translate(152 168) rotate(10)"><path class="pst__tagcard" d="M0 0 h20 l5 6.5 l-5 6.5 h-20 Z M19 6.5 a1.6 1.6 0 1 0 0.01 0" ${NS}/><path d="M4 6.5 h9" ${NS}/></g>
          </g>
          <g class="pst__bird" data-playful opacity="0"><g transform="translate(150 54)"><path d="${BIRD}" ${NS}/></g></g>
        </svg>
        <div class="pst__item" aria-hidden="true"></div>
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
  const item = q<HTMLElement>('.pst__item');
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

  const setProps = (s: PlantState) => {
    const want = new Set<string>(s.product === 'workshop' ? [] : s.extras);
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
      const p = PROPS[id as ExtraId];
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
    corner.innerHTML = CORNER_PROPS.map((p) => `<g transform="${p.t}"><path d="${ICONS[p.icon]}" ${NS}/></g>`).join('');
    if (ctx.motion()) gsap.fromTo(corner.querySelectorAll('path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2, stagger: 0.12, ease: 'power2.inOut' });
  };

  const setItem = (s: PlantState) => {
    let ic: IconName | null = null;
    if (s.product === 'bench') ic = s.item as IconName;
    if (s.product === 'workshop') ic = ({ carpentry: 'bench', dogs: 'dog', garden: 'sprout' } as const)[s.ws];
    const key = ic ?? '';
    if (item.dataset.icon === key) return;
    item.dataset.icon = key;
    item.innerHTML = ic ? `<svg viewBox="0 0 24 24" class="pst__item-svg">${iconPath(ic, 'translate(0 0)')}</svg>` : '';
    if (ic && ctx.motion()) {
      gsap.fromTo(item.querySelectorAll('path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.4 * ctx.speed(), ease: 'power2.inOut' });
      gsap.fromTo(item, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8, ease: EASE.appear });
    }
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
    lines.innerHTML = compact.map((r) => `
      <div class="pst__line"><dt>${r.label || '<span class="sr-only">תוספת</span>'}</dt>
      <dd><button type="button" class="pst__go" data-go="${r.step}"><span class="pst__v">${r.value}</span></button>${r.price ? `<span class="pst__p">${r.price}</span>` : ''}</dd></div>`).join('');
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
