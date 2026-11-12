/* ==========================================================================
   /plant — the configurator "העץ שלכם".
   Desktop: steps on the start side + a sticky visual summary (stage) on the end side.
   Phones: the stage on top, one step per screen in a bottom sheet, a sticky price bar.
   The whole selection lives in URL params (store.ts). Mock payment → printed certificate.
   ========================================================================== */
import { he } from '../content/he';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { gsap, EASE } from '../core/gsap';
import { track } from '../core/analytics';
import { sound } from '../core/sound';
import { scrollTo } from '../core/scroll';
import { refreshChrome } from '../chrome';
import { createPlaqueEngraver, type PlaqueEngraver } from '../components/plaque';
import { icon } from './art';
import {
  STEPS, PRODUCT_TITLE, PRODUCT_TAB, stepTitle, stepShort, speciesName, extraTitle, BENCH_ITEMS, WORKSHOPS,
  type Product, type StepId,
} from './catalog';
import { createStore, fromUrl, pricing, type PlantState } from './store';
import { radioGroup } from './a11y';
import { createOdometer } from './odometer';
import { createStage } from './stage';
import { speciesStep, itemStep, workshopStep, dateStep, seatsStep, occasionStep, locationStep, extrasStep } from './steps-choose';
import { plaqueStep, giftStep, summaryStep, checkoutStep } from './steps-flow';
import { createDoneView } from './certificate';
import type { Ctx, StepView, BuyerDetails } from './types';
import './plant.css';

