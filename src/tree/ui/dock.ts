/* ==========================================================================
   Calm cards on the stage — botanical annotations.
   A card never pops over the tree: it sits on the side (desktop) or above the panel (phone)
   and a thin engraved leader line connects it to the point it talks about (fruit, leaf,
   plaque, roots). Also the small toasts and the "money without pressure" cards (7.11).
   ========================================================================== */
import { he } from '../../content/he';
import { prices } from '../../content/prices';
import { ilDate, priceHtml, waLink } from '../../core/format';
import { gsap } from '../../core/gsap';
import { sound } from '../../core/sound';
import type { Hotspot } from '../scene-api';
import { SPECIES, allGreetings, keyDiff, israelDateKey, memorialName, type Greeting } from '../model';
import { icon } from './icons';
import { el, esc, type Ctx } from './ctx';

const NS = 'http://www.w3.org/2000/svg';
type Anchor = string | { x: number; y: number } | null;

interface CardOpts {
  id: string;
  anchor?: Anchor;
  eyebrow?: string;
  title: string;
  body?: string;
  actions?: string;
  kind?: 'note' | 'joy' | 'small';
  focus?: boolean;
  onOpen?: (card: HTMLElement) => void;
  onClose?: () => void;
}

export class Dock {
  private host: HTMLElement;
  private lead: SVGSVGElement;
  private card: HTMLElement | null = null;
  private opts: CardOpts | null = null;
  private returnFocus: HTMLElement | null = null;
  private toastEl: HTMLElement | null = null;
  private toastTimer = 0;
  private plaqueEl: HTMLElement | null = null;

