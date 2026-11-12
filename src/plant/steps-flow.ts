/* Flow steps: plaque (live engraving) · gift (postcard + envelope) · summary · checkout (mock payment) */
import { he } from '../content/he';
import { ils, ilDate, priceHtml, waLink } from '../core/format';
import { track } from '../core/analytics';
import { sound } from '../core/sound';
import { gsap, EASE } from '../core/gsap';
import { PLAQUE_MAX_CHARS } from '../components/plaque';
import { radioGroup, escapeHtml, isoPrices } from './a11y';
import { icon, treeSvg } from './art';
import { createOdometer } from './odometer';
import { occasionLabel, stepShort, TU_BISHVAT, WORKSHOPS, type StepId } from './catalog';
import type { GiftVia, GiftWhen, PlantState } from './store';
import type { Ctx, StepView, PayMethod } from './types';

const tick = () => { sound.play('click'); sound.haptic(8); };

/* ---------------- 3. plaque ---------------- */
export function plaqueStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  const titleId = el.querySelector('h2')!.id;
  body.innerHTML = `
    <div class="pcs-plaque">
      <div class="pcs-plaque__slot" data-plaque-slot></div>
      <div class="pcs-plaque__field">
        <input id="pc-text" class="input pcs-plaque__input" type="text" maxlength="${PLAQUE_MAX_CHARS}" autocomplete="off" autocorrect="off" spellcheck="false"
          enterkeyhint="next" dir="rtl" aria-labelledby="${titleId}" aria-describedby="pc-text-count" placeholder="${escapeHtml(he.plant.plaquePlaceholder)}">
        <div class="pcs-plaque__meta">
          <span id="pc-text-count" class="pcs-plaque__count"></span>
          <button type="button" class="pcs-plaque__again">${icon('edit')}<span>חורטים שוב</span></button>
        </div>
      </div>
    </div>`;
  const input = body.querySelector<HTMLInputElement>('#pc-text')!;
  const count = body.querySelector<HTMLElement>('.pcs-plaque__count')!;
  const again = body.querySelector<HTMLButtonElement>('.pcs-plaque__again')!;
  input.value = ctx.store.get().text;
  const paintCount = () => {
    const n = input.value.length;
    count.innerHTML = `<bdi>${n}/${PLAQUE_MAX_CHARS}</bdi>`;
    count.classList.toggle('is-near', n >= PLAQUE_MAX_CHARS - 4);
    again.hidden = !input.value.trim() || !ctx.motion();
  };
  input.addEventListener('input', () => {
    ctx.store.set({ text: input.value.slice(0, PLAQUE_MAX_CHARS) });
    paintCount();
  });
  // Enter = "next": the on-screen keyboard closes (blur) and focus lands on the next step's title, never on <body>
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); input.blur(); ctx.next({ focus: true }); } });
  // phones: while typing, the stage folds away and the sheet scrolls so the plaque sits right above the field —
  // the keyboard never covers the engraving (the "next" action stays in the bar above the keyboard)
  const slot = body.querySelector<HTMLElement>('[data-plaque-slot]')!;
  const keepPlaqueVisible = () => {
    const sc = ctx.root.querySelector<HTMLElement>('.pc__scroll');
    if (!sc || !ctx.mobile()) return;
    const top = sc.scrollTop + slot.getBoundingClientRect().top - sc.getBoundingClientRect().top - 10;
    sc.scrollTo({ top, behavior: 'auto' });
  };
  input.addEventListener('focus', () => {
    if (!ctx.mobile()) return;
    ctx.root.classList.add('is-plaque-typing');
    [60, 320, 650].forEach((ms) => setTimeout(keepPlaqueVisible, ms));
  });
  input.addEventListener('blur', () => ctx.root.classList.remove('is-plaque-typing'));
  window.visualViewport?.addEventListener('resize', () => { if (document.activeElement === input) keepPlaqueVisible(); });
  again.addEventListener('click', () => { tick(); ctx.engraver().burnAll({ duration: Math.max(1.2, input.value.length * 0.09) }); });
  paintCount();
  return {
    id: 'plaque', el,
    plaqueSlot: body.querySelector<HTMLElement>('[data-plaque-slot]')!,
    enter() { if (!ctx.mobile() && !('ontouchstart' in window)) input.focus({ preventScroll: true }); },
    update(s) { if (s.text !== input.value) { input.value = s.text; paintCount(); } },
  };
}