const FACTORIES: Record<StepId, (ctx: Ctx, el: HTMLElement, body: HTMLElement) => StepView> = {
  species: speciesStep, item: itemStep, workshop: workshopStep, date: dateStep, seats: seatsStep,
  occasion: occasionStep, plaque: plaqueStep, location: locationStep, extras: extrasStep,
  gift: giftStep, summary: summaryStep, checkout: checkoutStep,
};
const PRODUCTS: Product[] = ['tree', 'bench', 'workshop', 'corner'];
const pad = (n: number) => String(n).padStart(2, '0');
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function initPlant(root: HTMLElement) {
  const html = document.documentElement;
  html.setAttribute('data-hide-sticky', ''); // the chrome's global sticky bar hides on this page
  const store = createStore(fromUrl());
  let motion = env.motionAllowed();
  const mq = window.matchMedia('(max-width: 768px)');

  root.innerHTML = `
    <div class="pc" data-product="" data-step="">
      <div class="pc__panel">
        <div class="pc__grab" aria-hidden="true"><span></span></div>
        <div class="pc__scroll" data-lenis-prevent-touch>
          <div class="pc__head">
            <div class="pc__toprow">
              <h1 class="pc__title"></h1>
              <div class="pc__products" aria-label="מה בוחרים?">
                ${PRODUCTS.map((p) => `<div class="pc__product" role="radio" data-value="${p}" aria-checked="false" tabindex="-1">${PRODUCT_TAB[p]}</div>`).join('')}
              </div>
            </div>
            <nav class="pc__rail" aria-label="שלבים"><ol class="pc__rail-list"></ol><span class="pc__rail-line" aria-hidden="true"><span class="pc__rail-fill"></span></span></nav>
          </div>
          <div class="pc__steps"></div>
          <div class="pc__nav">
            <button type="button" class="btn btn--outline pc__back">${icon('back', 'icon')}<span>חזרה</span></button>
            <p class="pc__err" role="alert"></p>
            <button type="button" class="btn pc__next" data-magnetic><span class="pc__next-label">הבא</span><span class="pc__next-to"></span>${icon('fwd', 'icon arrow-fwd')}</button>
          </div>
        </div>
      </div>
      <aside class="pc__stage" aria-label="${he.plant.summary.title}"></aside>
      <div class="pc-bar">
        <div class="pc-bar__price"><span class="pc-bar__tl">${he.plant.summary.total}</span><span class="pc-bar__odo price"></span></div>
        <button type="button" class="pc-bar__back" aria-label="חזרה">${icon('back')}</button>
        <button type="button" class="btn pc-bar__next"><span class="pc-bar__label">הבא</span>${icon('fwd', 'icon arrow-fwd')}</button>
      </div>
      <p class="pc-bar__err" role="alert"></p>
      <div class="sr-only" aria-live="polite" data-announce></div>
    </div>`;

  const pc = root.querySelector<HTMLElement>('.pc')!;
  const q = <T extends Element>(s: string) => pc.querySelector<T>(s)!;
  const stepsHost = q<HTMLElement>('.pc__steps');
  const railList = q<HTMLElement>('.pc__rail-list');
  const railFill = q<HTMLElement>('.pc__rail-fill');
  const announcer = q<HTMLElement>('[data-announce]');
  const errEl = q<HTMLElement>('.pc__err');
  const barErr = q<HTMLElement>('.pc-bar__err');
  const scrollEl = q<HTMLElement>('.pc__scroll');
  const nextBtn = q<HTMLButtonElement>('.pc__next');
  const backBtn = q<HTMLButtonElement>('.pc__back');
  const barNext = q<HTMLButtonElement>('.pc-bar__next');
  const barBack = q<HTMLButtonElement>('.pc-bar__back');

  /* ---------- the one live plaque ---------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'pc-plaque';
  canvas.setAttribute('role', 'img');
  let engraver: PlaqueEngraver;
  let lastSpark = 0;

  /* ---------- context for the steps ---------- */
  const views = new Map<StepId, StepView>();
  const ctx: Ctx = {
    root: pc,
    store,
    motion: () => motion,
    speed: () => (store.get().occasion === 'memorial' ? 1.5 : 1),
    memorial: () => store.get().occasion === 'memorial',
    mobile: () => mq.matches,
    pricing: (s = store.get()) => pricing(s, { main: ctx.mainLabel(s), extra: extraTitle }),
    steps: () => STEPS[store.get().product],
    go: (step, o = {}) => go(step, o),
    next: () => next(),
    prev: () => prev(),
    announce: (m) => { announcer.textContent = ''; requestAnimationFrame(() => { announcer.textContent = m; }); },
    engraver: () => engraver,
    placePlaque: () => placePlaque(),
    purchase: (b) => purchase(b),
    mainLabel(s = store.get()) {
      if (s.product === 'tree') return `עץ ${speciesName(s.species)}`;
      if (s.product === 'corner') return `פינה ביער · עץ ${speciesName(s.species)}`;
      if (s.product === 'bench') return BENCH_ITEMS.find((b) => b.id === s.item)!.label;
      return WORKSHOPS.find((w) => w.id === s.ws)!.title;
    },
  };

  const stage = createStage(ctx, q<HTMLElement>('.pc__stage'));
  const barOdo = createOdometer(q<HTMLElement>('.pc-bar__odo'), ctx.pricing().total, { motion: ctx.motion, speed: ctx.speed });
  engraver = createPlaqueEngraver(canvas, {
    memorial: ctx.memorial(),
    motion,
    placeholder: he.plant.plaquePlaceholder.replace(/^לדוגמה:\s*/, ''),
    resolution: 1.5,
    onBurnChar: () => {
      if (ctx.memorial()) return;
      const t = performance.now();
      if (t - lastSpark > 260) { lastSpark = t; sound.play('sparkle', { volume: 0.35 }); }
    },
  });

  /* ---------- product tabs ---------- */
  const productRg = radioGroup(q<HTMLElement>('.pc__products'), (v) => {
    const p = v as Product;
    if (p === store.get().product) return;
    sound.play('click');
    store.set({ product: p, step: STEPS[p][0] }, { history: 'push' });
  });

  /* ---------- build the steps of the current product ---------- */
  let current: StepId | null = null;
  const build = () => {
    const s = store.get();
    views.forEach((v) => v.leave?.());
    views.clear();
    stepsHost.innerHTML = '';
    current = null;
    const steps = STEPS[s.product];
    pc.dataset.product = s.product;
    q<HTMLElement>('.pc__title').textContent = PRODUCT_TITLE[s.product];
    productRg.set(s.product);
    railList.innerHTML = steps.map((id, i) => `
      <li class="pc__rail-item"><button type="button" class="pc__node" data-step="${id}">
        <span class="pc__node-dot" aria-hidden="true"></span><span class="pc__node-num num" aria-hidden="true">${pad(i + 1)}</span>
        <span class="pc__node-label">${stepShort(id, s.product)}</span></button></li>`).join('');
    steps.forEach((id, i) => {
      const sec = document.createElement('section');
      sec.className = `pcs pcs--${id}`;
      sec.dataset.step = id;
      sec.hidden = true;
      sec.setAttribute('aria-labelledby', `pcs-${id}-t`);
      sec.innerHTML = `
        <header class="pcs__head">
          <p class="pcs__count"><span class="sr-only">שלב ${i + 1} מתוך ${steps.length}</span><span aria-hidden="true"><span class="num">${pad(i + 1)}</span><span class="pcs__of"> / ${pad(steps.length)}</span></span></p>
          <h2 class="pcs__title" id="pcs-${id}-t" tabindex="-1"><span class="pcs__title-in">${stepTitle(id, s.product)}</span></h2>
        </header>
        <div class="pcs__body"></div>`;
      stepsHost.appendChild(sec);
      views.set(id, FACTORIES[id](ctx, sec, sec.querySelector<HTMLElement>('.pcs__body')!));
    });
    show(s.step, 0, false);
    refreshChrome(pc);
  };

  /* ---------- show a step ---------- */
  const show = (step: StepId, dir: number, focus: boolean) => {
    const steps = ctx.steps();
    if (!steps.includes(step)) step = steps[0];
    const prevId = current;
    const fromEl = prevId ? views.get(prevId)?.el : null;
    const view = views.get(step)!;
    const toEl = view.el;
    if (prevId === step) return;
    current = step;
    pc.dataset.step = step;
    clearError();
    if (prevId) views.get(prevId)?.leave?.();
    const sp = ctx.speed();
    const mobile = mq.matches;
    if (fromEl && motion) {
      gsap.killTweensOf([fromEl, toEl]);
      gsap.to(fromEl, {
        opacity: 0, x: mobile ? dir * 36 : 0, y: mobile ? 0 : -dir * 18, duration: 0.28 * sp, ease: 'power2.in',
        onComplete: () => { fromEl.hidden = true; gsap.set(fromEl, { clearProps: 'all' }); },
      });
      toEl.hidden = false;
      gsap.fromTo(toEl, { opacity: 0, x: mobile ? -dir * 44 : 0, y: mobile ? 0 : dir * 28 }, { opacity: 1, x: 0, y: 0, duration: 0.8 * sp, delay: 0.22 * sp, ease: EASE.appear, clearProps: 'transform' });
      const title = toEl.querySelector('.pcs__title-in');
      if (title) gsap.fromTo(title, { yPercent: 105 }, { yPercent: 0, duration: 1.1 * sp, delay: 0.24 * sp, ease: EASE.appear });
      // first-level content cascades in
      const kids = toEl.querySelectorAll('.pcs__body > *');
      gsap.fromTo(kids, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9 * sp, delay: 0.32 * sp, stagger: 0.06 * sp, ease: EASE.appear, clearProps: 'transform,opacity' });
    } else {
      if (fromEl) { fromEl.hidden = true; gsap.set(fromEl, { clearProps: 'all' }); }
      toEl.hidden = false;
      gsap.set(toEl, { clearProps: 'all' });
    }
    view.enter?.();
    paintNav();
    stage.setStep(step);
    placePlaque();
    if (prevId) {
      const i = steps.indexOf(step);
      ctx.announce(`שלב ${i + 1} מתוך ${steps.length}: ${stepTitle(step, store.get().product)}`);
      // keep the step in view
      if (mobile) scrollEl.scrollTo({ top: 0, behavior: motion ? 'smooth' : 'auto' });
      else if (pc.getBoundingClientRect().top < -40) scrollTo(pc, { offset: 0 });
    }
    if (focus) requestAnimationFrame(() => toEl.querySelector<HTMLElement>('.pcs__title')?.focus({ preventScroll: true }));
  };

  const paintNav = () => {
    const s = store.get();
    const steps = STEPS[s.product];
    const i = steps.indexOf(current!);
    railList.querySelectorAll<HTMLButtonElement>('.pc__node').forEach((b, k) => {
      b.classList.toggle('is-done', k < i);
      b.classList.toggle('is-current', k === i);
      if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-label', `${pad(k + 1)} · ${stepTitle(steps[k], s.product)}`);
    });
    const frac = steps.length > 1 ? i / (steps.length - 1) : 0;
    if (motion) gsap.to(railFill, { scaleX: frac, duration: 0.9 * ctx.speed(), ease: EASE.page });
    else gsap.set(railFill, { scaleX: frac });
    const view = views.get(current!);
    const cta = view?.cta?.();
    const nxt = steps[i + 1];
    backBtn.hidden = i === 0;
    barBack.hidden = i === 0;
    nextBtn.hidden = current === 'checkout';
    q<HTMLElement>('.pc__next-label').textContent = cta?.label ?? 'הבא';
    q<HTMLElement>('.pc__next-to').textContent = !cta && nxt ? stepTitle(nxt, s.product) : '';
    nextBtn.classList.toggle('btn--fruit', !!cta?.fruit);
    barNext.classList.toggle('btn--fruit', !!cta?.fruit);
    if (cta?.fruit) { nextBtn.dataset.cursor = 'שתלו'; nextBtn.dataset.cursorFill = 'fruit'; barNext.dataset.cursor = 'שתלו'; }
    else { delete nextBtn.dataset.cursor; delete nextBtn.dataset.cursorFill; delete barNext.dataset.cursor; }
    q<HTMLElement>('.pc-bar__label').textContent = cta?.label ?? 'הבא';
  };

  /* ---------- navigation ---------- */
  const clearError = () => { errEl.textContent = ''; barErr.textContent = ''; pc.classList.remove('has-error'); };
  const showError = (msg: string) => {
    errEl.textContent = msg; barErr.textContent = msg;
    pc.classList.add('has-error');
    if (motion) gsap.fromTo([errEl, barErr], { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
    window.setTimeout(() => { if (barErr.textContent === msg) { barErr.textContent = ''; pc.classList.remove('has-error'); } }, 4200);
  };
  const go = (step: StepId, o: { focus?: boolean } = {}) => {
    const steps = ctx.steps();
    const from = steps.indexOf(current!);
    const to = steps.indexOf(step);
    if (to < 0 || step === current) return;
    // moving forward past an invalid step stops there
    if (to > from) {
      for (let k = Math.max(0, from); k < to; k++) {
        const err = views.get(steps[k])?.validate?.();
        if (err) {
          if (k !== from) { pending = { step: steps[k], focus: true }; store.set({ step: steps[k] }); pending = null; }
          showError(err);
          return;
        }
      }
    }
    pending = { step, focus: !!o.focus };
    store.set({ step });
    pending = null;
  };
  let pending: { step: StepId; focus: boolean } | null = null;
  const next = () => {
    const steps = ctx.steps();
    const view = views.get(current!);
    if (view?.primary) { view.primary(); return; }
    const i = steps.indexOf(current!);
    if (i < steps.length - 1) { sound.play('click'); go(steps[i + 1], { focus: false }); }
  };
  const prev = () => {
    const steps = ctx.steps();
    const i = steps.indexOf(current!);
    if (i > 0) { sound.play('click'); pending = { step: steps[i - 1], focus: false }; store.set({ step: steps[i - 1] }); pending = null; }
  };
  nextBtn.addEventListener('click', next);
  barNext.addEventListener('click', next);
  backBtn.addEventListener('click', prev);
  barBack.addEventListener('click', prev);
  railList.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-step]');
    if (b) go(b.dataset.step as StepId, { focus: true });
  });

  /* ---------- the plaque lives in the stage; on phones the plaque step shows it big above the input ---------- */
  const placePlaque = () => {
    const s = store.get();
    const slot = mq.matches && current === 'plaque' ? views.get('plaque')?.plaqueSlot : stage.plaqueHome;
    const target = s.product === 'workshop' ? null : slot;
    if (!target) { canvas.remove(); return; }
    if (canvas.parentElement !== target) { target.appendChild(canvas); engraver.resize(); }
  };
  const describePlaque = () => {
    const t = store.get().text.trim();
    canvas.setAttribute('aria-label', t ? `שלט עץ חרוט: ${t}` : `שלט עץ חרוט, עדיין ריק`);
  };

  /* ---------- mood: memorial = quieter ---------- */
  const setMood = (s: PlantState) => {
    const mem = s.occasion === 'memorial';
    pc.classList.toggle('pc--memorial', mem);
    engraver.setMemorial(mem);
  };

  /* ---------- store → UI ---------- */
  store.subscribe((s, p) => {
    if (s.product !== p.product) { build(); stage.update(s, p); barOdo.set(ctx.pricing(s).total); placePlaque(); return; }
    views.forEach((v) => v.update?.(s, p));
    stage.update(s, p);
    if (s.text !== p.text) { engraver.setText(s.text); describePlaque(); }
    if (s.occasion !== p.occasion) setMood(s);
    barOdo.set(ctx.pricing(s).total);
    if (s.step !== p.step) {
      const steps = STEPS[s.product];
      const dir = Math.sign(steps.indexOf(s.step) - steps.indexOf(p.step)) || 1;
      show(s.step, dir, pending?.focus ?? false);
    } else paintNav();
  });

  window.addEventListener('popstate', () => {
    if (pc.hidden) return;
    const s = fromUrl();
    store.set(s, { history: 'none' });
  });

  /* ---------- mobile sheet: drag the handle to give the step the whole screen; keyboard keeps the plaque visible ---------- */
  const grab = q<HTMLElement>('.pc__grab');
  let dragY0 = 0, dragging = false, stageH0 = 0;
  const stageEl = q<HTMLElement>('.pc__stage');
  grab.addEventListener('pointerdown', (e) => {
    if (!mq.matches) return;
    dragging = true; dragY0 = e.clientY; stageH0 = stageEl.getBoundingClientRect().height;
    grab.setPointerCapture(e.pointerId);
    pc.classList.add('is-dragging');
  });
  grab.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const h = Math.max(0, Math.min(window.innerHeight * 0.42, stageH0 + (e.clientY - dragY0)));
    pc.style.setProperty('--stage-drag', `${h}px`);
  });
  const endDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    pc.classList.remove('is-dragging');
    const moved = e.clientY - dragY0;
    pc.style.removeProperty('--stage-drag');
    if (Math.abs(moved) < 6) pc.classList.toggle('is-full');
    else pc.classList.toggle('is-full', moved < 0);
  };
  grab.addEventListener('pointerup', endDrag);
  grab.addEventListener('pointercancel', endDrag);
  const vv = window.visualViewport;
  const onVV = () => {
    if (!vv) return;
    const kb = window.innerHeight - vv.height > 140;
    pc.style.setProperty('--vvh', `${vv.height}px`);
    pc.classList.toggle('is-typing', kb && mq.matches);
    if (kb && mq.matches) {
      const a = document.activeElement as HTMLElement | null;
      if (a && scrollEl.contains(a)) requestAnimationFrame(() => {
        const slot = current === 'plaque' ? views.get('plaque')?.plaqueSlot : null;
        (slot ?? a).scrollIntoView({ block: 'start', behavior: 'auto' });
      });
    }
  };
  vv?.addEventListener('resize', onVV);
  scrollEl.addEventListener('focusin', (e) => {
    if (mq.matches && (e.target as HTMLElement).matches('input:not([type="checkbox"]), textarea')) pc.classList.add('is-focus');
  });
  scrollEl.addEventListener('focusout', () => pc.classList.remove('is-focus'));
  mq.addEventListener('change', () => placePlaque());

  /* ---------- reduced motion ---------- */
  bus.on('motion:change', ({ allowed }: { allowed: boolean }) => {
    motion = allowed;
    engraver.setMotion(allowed);
    stage.setMotion(allowed);
  });

  /* ---------- the mock payment ---------- */
  const purchase = async (buyer: BuyerDetails) => {
    const s = store.get();
    const pr = ctx.pricing(s);
    sound.play('click');
    await wait(motion ? 1500 : 250);
    const id = `OF-${Date.now().toString().slice(-6)}`;
    track('purchase', {
      transaction_id: id, value: pr.total, currency: 'ILS', payment_type: buyer.method,
      items: pr.lines.map((l) => ({ item_id: l.id, item_name: l.label, price: l.amount })),
    });
    const plaqueUrl = s.product === 'workshop' ? null : engraver.toDataURL();
    const done = createDoneView(ctx, s, buyer, plaqueUrl);
    root.appendChild(done.el);
    html.classList.add('pc-has-cert');
    const swap = () => {
      pc.hidden = true;
      window.scrollTo({ top: 0, behavior: 'auto' });
      done.el.querySelector<HTMLElement>('#pdone-t')?.focus({ preventScroll: true });
      done.play();
    };
    if (motion) gsap.to(pc, { opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: swap });
    else swap();
  };

  /* ---------- start ---------- */
  build();
  const s0 = store.get();
  stage.update(s0, null);
  setMood(s0);
  engraver.setText(s0.text, { instant: true });
  describePlaque();
  placePlaque();
  if (s0.text.trim() && motion) engraver.burnAll({ from: 0, duration: Math.max(1.4, s0.text.length * 0.08) });
  track('view_item', {
    currency: 'ILS', value: ctx.pricing(s0).base,
    items: [{ item_id: `${s0.product}`, item_name: ctx.mainLabel(s0), item_category: s0.product }],
  });
  // intro: the stage and the first step settle in
  if (motion) {
    gsap.from(q('.pc__head'), { opacity: 0, y: 20, duration: 1.1, ease: EASE.appear, clearProps: 'all' });
    gsap.from(q('.pc__stage'), { opacity: 0, duration: 1.2, ease: EASE.appear, clearProps: 'opacity' });
  }
}
