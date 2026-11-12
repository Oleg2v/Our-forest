/* ==========================================================================
   The action panel under the thumb.
   · celebration: the watering ritual (7.5) — hold the 72px drop, the ring fills (counts from
     0.6 s, full at 1.5 s), the can tilts, water arcs onto the soil, the community counter rolls +1,
     one watering a day (then the drop sleeps), a vine of days around the button.
   · memorial (7.12): no game — "מדליקים נר" lights a candle by the plaque, free.
   · before planting (7.3): the countdown.
   ========================================================================== */
import { he } from '../../content/he';
import { prices } from '../../content/prices';
import { sound, type LoopHandle } from '../../core/sound';
import { track } from '../../core/analytics';
import { bus } from '../../core/bus';
import { gsap } from '../../core/gsap';
import { durationHe, msUntilIsraelMidnight, memorialName } from '../model';
import { Odometer } from './odometer';
import { WaterFx } from './fx';
import { icon } from './icons';
import { el, type Ctx } from './ctx';
import type { Dock } from './dock';

const FULL = 1500;
const COUNTS = 600;
const VINE_DAYS = 14;
const R_RING = 46, R_VINE = 58, C = 66;

export class Panel {
  private root: HTMLElement;
  private wp: HTMLElement = document.createElement('div');
  private fx: WaterFx;
  private odo: Odometer;
  private btn!: HTMLButtonElement;
  private ring!: SVGCircleElement;
  private level!: SVGRectElement;
  private vine!: SVGPathElement;
  private vineLeaves!: SVGGElement;
  private cap!: HTMLElement;
  private next!: HTMLElement;
  private hold = { on: false, t0: 0, raf: 0, counted: false, auto: false, pointer: -1 };
  private loop: LoopHandle | null = null;
  private lastPointerUp = 0;
  private nextTimer = 0;
  private candle: HTMLElement | null = null;
  private kind: 'water' | 'candle' | 'countdown' | '' = '';

  constructor(private ctx: Ctx, private dock: Dock, fxCanvas: HTMLCanvasElement) {
    this.root = ctx.stage.querySelector<HTMLElement>('[data-panel]')!;
    this.fx = new WaterFx(ctx.stage, fxCanvas);
    const base = ctx.tree.community.wateringsToday + (ctx.store.wateredToday() ? 1 : 0);
    this.odo = new Odometer(base, 'wp__odo');
    bus.on('motion:change', () => this.render());
  }

  setTone(t: 'light' | 'dark') { this.fx.setTone(t); }

  /** build the panel for the current mode / flow */
  render() {
    const { ctx } = this;
    const want = ctx.flow === 'before' && !ctx.derive().planted ? 'countdown' : ctx.demo.mode === 'memorial' ? 'candle' : 'water';
    this.cancel(true);
    clearInterval(this.nextTimer);
    this.kind = want;
    this.root.dataset.kind = want;
    if (want === 'water') this.buildWater();
    else if (want === 'candle') this.buildCandle();
    else this.buildCountdown();
  }