/* ---------------- 6. gift ---------------- */
export function giftStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  const g = he.plant.gift;
  const tuLabel = `בט״ו בשבט, ${ilDate(TU_BISHVAT)}`;
  body.innerHTML = `
    <button type="button" class="pcs-switch" role="switch" aria-checked="false">
      <span class="pcs-switch__ico">${icon('gift')}</span>
      <span class="pcs-switch__label">${g.toggle}</span>
      <span class="pcs-switch__track" aria-hidden="true"><span class="pcs-switch__thumb"></span></span>
    </button>
    <div class="pcs-gift" data-open="false">
      <div class="pcs-gift__inner">
        <div class="pcs-gift__grid">
          <div class="pcs-gift__preview" aria-hidden="true">
            <div class="pcard">
              <div class="pcard__back"></div>
              <div class="pcard__paper leaf-sm">
                <div class="pcard__art"></div>
                <p class="pcard__to"></p>
                <p class="pcard__msg"></p>
                <p class="pcard__sig">${he.brand} · ${he.place}</p>
              </div>
              <div class="pcard__front"></div>
              <div class="pcard__flap"></div>
            </div>
          </div>
          <div class="pcs-gift__fields">
            <div class="field"><label for="gift-to">${g.to}</label><input id="gift-to" type="text" maxlength="40" autocomplete="off"></div>
            <div class="field">
              <span class="pcs-field-label" id="gift-when-l">${g.when}</span>
              <div class="pcs-chips pcs-chips--sm" data-when aria-labelledby="gift-when-l">
                <div class="chip pcs-chip" role="radio" data-value="now" aria-checked="false" tabindex="-1">עכשיו</div>
                <div class="chip pcs-chip" role="radio" data-value="tubishvat" aria-checked="false" tabindex="-1"><bdi>${tuLabel}</bdi></div>
                <div class="chip pcs-chip" role="radio" data-value="date" aria-checked="false" tabindex="-1">בתאריך אחר</div>
              </div>
              <input id="gift-date" type="date" class="input pcs-gift__date" aria-label="${g.when}" hidden>
            </div>
            <div class="field"><label for="gift-msg">${g.message}</label><textarea id="gift-msg" rows="3" maxlength="280"></textarea></div>
            <div class="field">
              <span class="pcs-field-label" id="gift-via-l">איך שולחים?</span>
              <div class="pcs-chips pcs-chips--sm" data-via aria-labelledby="gift-via-l">
                <div class="chip pcs-chip" role="radio" data-value="wa" aria-checked="false" tabindex="-1">${icon('chat')}${he.cta.whatsapp}</div>
                <div class="chip pcs-chip" role="radio" data-value="mail" aria-checked="false" tabindex="-1">${icon('mail')}${he.contact.form.email}</div>
              </div>
              <input id="gift-contact" class="input" type="tel" dir="ltr" inputmode="tel" autocomplete="off" aria-labelledby="gift-via-l">
            </div>
          </div>
        </div>
      </div>
    </div>`;
  const sw = body.querySelector<HTMLButtonElement>('.pcs-switch')!;
  const box = body.querySelector<HTMLElement>('.pcs-gift')!;
  const to = body.querySelector<HTMLInputElement>('#gift-to')!;
  const msg = body.querySelector<HTMLTextAreaElement>('#gift-msg')!;
  const date = body.querySelector<HTMLInputElement>('#gift-date')!;
  const contact = body.querySelector<HTMLInputElement>('#gift-contact')!;
  const card = body.querySelector<HTMLElement>('.pcard')!;
  const art = body.querySelector<HTMLElement>('.pcard__art')!;
  const pTo = body.querySelector<HTMLElement>('.pcard__to')!;
  const pMsg = body.querySelector<HTMLElement>('.pcard__msg')!;
  const today = new Date();
  date.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const whenRg = radioGroup(body.querySelector<HTMLElement>('[data-when]')!, (v) => { tick(); ctx.store.set({ giftWhen: v as GiftWhen }); });
  const viaRg = radioGroup(body.querySelector<HTMLElement>('[data-via]')!, (v) => { tick(); ctx.store.set({ giftVia: v as GiftVia }); });

  let opened = false;
  const playOpen = () => {
    const paper = card.querySelector('.pcard__paper')!, flap = card.querySelector('.pcard__flap')!;
    // closed flap = rotateX(180) (folded down over the pocket), open = 0 (standing up behind the card)
    // (y: 0 — the CSS translate is read back as px; without it the paper would rise twice as far and be cut off)
    if (!ctx.motion()) { gsap.set(flap, { rotateX: 0, zIndex: 1 }); gsap.set(paper, { y: 0, yPercent: -58 }); return; }
    const sp = ctx.speed();
    gsap.timeline()
      .set(paper, { y: 0, yPercent: 0 }).set(flap, { rotateX: 180, zIndex: 4 })
      .fromTo(card, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 * sp, ease: EASE.appear })
      .to(flap, { rotateX: 0, duration: 0.7 * sp, ease: 'power3.inOut' }, '-=0.15')
      .set(flap, { zIndex: 1 }, '-=0.35')
      .to(paper, { yPercent: -58, duration: 1.1 * sp, ease: EASE.appear }, '-=0.1')
      .add(() => sound.play('paper'), '<');
  };

  /* phones: the fields come first (the name is the one thing to type) and the envelope sits below them —
     it opens when it scrolls into view, not off-screen */
  let io: IntersectionObserver | null = null;
  const openWhenSeen = () => {
    io?.disconnect(); io = null;
    const sc = ctx.root.querySelector<HTMLElement>('.pc__scroll');
    if (!ctx.mobile() || !ctx.motion() || !sc || !('IntersectionObserver' in window)) { playOpen(); return; }
    const paper = card.querySelector('.pcard__paper')!, flap = card.querySelector('.pcard__flap')!;
    gsap.set(paper, { y: 0, yPercent: 0 }); gsap.set(flap, { rotateX: 180, zIndex: 4 }); gsap.set(card, { opacity: 0 });
    io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io?.disconnect(); io = null;
      playOpen();
    }, { root: sc, threshold: 0.4 });
    io.observe(card);
  };

  const paint = (s: PlantState, first = false) => {
    sw.setAttribute('aria-checked', String(s.gift));
    box.dataset.open = String(s.gift);
    box.querySelector('.pcs-gift__inner')!.toggleAttribute('inert', !s.gift);
    if (to.value !== s.giftTo) to.value = s.giftTo;
    if (msg.value !== s.giftMsg) msg.value = s.giftMsg;
    whenRg.set(s.giftWhen);
    viaRg.set(s.giftVia);
    date.hidden = s.giftWhen !== 'date';
    if (s.giftDate && date.value !== s.giftDate) date.value = s.giftDate;
    contact.type = s.giftVia === 'mail' ? 'email' : 'tel';
    contact.inputMode = s.giftVia === 'mail' ? 'email' : 'tel';
    contact.placeholder = s.giftVia === 'mail' ? 'name@example.com' : '050-0000000';
    if (s.product !== 'workshop') art.innerHTML = treeSvg(s.species, { details: 7, className: 'pcard__svg' });
    else art.innerHTML = `<span class="pcard__ico">${icon('gift')}</span>`;
    pTo.textContent = s.giftTo ? `ל${s.giftTo.replace(/^ל/, '')}` : g.to;
    pMsg.textContent = s.giftMsg || (s.text ? `״${s.text}״` : '');
    if (s.gift && !opened) { opened = true; if (!first) openWhenSeen(); else requestAnimationFrame(openWhenSeen); }
    if (!s.gift) { opened = false; io?.disconnect(); io = null; }
  };
  sw.addEventListener('click', () => {
    tick();
    const on = !ctx.store.get().gift;
    ctx.store.set({ gift: on });
    if (on) track('gift_started', { product: ctx.store.get().product });
  });
  to.addEventListener('input', () => ctx.store.set({ giftTo: to.value }));
  msg.addEventListener('input', () => ctx.store.set({ giftMsg: msg.value }));
  date.addEventListener('change', () => ctx.store.set({ giftDate: date.value }));
  paint(ctx.store.get(), true);
  return {
    id: 'gift', el,
    enter() { if (ctx.store.get().gift) { opened = false; paint(ctx.store.get()); } },
    update(s, p) {
      if (s.gift !== p.gift || s.giftTo !== p.giftTo || s.giftMsg !== p.giftMsg || s.giftWhen !== p.giftWhen || s.giftVia !== p.giftVia
        || s.giftDate !== p.giftDate || s.species !== p.species || s.text !== p.text) paint(s);
    },
    validate() {
      const s = ctx.store.get();
      if (!s.gift) return null;
      if (!s.giftTo.trim()) { to.focus(); return `${g.to} — כתבו שם`; }
      if (s.giftWhen === 'date' && !s.giftDate) { date.focus(); return `${g.when} — בחרו תאריך`; }
      return null;
    },
  };
}