  constructor(private ctx: Ctx) {
    this.host = ctx.stage.querySelector<HTMLElement>('[data-dock]')!;
    this.lead = document.createElementNS(NS, 'svg');
    this.lead.setAttribute('class', 'tdock-lead');
    this.lead.setAttribute('aria-hidden', 'true');
    this.lead.innerHTML = '<path class="tdock-lead__path" pathLength="1"/><circle class="tdock-lead__dot" r="3.2"/><circle class="tdock-lead__ring" r="9"/>';
    ctx.stage.appendChild(this.lead);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.plaqueEl) { this.closePlaque(); return; }
      if (this.card) this.close();
    });
    window.addEventListener('resize', () => this.position(), { passive: true });
  }

  get openId() { return this.opts?.id ?? null; }

  show(o: CardOpts) {
    const { ctx } = this;
    this.closePlaque(true);
    if (this.card) this.close(true);
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.opts = o;
    const id = `tdock-${o.id}`;
    const card = el(`
      <section class="tdock-card tdock-card--${o.kind ?? 'note'}" role="region" aria-labelledby="${id}-t" tabindex="-1" data-card="${esc(o.id)}">
        <button class="tdock-card__x" type="button" aria-label="סגירה">${icon('close')}</button>
        ${o.eyebrow ? `<p class="tdock-card__eyebrow">${o.eyebrow}</p>` : ''}
        <h3 class="tdock-card__title" id="${id}-t">${o.title}</h3>
        ${o.body ? `<div class="tdock-card__body">${o.body}</div>` : ''}
        ${o.actions ? `<div class="tdock-card__actions">${o.actions}</div>` : ''}
      </section>`);
    card.querySelector('.tdock-card__x')!.addEventListener('click', () => this.close());
    this.host.appendChild(card);
    this.card = card;
    this.host.dataset.open = o.kind ?? 'note';
    ctx.stage.dataset.card = o.id;
    o.onOpen?.(card);
    this.position();
    const motion = ctx.motion();
    if (motion) {
      gsap.fromTo(card, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' });
      const path = this.lead.querySelector('path')!;
      gsap.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power3.inOut', delay: 0.1 });
      gsap.fromTo(this.lead.querySelectorAll('circle'), { scale: 0, transformOrigin: 'center', transformBox: 'fill-box' }, { scale: 1, duration: 0.6, ease: 'expo.out' });
    } else {
      gsap.set(card, { opacity: 1, y: 0 });
      gsap.set(this.lead.querySelector('path'), { strokeDashoffset: 0 });
    }
    if (o.focus) card.focus({ preventScroll: true });
    ctx.announce(`${stripTags(o.title)}. ${stripTags(o.body ?? '')}`);
  }

  close(instant = false) {
    const card = this.card;
    if (!card) return;
    const o = this.opts;
    this.card = null; this.opts = null;
    delete this.host.dataset.open;
    delete this.ctx.stage.dataset.card;
    this.lead.classList.remove('is-on');
    const hadFocus = card.contains(document.activeElement);
    if (instant || !this.ctx.motion()) card.remove();
    else gsap.to(card, { opacity: 0, y: 10, duration: 0.35, ease: 'power2.in', onComplete: () => card.remove() });
    o?.onClose?.();
    if (hadFocus && this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
  }

  /** keep the leader line on its point (hotspots move with rotation / growth / resize) */
  position() {
    const card = this.card, o = this.opts;
    if (!card || !o) return;
    const a = this.anchorPoint(o.anchor ?? null);
    if (!a) { this.lead.classList.remove('is-on'); return; }
    const s = this.ctx.stageRect();
    const r = card.getBoundingClientRect();
    const cx0 = r.left - s.left, cy0 = r.top - s.top;
    const mobile = this.ctx.mobile();
    // end point: the card edge facing the anchor
    let ex: number, ey: number;
    if (mobile) { ex = Math.min(Math.max(a.x, cx0 + 28), cx0 + r.width - 28); ey = cy0; }
    else {
      const right = cx0 + r.width, left = cx0;
      ex = a.x > right ? right : a.x < left ? left : a.x;
      ey = Math.min(Math.max(a.y, cy0 + 24), cy0 + Math.min(r.height - 24, 72));
    }
    const midX = mobile ? a.x : a.x + (ex - a.x) * 0.55;
    const d = mobile
      ? `M${a.x} ${a.y}C${a.x} ${a.y + (ey - a.y) * 0.6} ${ex} ${a.y + (ey - a.y) * 0.4} ${ex} ${ey}`
      : `M${a.x} ${a.y}C${midX} ${a.y} ${midX} ${ey} ${ex} ${ey}`;
    this.lead.querySelector('path')!.setAttribute('d', d);
    for (const c of this.lead.querySelectorAll('circle')) { c.setAttribute('cx', String(a.x)); c.setAttribute('cy', String(a.y)); }
    this.lead.classList.add('is-on');
  }

  private anchorPoint(a: Anchor): { x: number; y: number } | null {
    if (!a) return null;
    if (typeof a !== 'string') return a;
    const h = this.ctx.hotspots().find((x) => x.id === a);
    return h && h.visible ? { x: h.x, y: h.y } : null;
  }

  toast(text: string, ic = 'leaf', ms = 3600) {
    this.toastEl?.remove();
    clearTimeout(this.toastTimer);
    const t = el(`<div class="tdock-toast" role="status">${icon(ic)}<span>${text}</span></div>`);
    this.ctx.stage.appendChild(t);
    this.toastEl = t;
    if (this.ctx.motion()) gsap.fromTo(t, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' });
    this.toastTimer = window.setTimeout(() => {
      if (this.ctx.motion()) gsap.to(t, { opacity: 0, y: -8, duration: 0.4, onComplete: () => t.remove() });
      else t.remove();
    }, ms);
  }

  /* ================================================================ hotspot cards */
  fromHotspot(h: Hotspot, viaKeyboard = false, fromScene = false) {
    const { ctx } = this;
    const sp = SPECIES[ctx.tree.species] ?? SPECIES.fig;
    switch (h.kind) {
      case 'fruit': {
        const ripe = ctx.derive().harvestReady;
        this.show({
          id: 'fruit', anchor: h.id, focus: viaKeyboard, eyebrow: sp.he,
          title: he.tree.gestures.whenHarvest,
          body: ripe
            ? `<p>הפירות בשלים עכשיו. הצוות קוטף אותם בימים האלה, ואתם מוזמנים לבוא לקטוף איתנו.</p>`
            : `<p>ה${sp.he} מבשילה ב־${sp.harvest}. כשהפירות יהיו בשלים, נזמין אתכם ליום קטיף ביער.</p>`,
          actions: `<a class="btn btn--sm" href="${waLink(`שלום! נשמח לבוא לקטוף מהעץ שלנו, מס׳ ${ctx.tree.id}`)}" target="_blank" rel="noopener" data-track="tree_card">${icon('basket')}<span>באים לקטוף</span></a>
                    <a class="tdock-link" href="/plant?x=box">מארז מהיער <bdi>${priceHtml(prices.forestBox)}</bdi></a>`,
        });
        break;
      }
      case 'greeting': {
        const gid = h.id.replace(/^greeting-/, '');
        const g = allGreetings(ctx.tree, ctx.store.facts()).find((x) => x.id === gid);
        if (g) this.greeting(g, h.id, viaKeyboard);
        break;
      }
      case 'plaque': this.plaque(viaKeyboard, fromScene); break;
      case 'qr':
        this.show({
          id: 'qr', anchor: 'qr', focus: viaKeyboard, kind: 'small', eyebrow: 'הלוחית הקטנה',
          title: he.tree.qrNote,
          body: `<p>סורקים את הקוד ביער ומגיעים ישר לעמוד הזה.</p>`,
        });
        break;
      case 'ground':
        sound.play('rustle', { volume: 0.3 });
        this.show({
          id: 'roots', anchor: { x: h.x, y: h.y }, focus: viaKeyboard, kind: 'small', eyebrow: 'מתחת לאדמה',
          title: he.tree.gestures.rootsDepth(ctx.tree.rootDepthCm),
        });
        break;
      default: break;
    }
  }

  greeting(g: Greeting, anchor: string | null, viaKeyboard = false) {
    const memorial = this.ctx.demo.mode === 'memorial';
    this.show({
      id: `g-${g.id}`, anchor, focus: viaKeyboard, kind: 'joy',
      eyebrow: memorial ? 'מילים לזכר' : `עלה ברכה · <bdi>${esc(g.initials)}</bdi>`,
      title: `<span class="tdock-quote">${esc(g.text)}</span>`,
      body: `<p class="tdock-meta">${esc(g.from)} · <bdi>${ilDate(g.date)}</bdi></p>`,
    });
  }

  /* ================================================================ plaque: the dedication, large */
  plaque(viaKeyboard = false, fromScene = false) {
    const { ctx } = this;
    if (this.card) this.close(true);
    if (!fromScene) void ctx.scene.focus('plaque');
    this.closePlaque(true);
    const memorial = ctx.demo.mode === 'memorial';
    const p = el(`
      <div class="tplaque" role="region" aria-label="השלט" tabindex="-1">
        <p class="tplaque__eyebrow">${he.tree.number(ctx.tree.id)}</p>
        <p class="tplaque__text">${esc(ctx.tree.dedication)}</p>
        <p class="tplaque__meta">ניטע ב־<bdi>${ilDate(ctx.tree.plantedAt)}</bdi> · ${esc(ctx.tree.plantedBy)}</p>
        <div class="tplaque__actions">
          ${memorial && !ctx.store.candleToday() ? `<button class="btn btn--sm" type="button" data-candle-here>${icon('candle')}<span>${he.tree.memorial.candle}</span></button>` : ''}
          <button class="btn btn--outline btn--sm" type="button" data-back>${icon('back', 'icon')}<span>חוזרים לעץ</span></button>
        </div>
      </div>`);
    p.querySelector('[data-back]')!.addEventListener('click', () => this.closePlaque());
    p.querySelector('[data-candle-here]')?.addEventListener('click', () => {
      (ctx.stage.querySelector('[data-candle]') as HTMLButtonElement | null)?.click();
      p.querySelector('[data-candle-here]')?.remove();
    });
    ctx.stage.appendChild(p);
    ctx.stage.dataset.plaque = '1';
    this.plaqueEl = p;
    if (ctx.motion()) {
      gsap.fromTo(p.children, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: 0.45 * (memorial ? 1.5 : 1) });
    }
    if (viaKeyboard) p.focus({ preventScroll: true });
    ctx.announce(`${ctx.tree.dedication}. ניטע ב־${ilDate(ctx.tree.plantedAt)}, ${ctx.tree.plantedBy}`);
  }
  closePlaque(instant = false) {
    const p = this.plaqueEl;
    if (!p) return;
    this.plaqueEl = null;
    delete this.ctx.stage.dataset.plaque;
    const hadFocus = p.contains(document.activeElement);
    if (!instant) void this.ctx.scene.focus('reset');
    if (instant || !this.ctx.motion()) p.remove();
    else gsap.to(p, { opacity: 0, duration: 0.4, onComplete: () => p.remove() });
    if (hadFocus) (this.ctx.stage.querySelector('[data-hs="plaque"]') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  /* ================================================================ 7.11 money without pressure */
  guardians() {
    if (this.ctx.demo.mode === 'memorial') return;
    const ex = he.plant.extras.find((x) => x.id === 'guardians');
    this.show({
      id: 'guardians', kind: 'joy',
      eyebrow: 'העץ שתה, תודה',
      title: he.tree.upsell.guardians,
      body: `<p>${ex?.text ?? ''}</p><p class="tdock-price">${priceHtml(prices.guardiansMonthly)} <span>${he.pricing.perMonth}</span></p>`,
      actions: `<a class="btn btn--sm" href="/plant?species=${this.ctx.tree.species}&x=guardians">${icon('leaf')}<span>${he.tree.upsell.guardians}</span></a>
                <button class="tdock-link" type="button" data-later>אולי בפעם אחרת</button>`,
      onOpen: (c) => c.querySelector('[data-later]')!.addEventListener('click', () => this.close()),
    });
  }

  harvest() {
    const { ctx } = this;
    const sp = SPECIES[ctx.tree.species] ?? SPECIES.fig;
    const fruit = ctx.hotspots().find((h) => h.kind === 'fruit' && h.visible);
    this.show({
      id: 'harvest', kind: 'joy', anchor: fruit?.id ?? null,
      eyebrow: `ה${sp.he} מבשילה`,
      title: 'הפירות בשלים. באים לקטוף?',
      body: `<p>מזמינים אתכם ליום קטיף ביער, או שנשלח אליכם מארז מהפירות של העץ.</p>`,
      actions: `<a class="btn btn--sm" href="${waLink(`שלום! נשמח להגיע ליום הקטיף של עץ מס׳ ${ctx.tree.id}`)}" target="_blank" rel="noopener" data-track="tree_card">${icon('basket')}<span>באים לקטוף</span></a>
                <a class="tdock-link" href="/plant?x=box">מארז מהיער <bdi>${priceHtml(prices.forestBox)}</bdi></a>`,
    });
  }

  sibling() {
    const { ctx } = this;
    ctx.override.siblingSpot = true;
    ctx.refresh();
    this.show({
      id: 'sibling', kind: 'joy', eyebrow: he.tree.upsell.sibling,
      title: 'יש מקום לעץ נוסף, ממש כאן ליד',
      body: `<p>המקום המסומן על האי שמור לעץ אח. נוטעים אותו, והשניים גדלים יחד.</p>`,
      actions: `<a class="btn btn--fruit btn--sm" href="/plant?species=${ctx.tree.species}&spot=${ctx.tree.id}b" data-cursor="שתלו" data-cursor-fill="fruit">${icon('sprout')}<span>${he.tree.buttons.another}</span></a>`,
      onClose: () => { ctx.override.siblingSpot = false; ctx.refresh(); },
    });
  }

  /* ================================================================ arrival notes */
  missed(days: number) {
    const { ctx } = this;
    const since = ctx.store.previousVisit ?? '';
    const ev = ctx.tree.events.filter((e) => e.date > since);
    const gr = allGreetings(ctx.tree, ctx.store.facts()).filter((g) => g.date > since && !g.mine);
    const items: string[] = [];
    const teamWaterings = Math.max(1, Math.round(days / 3));
    items.push(`<li>${icon('drop')}<span>הצוות השקה את העץ ${teamWaterings === 1 ? 'פעם אחת' : `${teamWaterings} פעמים`}, לפי מה שהוא צריך</span></li>`);
    if (ev.some((e) => e.type === 'pruned')) items.push(`<li>${icon('scissors')}<span>גיזום קל ב־<bdi>${ilDate(ctx.tree.lastPrune ?? '')}</bdi></span></li>`);
    if (gr.length) items.push(`<li>${icon('leaf')}<span>${gr.length === 1 ? 'ברכה חדשה אחת' : `${gr.length} ברכות חדשות`} על הענפים</span></li>`);
    items.push(`<li>${icon('ruler')}<span>הגובה היום: <bdi>${ctx.tree.heightCm}</bdi> ס״מ</span></li>`);
    this.show({
      id: 'missed', kind: 'note', eyebrow: `לא הייתם כאן ${days} ימים`,
      title: he.tree.states.missedYou,
      body: `<ul class="tdock-list" role="list">${items.join('')}</ul>`,
    });
  }

  news() {
    const { ctx } = this;
    const today = israelDateKey();
    const recent = ctx.tree.events.filter((e) => keyDiff(e.date, today) <= 14).slice(-3).reverse();
    const gr = allGreetings(ctx.tree, ctx.store.facts()).filter((g) => keyDiff(g.date, today) <= 7);
    const label: Record<string, string> = { teamWatering: 'הצוות השקה את העץ', pruned: 'גיזום קל לפני החורף', planted: he.tree.milestones[0], firstLeaves: he.tree.milestones[1], firstSummer: he.tree.milestones[2] };
    const items = [
      ...gr.map((g) => `<li>${icon('leaf')}<span>ברכה מ${esc(g.from)}: „${esc(g.text)}”</span></li>`),
      ...recent.map((e) => `<li>${icon(e.type === 'pruned' ? 'scissors' : e.type === 'teamWatering' ? 'drop' : 'sprout')}<span>${label[e.type] ?? ''} · <bdi>${ilDate(e.date)}</bdi></span></li>`),
    ];
    this.show({ id: 'news', kind: 'note', anchor: 'leaf', title: he.tree.states.news, body: `<ul class="tdock-list" role="list">${items.join('')}</ul>` });
  }

  newLeaves(n: number) {
    const { ctx } = this;
    const owner = ctx.tree.owner || 'שלום';
    this.show({
      id: 'newleaves', kind: 'joy', anchor: ctx.hotspots().find((h) => h.kind === 'greeting' && h.visible)?.id ?? 'leaf',
      eyebrow: he.tree.greetings.everyGreeting,
      title: he.tree.greetings.newLeaves(owner, n),
      body: `<p>נוגעים בעלה שזוהר, וקוראים את הברכה.</p>`,
      actions: `<a class="tdock-link" href="#feed">כל הברכות ביומן העץ</a>`,
    });
  }

  memorialNote() {
    const name = memorialName(this.ctx.tree.dedication);
    this.toast(`${he.tree.memorial.words(name)}`, 'leaf', 3000);
  }
}

function stripTags(s: string) { return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