  /* ================================================================ water */
  private buildWater() {
    const { ctx } = this;
    const sponsor = ctx.tree.community.sponsor;
    this.root.innerHTML = `
      <div class="wp" data-wp>
        <div class="wp__hold">
          <svg class="wp__vine" viewBox="0 0 132 132" aria-hidden="true">
            <path class="wp__vine-path" pathLength="1" d="${vinePath()}"/>
            <g class="wp__vine-leaves"></g>
          </svg>
          <svg class="wp__ring" viewBox="0 0 132 132" aria-hidden="true">
            <circle class="wp__ring-track" cx="${C}" cy="${C}" r="${R_RING}"/>
            <circle class="wp__ring-fill" cx="${C}" cy="${C}" r="${R_RING}" pathLength="1" transform="translate(${2 * C} 0) scale(-1 1) rotate(-90 ${C} ${C})"/>
            <path class="wp__ring-tick" d="${tickPath(COUNTS / FULL)}"/>
          </svg>
          <button class="wp__btn" type="button" data-water aria-describedby="wp-cap wp-honest">
            <svg class="wp__drop" viewBox="0 0 24 24" aria-hidden="true">
              <defs><clipPath id="wp-drop-clip"><path d="M12 3.5c3.2 4 5.5 7.1 5.5 10a5.5 5.5 0 0 1-11 0c0-2.9 2.3-6 5.5-10Z"/></clipPath></defs>
              <rect class="wp__drop-level" clip-path="url(#wp-drop-clip)" x="4" y="3" width="16" height="18"/>
              <path class="wp__drop-line" d="M12 3.5c3.2 4 5.5 7.1 5.5 10a5.5 5.5 0 0 1-11 0c0-2.9 2.3-6 5.5-10Z"/>
              <path class="wp__drop-sleep" d="M9.6 14.2c.6.6 1.4.6 2 0M12.6 14.2c.6.6 1.4.6 2 0"/>
            </svg>
            <span class="visually-hidden" data-water-label>${he.tree.water.hold}</span>
          </button>
        </div>
        <div class="wp__text">
          <p class="wp__cap" id="wp-cap" data-cap>${he.tree.water.hold}</p>
          <p class="wp__next" data-next hidden></p>
          <button class="wp__alt" type="button" data-alt>${icon('drop')}<span>משקים בלחיצה אחת</span></button>
        </div>
        <div class="wp__community">
          <p class="wp__count"><span class="wp__count-num" data-odo></span><span class="wp__count-label">${he.tree.water.communitySponsored(sponsor)}</span></p>
          <div class="wp__goal" aria-hidden="true"><span class="wp__goal-bar" data-goal></span>${icon('tree', 'icon wp__goal-ic')}</div>
          <p class="wp__goal-t" data-goal-t></p>
        </div>
        <p class="wp__honest" id="wp-honest">${he.tree.water.honest}</p>
        <div class="wp__sides">
          <button class="wp-side wp-side--invite" type="button" data-invite>
            <span class="wp-side__ic">${icon('invite')}</span><span class="wp-side__t">${he.tree.greetings.inviteFriends}</span>
          </button>
          <button class="wp-side wp-side--share" type="button" data-share>
            <span class="wp-side__ic">${icon('share')}</span><span class="wp-side__t">${he.tree.buttons.share}</span>
          </button>
        </div>
      </div>`;
    this.wp = this.root.querySelector<HTMLElement>('[data-wp]')!;
    this.root.querySelector('[data-odo]')!.appendChild(this.odo.el);
    this.btn = this.root.querySelector<HTMLButtonElement>('[data-water]')!;
    this.ring = this.root.querySelector<SVGCircleElement>('.wp__ring-fill')!;
    this.level = this.root.querySelector<SVGRectElement>('.wp__drop-level')!;
    this.vine = this.root.querySelector<SVGPathElement>('.wp__vine-path')!;
    this.vineLeaves = this.root.querySelector<SVGGElement>('.wp__vine-leaves')!;
    this.cap = this.root.querySelector<HTMLElement>('[data-cap]')!;
    this.next = this.root.querySelector<HTMLElement>('[data-next]')!;
    this.root.querySelector('[data-invite]')!.addEventListener('click', () => ctx.openGreet());
    this.root.querySelector('[data-share]')!.addEventListener('click', () => ctx.openShare());
    this.root.querySelector('[data-alt]')!.addEventListener('click', () => this.start(true));
    this.updateGoal(false);
    this.bindHold();
    this.drawVine(false);
    this.setLevel(ctx.store.wateredToday() ? 0 : 1);
    this.setRing(0);
    this.syncDone(false);
  }

  private updateGoal(animate: boolean) {
    const goal = this.ctx.tree.community.goal || 1000;
    const n = this.odo.get();
    const left = goal - (n % goal);
    const bar = this.root.querySelector<HTMLElement>('[data-goal]');
    const t = this.root.querySelector<HTMLElement>('[data-goal-t]');
    if (bar) gsap.to(bar, { scaleX: (n % goal) / goal, duration: animate ? 1.2 : 0, ease: 'expo.out' });
    if (t) t.textContent = `עוד ${new Intl.NumberFormat('he-IL').format(left)} השקיות, והחברה נוטעת עץ חדש ביער`;
  }