export function giftWhenText(s: PlantState): string {
  if (s.giftWhen === 'tubishvat') return `בט״ו בשבט, ${ilDate(TU_BISHVAT)}`;
  if (s.giftWhen === 'date' && s.giftDate) return ilDate(s.giftDate);
  return 'עכשיו';
}

/** a quiet WhatsApp line at the decision steps (on phones the site's own sticky bar is hidden here) — micro-copy */
const waLine = () => `<a class="pcs-wa" href="${waLink('שלום, יש לי שאלה לפני ההזמנה באתר')}" target="_blank" rel="noopener">${icon('chat')}<span>שאלה לפני שמשלמים? כתבו לנו ב${he.cta.whatsapp}</span></a>`;

/* ---------------- 7. summary ---------------- */
export function summaryRows(ctx: Ctx, s: PlantState): { step: StepId; label: string; value: string; price?: string }[] {
  const pr = ctx.pricing(s);
  const rows: { step: StepId; label: string; value: string; price?: string }[] = [];
  const steps = ctx.steps();
  const main = steps[0];
  if (s.product === 'workshop') {
    const w = WORKSHOPS.find((x) => x.id === s.ws)!;
    rows.push({ step: 'workshop', label: stepShort('workshop', s.product), value: escapeHtml(w.title), price: priceHtml(pr.base) });
    rows.push({ step: 'date', label: stepShort('date', s.product), value: `<bdi>${ilDate(s.date)}</bdi>` });
    rows.push({ step: 'seats', label: stepShort('seats', s.product), value: `<bdi>${s.seats} × ${ils(w.price)}</bdi>` });
  } else {
    rows.push({ step: main, label: stepShort(main, s.product), value: escapeHtml(ctx.mainLabel(s)), price: priceHtml(pr.base) });
    if (s.occasion) rows.push({ step: 'occasion', label: stepShort('occasion', s.product), value: occasionLabel(s.occasion) });
    rows.push({ step: 'plaque', label: stepShort('plaque', s.product), value: s.text.trim() ? `״${escapeHtml(s.text.trim())}״` : '<span class="is-muted">—</span>' });
    rows.push({ step: 'location', label: stepShort('location', s.product), value: s.spotMode === 'map' && s.spot ? `<bdi>${escapeHtml(s.spot)}</bdi>` : he.plant.location.forUs });
    for (const l of pr.lines.filter((x) => x.id !== 'main')) {
      rows.push({ step: 'extras', label: '', value: escapeHtml(l.label), price: l.monthly ? priceHtml(l.amount, { suffix: he.pricing.perMonth }) : priceHtml(l.amount) });
    }
  }
  if (s.gift) {
    const to = s.giftTo.trim() ? escapeHtml(`ל${s.giftTo.trim().replace(/^ל/, '')}`) : '';
    rows.push({ step: 'gift', label: stepShort('gift', s.product), value: [to, giftWhenText(s), s.giftVia === 'wa' ? he.cta.whatsapp : he.contact.form.email].filter(Boolean).join(' · ') });
  }
  return rows;
}

export function includesFor(s: PlantState): string[] {
  const items = he.plant.includes.items;
  if (s.product === 'tree') return [...items];
  if (s.product === 'corner') return [he.participate.cards[3].text, items[1], items[2], items[3], items[4], items[5]];
  if (s.product === 'bench') return [items[1], items[2], items[4]];
  const w = WORKSHOPS.find((x) => x.id === s.ws)!;
  return [w.title, ilDate(s.date)];
}

/** the seasonal line ("…והעץ נכנס לאדמה…") belongs to orders that plant a tree */
const planted = (ctx: Ctx) => { const p = ctx.store.get().product; return p === 'tree' || p === 'corner'; };

export function summaryStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  body.innerHTML = `
    <div class="pcs-sum">
      <p class="pcs-sum__season"${planted(ctx) ? '' : ' hidden'}>${icon('calendar')}<span>${he.seasonalBanner}</span></p>
      <div class="pcs-sum__inc">
        <h3 class="pcs-sum__h">${he.plant.includes.title}</h3>
        <ul class="pcs-sum__list"></ul>
      </div>
      <div class="pcs-sum__order">
        <dl class="pcs-sum__rows"></dl>
        <div class="pcs-sum__total">
          <span class="pcs-sum__tl">${he.plant.summary.total}</span>
          <span class="pcs-sum__odo price" aria-live="polite"></span>
          <span class="pcs-sum__monthly"></span>
        </div>
      </div>
      ${waLine()}
    </div>`;
  const list = body.querySelector<HTMLElement>('.pcs-sum__list')!;
  const rowsEl = body.querySelector<HTMLElement>('.pcs-sum__rows')!;
  const monthly = body.querySelector<HTMLElement>('.pcs-sum__monthly')!;
  const odo = createOdometer(body.querySelector<HTMLElement>('.pcs-sum__odo')!, ctx.pricing().total, { motion: ctx.motion, speed: ctx.speed });
  const paint = () => {
    const s = ctx.store.get();
    const pr = ctx.pricing(s);
    list.innerHTML = includesFor(s).map((t, i) => `<li${s.product === 'tree' && i === 5 ? ' class="is-trust"' : ''}>${icon(s.product === 'tree' && i === 5 ? 'guarantee' : 'check')}<span>${escapeHtml(t)}</span></li>`).join('');
    rowsEl.innerHTML = summaryRows(ctx, s).map((r) => `
      <div class="pcs-sum__row">
        <dt>${r.label || '<span class="sr-only">תוספת</span>'}</dt>
        <dd><span class="pcs-sum__v">${r.value}</span>${r.price ? `<span class="pcs-sum__p">${r.price}</span>` : ''}
          <button type="button" class="pcs-sum__edit" data-go="${r.step}" aria-label="שינוי: ${escapeHtml(r.label || stepShort(r.step, s.product))}">${icon('edit')}</button></dd>
      </div>`).join('');
    odo.set(pr.total);
    monthly.innerHTML = pr.monthly ? `+ ${priceHtml(pr.monthly, { suffix: he.pricing.perMonth })}` : '';
  };
  rowsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
    if (b) { tick(); ctx.go(b.dataset.go as StepId, { focus: true }); }
  });
  paint();
  let sent = '';
  return {
    id: 'summary', el,
    enter() {
      paint();
      const s = ctx.store.get();
      const pr = ctx.pricing(s);
      const key = `${s.product}|${pr.total}|${s.extras.join()}`;
      if (key !== sent) {
        sent = key;
        track('add_to_cart', { currency: 'ILS', value: pr.total, items: pr.lines.map((l) => ({ item_id: l.id === 'main' ? `${s.product}-${s.product === 'bench' ? s.item : s.product === 'workshop' ? s.ws : s.species}` : `extra-${l.id}`, item_name: l.label, price: l.amount })) });
      }
      if (ctx.motion()) {
        gsap.fromTo(list.querySelectorAll('li'), { opacity: 0, x: 18 }, { opacity: 1, x: 0, stagger: 0.07 * ctx.speed(), duration: 0.8 * ctx.speed(), ease: EASE.appear });
        gsap.fromTo(list.querySelectorAll('.icon path'), { drawSVG: '0%' }, { drawSVG: '100%', stagger: 0.07 * ctx.speed(), duration: 0.6 * ctx.speed(), delay: 0.15, ease: 'power2.out' });
      }
    },
    update: paint,
    cta: () => ({ label: he.plant.summary.checkout, fruit: true }),
  };
}