  private bindHold() {
    const b = this.btn;
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      sound.unlock();
      try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      this.hold.pointer = e.pointerId;
      this.start(false);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.hold.pointer) return;
      this.hold.pointer = -1;
      this.lastPointerUp = performance.now();
      this.release();
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    // keyboard: Enter / Space start; a short press still waters in full (single-button alternative)
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') { if (e.key === 'Escape') this.cancel(false); return; }
      e.preventDefault();
      if (e.repeat || this.hold.on) return;
      sound.unlock();
      this.start(false);
      this.hold.auto = false;
    });
    b.addEventListener('keyup', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!this.hold.on) return;
      // released early → keep pouring automatically to the full ring
      if (performance.now() - this.hold.t0 < FULL) this.hold.auto = true;
    });
    // assistive tech / virtual cursor clicks (no pointer, no key) → one full watering
    b.addEventListener('click', (e) => {
      if (performance.now() - this.lastPointerUp < 600) return;
      if ((e as PointerEvent).detail > 0) return;
      if (this.hold.on) return;
      this.start(true);
    });
  }

  private locked() { return this.ctx.store.wateredToday(); }

  /** begin pouring; auto = pour to the full ring without holding */
  start(auto: boolean) {
    const { ctx } = this;
    if (this.kind !== 'water' || this.hold.on) return;
    if (ctx.stage.dataset.time) return;
    if (this.locked()) { this.sleepyNudge(); return; }
    const h = this.hold;
    h.on = true; h.t0 = performance.now(); h.counted = false; h.auto = auto;
    this.wp.classList.add('is-holding');
    this.wp.classList.remove('is-short');
    const motion = ctx.motion();
    ctx.scene.waterStart();
    const target = this.soilPoint();
    this.fx.enter(target, motion);
    if (motion) this.fx.start();
    this.loop = sound.loop('water', { volume: 0.35 });
    sound.haptic(14);
    this.cap.textContent = he.tree.water.hold;
    const tick = () => {
      if (!h.on) return;
      const t = performance.now() - h.t0;
      const p = Math.min(1, t / FULL);
      this.setRing(p);
      this.setLevel(1 - p * 0.92);
      ctx.scene.waterProgress(p);
      this.fx.setRate(p);
      this.loop?.setVolume(0.35 + p * 1.15);
      if (!h.counted && t >= COUNTS) { h.counted = true; this.wp.classList.add('is-counted'); sound.haptic(6); }
      if (p >= 1) { this.finish(true); return; }
      h.raf = requestAnimationFrame(tick);
    };
    h.raf = requestAnimationFrame(tick);
  }

  private release() {
    const h = this.hold;
    if (!h.on || h.auto) return;
    const t = performance.now() - h.t0;
    if (t < COUNTS) this.finish(false);
    else this.finish(true);
  }

  /** stop without counting (Esc, flow change) */
  cancel(silent: boolean) {
    if (!this.hold.on) return;
    if (silent) {
      this.hold.on = false; cancelAnimationFrame(this.hold.raf);
      this.loop?.stop(0.2); this.loop = null; this.fx.stop(); this.fx.leave(false);
      this.wp.classList.remove('is-holding', 'is-counted');
      void this.ctx.scene.waterEnd(false);
      return;
    }
    this.finish(false);
  }

  private async finish(ok: boolean) {
    const { ctx } = this;
    const h = this.hold;
    if (!h.on) return;
    h.on = false;
    cancelAnimationFrame(h.raf);
    this.loop?.stop(ok ? 0.6 : 0.3); this.loop = null;
    this.fx.stop();
    const motion = ctx.motion();
    this.fx.leave(motion);
    this.wp.classList.remove('is-holding', 'is-counted');
    if (!ok) {
      // too short: the ring drains back, a gentle hint — no penalty
      this.wp.classList.add('is-short');
      this.setRing(0, true);
      this.setLevel(1, true);
      this.cap.textContent = 'מחזיקים עוד רגע, עד שהטבעת מתמלאת';
      void ctx.scene.waterEnd(false);
      return;
    }
    // counted
    this.setRing(1);
    sound.haptic([6, 60, 10]);
    const offline = !ctx.online;
    ctx.store.water();
    if (offline) ctx.store.enqueue();
    const streak = ctx.store.streak();
    track('tree_watered', { tree_id: ctx.tree.id, streak, offline });
    bus.emit('tree:watered', { streak });
    const endP = ctx.scene.waterEnd(true);
    setTimeout(() => sound.play('rustle', { volume: 0.5 }), motion ? 1150 : 0);
    // the counter rolls when the water reaches the soil
    setTimeout(() => {
      if (!offline) { this.odo.set(this.odo.get() + 1, motion); this.updateGoal(motion); }
    }, motion ? 420 : 0);
    setTimeout(() => this.drawVine(motion, true), motion ? 900 : 0);
    this.setLevel(0, true);
    const n = new Intl.NumberFormat('he-IL').format(this.odo.get() + (offline ? 0 : 1));
    ctx.announce(offline ? 'ההשקיה נשמרה ותישלח כשהחיבור יחזור' : `העץ שתה. ${he.tree.water.community}: ${n}`);
    // the drop falls asleep when the water has soaked in (not tied to the scene's promise)
    if (motion) await Promise.race([endP, new Promise((r) => setTimeout(r, 2400))]);
    this.syncDone(motion);
    ctx.refresh();
    if (offline) this.dock.toast('ההשקיה נשמרה ותישלח כשהחיבור יחזור', 'wifiOff');
    // a calm card in a moment of joy: after the first watering → "שומרי העץ"
    if (!ctx.store.data.guardiansSeen) {
      ctx.store.data.guardiansSeen = true; ctx.store.save();
      setTimeout(() => this.dock.guardians(), motion ? 900 : 200);
    }
  }

  /** the drop sleeps until tomorrow */
  private syncDone(motion: boolean) {
    const done = this.locked();
    this.wp.classList.toggle('is-done', done);
    this.btn.setAttribute('aria-disabled', done ? 'true' : 'false');
    const label = this.root.querySelector('[data-water-label]')!;
    clearInterval(this.nextTimer);
    if (!done) {
      this.cap.textContent = he.tree.water.hold;
      this.next.hidden = true;
      label.textContent = he.tree.water.hold;
      this.setRing(0, motion);
      return;
    }
    this.cap.textContent = he.tree.water.done;
    const upd = () => { this.next.textContent = `ההשקיה הבאה בעוד ${durationHe(msUntilIsraelMidnight())}`; };
    upd();
    this.nextTimer = window.setInterval(upd, 30_000);
    this.next.hidden = false;
    label.textContent = `${he.tree.water.done}. ${this.next.textContent}`;
    this.setLevel(0, motion);
    this.setRing(0, motion);
    if (motion) gsap.fromTo([this.cap, this.next], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08 });
  }

  private sleepyNudge() {
    this.ctx.announce(`${he.tree.water.done}. ${this.next.textContent ?? ''}`);
    if (!this.ctx.motion()) return;
    gsap.fromTo(this.btn, { scale: 1 }, { scale: 0.94, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.inOut' });
    gsap.fromTo(this.next, { opacity: 0.4 }, { opacity: 1, duration: 0.8 });
  }

  private setRing(p: number, ease = false) {
    if (!this.ring) return;
    this.ring.dataset.p = String(p);
    this.ring.style.transition = ease ? 'stroke-dashoffset .5s var(--ease-out)' : 'none';
    this.ring.style.strokeDashoffset = String(1 - p);
  }
  private setLevel(l: number, ease = false) {
    if (!this.level) return;
    // the water level inside the drop (y 3 → 21)
    const y = 3 + (1 - l) * 18;
    if (ease) gsap.to(this.level, { attr: { y }, duration: 0.9, ease: 'power2.inOut' });
    else { gsap.killTweensOf(this.level); this.level.setAttribute('y', String(y)); }
  }

  /** the streak: a thin vine around the button, one leaf a day */
  private drawVine(animate: boolean, grewToday = false) {
    if (!this.vine) return;
    const n = Math.min(this.ctx.store.streak(), VINE_DAYS);
    const len = n === 0 ? 0 : Math.min(1, (n - 0.35) / VINE_DAYS + 0.04);
    // (set the style directly: gsap rounds px values, and the path is 1 unit long)
    const vine = this.vine;
    const setOff = (v: number) => { vine.style.strokeDashoffset = v.toFixed(4); };
    if (animate) {
      const o = { v: parseFloat(vine.style.strokeDashoffset || '1') || 1 };
      gsap.to(o, { v: 1 - len, duration: 1.4, ease: 'expo.out', onUpdate: () => setOff(o.v) });
    } else setOff(1 - len);
    const g = this.vineLeaves;
    const have = g.childElementCount;
    if (have > n) g.innerHTML = '';
    for (let i = g.childElementCount; i < n; i++) {
      const a = -Math.PI / 2 - ((i + 0.65) / VINE_DAYS) * Math.PI * 2;
      const x = C + Math.cos(a) * R_VINE, y = C + Math.sin(a) * R_VINE;
      const out = i % 2 === 0 ? 1 : -1;
      const deg = (a * 180) / Math.PI + (out > 0 ? 0 : 180) + 18 * out;
      const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      leaf.setAttribute('class', 'wp__vine-leaf');
      leaf.setAttribute('d', 'M0 0C2.2-2.6 6.2-3 8.6-.4 6.2 2.4 2.2 2.4 0 0Z');
      leaf.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})`);
      g.appendChild(leaf);
      if (animate && (grewToday ? i === n - 1 : true)) {
        gsap.fromTo(leaf, { scale: 0, transformOrigin: '0px 0px' }, { scale: 1, duration: 0.9, delay: grewToday ? 0.5 : i * 0.04, ease: 'elastic.out(1, 0.55)' });
      }
    }
    const sr = n ? `רצף של ${n === 1 ? 'יום אחד' : `${n} ימים`}` : '';
    this.btn?.setAttribute('aria-roledescription', 'כפתור השקיה');
    if (sr) this.btn?.setAttribute('title', sr); else this.btn?.removeAttribute('title');
  }

  /** where the water lands: the soil in front of the trunk */
  soilPoint(): { x: number; y: number } {
    const hs = this.ctx.hotspots();
    const trunk = hs.find((h) => h.id === 'trunk');
    const plaque = hs.find((h) => h.id === 'plaque');
    const r = this.ctx.stageRect();
    if (trunk && plaque) {
      // the plaque stands in the soil in front of the trunk; the soil surface is a bit below its centre
      const y = plaque.y + Math.max(10, (plaque.y - trunk.y) * 0.42);
      return { x: trunk.x - 2, y };
    }
    return { x: r.width * 0.47, y: r.height * 0.6 };
  }

  /* ================================================================ memorial */
  private buildCandle() {
    const { ctx } = this;
    const name = memorialName(ctx.tree.dedication);
    const lit = ctx.store.candleToday();
    this.root.innerHTML = `
      <div class="wp wp--candle" data-wp>
        <div class="wp__hold">
          <button class="wp__btn wp__btn--candle" type="button" data-candle aria-pressed="${lit}">
            ${icon('candle', 'icon wp__candle-ic')}
            <span class="visually-hidden">${he.tree.memorial.candle}</span>
          </button>
        </div>
        <div class="wp__text">
          <p class="wp__cap" data-cap>${lit ? 'הנר דולק ליד השלט' : he.tree.memorial.candle}</p>
          <p class="wp__next">${lit ? `לזכר ${name}` : 'ליד השלט, בלי תשלום'}</p>
        </div>
        <div class="wp__sides">
          <button class="wp-side wp-side--invite" type="button" data-words>
            <span class="wp-side__ic">${icon('leaf')}</span><span class="wp-side__t">${he.tree.memorial.words(name)}</span>
          </button>
          <button class="wp-side wp-side--share" type="button" data-share>
            <span class="wp-side__ic">${icon('share')}</span><span class="wp-side__t">${he.tree.buttons.share}</span>
          </button>
        </div>
      </div>`;
    this.wp = this.root.querySelector<HTMLElement>('[data-wp]')!;
    this.root.querySelector('[data-share]')!.addEventListener('click', () => ctx.openShare());
    this.root.querySelector('[data-words]')!.addEventListener('click', () => ctx.openGreet());
    const b = this.root.querySelector<HTMLButtonElement>('[data-candle]')!;
    this.btn = b;
    b.addEventListener('click', () => {
      if (ctx.store.candleToday()) { this.placeCandle(false); return; }
      sound.unlock();
      ctx.store.lightCandle();
      b.setAttribute('aria-pressed', 'true');
      sound.play('chime', { volume: 0.35 });
      this.placeCandle(ctx.motion());
      this.root.querySelector('[data-cap]')!.textContent = 'הנר דולק ליד השלט';
      this.root.querySelector('.wp__next')!.textContent = `לזכר ${name}`;
      ctx.announce(`הנר דולק ליד השלט, לזכר ${name}`);
    });
    if (lit) this.placeCandle(false);
  }

  /** the candle stands on the soil next to the plaque (follows the hotspot) */
  placeCandle(animate: boolean) {
    if (!this.candle) {
      this.candle = el(`<div class="tree-candle" aria-hidden="true">
        <span class="tree-candle__glow"></span>
        <svg class="tree-candle__svg" viewBox="0 0 24 40"><path class="tree-candle__flame" d="M12 4c-2.6 3.4-3.4 6-1.6 8.2.9 1 2.3 1 3.2 0C15.4 10 14.6 7.4 12 4Z"/><path class="tree-candle__wick" d="M12 12.4v2"/><path class="tree-candle__body" d="M8.5 14.6h7v20.2c0 .7-.5 1.2-1.2 1.2H9.7c-.7 0-1.2-.5-1.2-1.2Z"/><path class="tree-candle__base" d="M5 36.4h14"/></svg>
      </div>`);
      this.ctx.stage.appendChild(this.candle);
    }
    this.positionCandle();
    if (animate) gsap.fromTo(this.candle, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.8, ease: 'power2.out' });
    else gsap.set(this.candle, { opacity: 1, y: 0 });
  }
  positionCandle() {
    if (!this.candle) return;
    const hs = this.ctx.hotspots();
    const p = hs.find((h) => h.id === 'plaque');
    const t = hs.find((h) => h.id === 'trunk');
    const zoomed = !!this.ctx.stage.dataset.plaque;
    if (!p || !p.visible || zoomed) { this.candle.style.visibility = 'hidden'; return; }
    this.candle.style.visibility = '';
    // on the soil, just beside the plaque (the plaque's centre stands above the soil)
    const lift = t ? Math.max(10, (p.y - t.y) * 0.42) : 24;
    const half = t ? Math.max(30, (p.y - t.y) * 0.75) : 48;
    this.candle.style.left = `${p.x - half - 12}px`;
    this.candle.style.top = `${p.y + lift}px`;
  }
  removeCandle() { this.candle?.remove(); this.candle = null; }

  /* ================================================================ before planting */
  private buildCountdown() {
    const days = 9;
    this.root.innerHTML = `
      <div class="wp wp--count" data-wp>
        <p class="wp__days" aria-hidden="true"><span class="wp__days-n">${days}</span><span class="wp__days-l">ימים</span></p>
        <div class="wp__text">
          <p class="wp__cap">${he.tree.states.plantingIn(days)}</p>
          <p class="wp__next">כשהצוות ישתול את העץ, תקבלו הודעה</p>
        </div>
      </div>`;
  }

  /** after an online flush (offline → online): the queued watering is now counted */
  flushed(n: number) {
    if (!n || this.kind !== 'water') return;
    this.odo.set(this.odo.get() + n, this.ctx.motion());
    this.updateGoal(this.ctx.motion());
  }

  get price() { return prices.guardiansMonthly; }
}

/* ------------------------------------------------------------------ geometry */
function vinePath(): string {
  // a slightly wavy circle starting at the top, running counter-clockwise (the RTL "forward")
  const pts: string[] = [];
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = -Math.PI / 2 - t * Math.PI * 2;
    const r = R_VINE + Math.sin(t * Math.PI * 2 * 9) * 1.6;
    pts.push(`${(C + Math.cos(a) * r).toFixed(2)} ${(C + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}`;
}
function tickPath(frac: number): string {
  // the 0.6 s mark on the ring
  const a = -Math.PI / 2 - frac * Math.PI * 2;
  const r1 = R_RING - 4, r2 = R_RING + 4;
  return `M${(C + Math.cos(a) * r1).toFixed(2)} ${(C + Math.sin(a) * r1).toFixed(2)}L${(C + Math.cos(a) * r2).toFixed(2)} ${(C + Math.sin(a) * r2).toFixed(2)}`;
}