/* ---------------- 8. checkout (mock) ---------------- */
const METHODS: { id: PayMethod; label: string; ico: 'phone' | 'tap' | 'card' }[] = [
  { id: 'bit', label: 'Bit', ico: 'phone' },
  { id: 'apple', label: 'Apple Pay', ico: 'tap' },
  { id: 'google', label: 'Google Pay', ico: 'tap' },
  { id: 'card', label: 'כרטיס אשראי', ico: 'card' },
];
export function checkoutStep(ctx: Ctx, el: HTMLElement, body: HTMLElement): StepView {
  const f = he.contact.form;
  body.innerHTML = `
    <form class="pcs-pay" novalidate>
      <div class="pcs-pay__fields">
        <div class="field"><label for="pay-name">${f.name}</label><input id="pay-name" name="name" type="text" autocomplete="name" enterkeyhint="next" required aria-describedby="pay-name-e"><span class="pcs-err" id="pay-name-e"></span></div>
        <div class="field"><label for="pay-phone">${f.phone}</label><input id="pay-phone" name="phone" type="tel" dir="ltr" inputmode="tel" autocomplete="tel" enterkeyhint="next" aria-describedby="pay-phone-e"><span class="pcs-err" id="pay-phone-e"></span></div>
        <div class="field pcs-pay__wide"><label for="pay-email">${f.email}</label><input id="pay-email" name="email" type="email" dir="ltr" inputmode="email" autocomplete="email" enterkeyhint="done" aria-describedby="pay-email-e"><span class="pcs-err" id="pay-email-e"></span></div>
      </div>
      <div class="pcs-pay__mlabel" id="pay-m-l">איך משלמים?</div>
      <div class="pcs-pay__methods" aria-labelledby="pay-m-l">
        ${METHODS.map((m) => `<div class="pcs-method" role="radio" data-value="${m.id}" aria-checked="false" tabindex="-1">${icon(m.ico)}<span lang="${m.id === 'card' ? 'he' : 'en'}">${m.label}</span></div>`).join('')}
      </div>
      <div class="pcs-pay__card" hidden>
        <div class="field pcs-pay__wide"><label for="pay-cc">מספר כרטיס</label><input id="pay-cc" type="text" dir="ltr" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="23"></div>
        <div class="field"><label for="pay-exp">תוקף</label><input id="pay-exp" type="text" dir="ltr" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5"></div>
        <div class="field"><label for="pay-cvv">CVV</label><input id="pay-cvv" type="text" dir="ltr" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4"></div>
      </div>
      <p class="pcs-pay__note">${icon('lock')}<span>זו הדגמה: לא מתבצע חיוב אמיתי.</span></p>
      ${waLine()}
      <p class="pcs-pay__err" role="alert"></p>
      <button type="submit" class="btn btn--fruit btn--lg pcs-pay__submit" data-cursor="שתלו" data-cursor-fill="fruit"><span class="pcs-pay__label"></span></button>
    </form>`;
  const form = body.querySelector<HTMLFormElement>('form')!;
  const name = form.querySelector<HTMLInputElement>('#pay-name')!;
  const phone = form.querySelector<HTMLInputElement>('#pay-phone')!;
  const email = form.querySelector<HTMLInputElement>('#pay-email')!;
  const cardBox = form.querySelector<HTMLElement>('.pcs-pay__card')!;
  const errBox = form.querySelector<HTMLElement>('.pcs-pay__err')!;
  const submit = form.querySelector<HTMLButtonElement>('.pcs-pay__submit')!;
  let method: PayMethod = 'bit';
  let busy = false;
  const mrg = radioGroup(form.querySelector<HTMLElement>('.pcs-pay__methods')!, (v) => {
    tick();
    method = v as PayMethod;
    cardBox.hidden = method !== 'card';
    clearErrs();
  });
  mrg.set(method);
  const payLabel = () => `משלמים ${ils(ctx.pricing().total)}`;
  const paintLabel = () => { form.querySelector('.pcs-pay__label')!.innerHTML = isoPrices(payLabel()); };
  paintLabel();

  const setErr = (inp: HTMLInputElement, msg: string) => {
    inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
    const e = form.querySelector<HTMLElement>(`#${inp.id}-e`);
    if (e) e.textContent = msg;
  };
  const clearErrs = () => { [name, phone, email].forEach((i) => setErr(i, '')); errBox.textContent = ''; };
  [name, phone, email].forEach((i) => i.addEventListener('input', () => setErr(i, '')));
  // card number grouping (mock)
  const cc = form.querySelector<HTMLInputElement>('#pay-cc')!;
  cc.addEventListener('input', () => { cc.value = cc.value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '); });
  const exp = form.querySelector<HTMLInputElement>('#pay-exp')!;
  exp.addEventListener('input', () => { const d = exp.value.replace(/\D/g, '').slice(0, 4); exp.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; });

  const validate = (): boolean => {
    clearErrs();
    let ok = true;
    const ph = phone.value.replace(/[\s-]/g, '');
    const phoneOk = /^(\+?972|0)5\d{8}$/.test(ph) || /^0[2-9]\d{7,8}$/.test(ph);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
    if (name.value.trim().length < 2) { setErr(name, 'כתבו שם מלא'); ok = false; }
    if (phone.value && !phoneOk) { setErr(phone, 'מספר טלפון לא תקין'); ok = false; }
    if (email.value && !emailOk) { setErr(email, 'כתובת אימייל לא תקינה'); ok = false; }
    if (method === 'bit' && !phone.value) { setErr(phone, 'ל־Bit צריך מספר טלפון'); ok = false; }
    if (!phone.value && !email.value) { setErr(phone, 'טלפון או אימייל, כדי לשלוח את התעודה'); ok = false; }
    if (method === 'card') {
      const digits = cc.value.replace(/\D/g, '');
      if (digits.length < 12 || !/^\d{2}\/\d{2}$/.test(exp.value) || !/^\d{3,4}$/.test(form.querySelector<HTMLInputElement>('#pay-cvv')!.value)) {
        errBox.textContent = 'פרטי הכרטיס לא מלאים'; ok = false;
      }
    }
    if (!ok) {
      const first = form.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
      if (ctx.motion()) gsap.fromTo(form, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
    }
    return ok;
  };
  const pay = async () => {
    if (busy || !validate()) return;
    busy = true;
    form.classList.add('is-busy');
    submit.disabled = true;
    form.querySelector('.pcs-pay__label')!.textContent = 'מעבדים את התשלום…';
    ctx.root.querySelector<HTMLButtonElement>('.pc-bar__next')?.setAttribute('disabled', '');
    // desktop from 1024 px: the step row's button is the pay button (plant.css) — it says so too
    const navPay = ctx.root.querySelector<HTMLButtonElement>('.pc__next');
    const navLabel = navPay?.querySelector<HTMLElement>('.pc__next-label');
    const navWas = navLabel?.innerHTML ?? '';
    navPay?.classList.add('is-busy');
    navPay?.setAttribute('aria-disabled', 'true');
    if (navLabel) navLabel.textContent = 'מעבדים את התשלום…';
    try {
      await ctx.purchase({ name: name.value.trim(), phone: phone.value.trim(), email: email.value.trim(), method });
    } finally {
      busy = false;
      form.classList.remove('is-busy');
      submit.disabled = false;
      ctx.root.querySelector<HTMLButtonElement>('.pc-bar__next')?.removeAttribute('disabled');
      navPay?.classList.remove('is-busy');
      navPay?.removeAttribute('aria-disabled');
      if (navLabel) navLabel.innerHTML = navWas;
      paintLabel();
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); pay(); });
  return {
    id: 'checkout', el,
    enter() {
      paintLabel();
      const s = ctx.store.get();
      const pr = ctx.pricing(s);
      track('begin_checkout', { currency: 'ILS', value: pr.total, items: pr.lines.map((l) => ({ item_id: l.id, item_name: l.label, price: l.amount })) });
    },
    update: paintLabel,
    cta: () => ({ label: payLabel(), fruit: true }),
    primary: () => { form.requestSubmit(); },
  };
}
