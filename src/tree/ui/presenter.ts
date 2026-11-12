/* The demo presenter panel — small and quiet. Toggle: the "דמו" button or the "d" key.
   Time of day, weather (in the live version: a weather API for the moshav; here a stub with a
   switch), season, page state, memorial mode, ripe fruit, and a few demo-data helpers. */
import { gsap } from '../../core/gsap';
import { israelNow, type Season } from '../../core/format';
import type { Weather } from '../scene-api';
import { PAGE_STATES, SEASON_HE, WEATHER_HE, type PageState } from '../model';
import { icon } from './icons';
import { el, type Ctx } from './ctx';

const STATE_HE: Record<PageState, string> = {
  before: 'לפני הנטיעה', birth: 'לידה', visit: 'ביקור רגיל', absent: 'אחרי היעדרות', gift: 'מקבלי מתנה', multi: 'כמה עצים', offline: 'בלי רשת',
};

export interface PresenterHooks {
  onSeason(s: Season | null): void;
  onReset(): void;
  onStreak(n: number): void;
  onNewLeaves(n: number): void;
  onWeather(): void;
  onMode(): void;
  onHarvest(on: boolean): void;
}

export class Presenter {
  private btn: HTMLButtonElement;
  private panel: HTMLElement | null = null;
  private liveTimer = 0;

  constructor(private ctx: Ctx, private hooks: PresenterHooks) {
    this.btn = ctx.stage.querySelector<HTMLButtonElement>('[data-demo-open]')!;
    this.btn.addEventListener('click', () => this.toggle());
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'd' && e.key !== 'D' && e.key !== 'ג') return;
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable]')) return;
      this.toggle();
    });
  }

  toggle(force?: boolean) {
    const open = force ?? !this.panel;
    if (!open) { this.close(); return; }
    if (this.panel) return;
    this.build();
  }

  private close() {
    const p = this.panel;
    if (!p) return;
    this.panel = null;
    this.btn.setAttribute('aria-expanded', 'false');
    clearInterval(this.liveTimer);
    const back = p.contains(document.activeElement);
    if (this.ctx.motion()) gsap.to(p, { opacity: 0, y: 10, duration: 0.3, onComplete: () => p.remove() }); else p.remove();
    if (back) this.btn.focus({ preventScroll: true });
  }

  private build() {
    const { ctx } = this;
    const d = ctx.demo;
    const chips = (name: string, opts: [string, string][], cur: string) =>
      `<div class="tdemo__chips" role="radiogroup" aria-label="${name}">${opts.map(([v, l]) => `<button class="tdemo__chip" type="button" role="radio" aria-checked="${v === cur}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const hours = d.hours ?? israelNow().hours;
    const p = el(`
      <div class="tdemo" id="tree-demo" role="dialog" aria-modal="false" aria-labelledby="tdemo-t" data-lenis-prevent>
        <header class="tdemo__head">
          <p class="tdemo__t" id="tdemo-t">${icon('sliders')}<span>מצגת הדמו</span></p>
          <button class="tdemo__x" type="button" aria-label="סגירה">${icon('close')}</button>
        </header>
        <div class="tdemo__group" data-g="state"><p class="tdemo__l">מצב העמוד</p>${chips('מצב העמוד', PAGE_STATES.map((s) => [s, STATE_HE[s]]), ctx.flow)}</div>
        <div class="tdemo__group" data-g="mode"><p class="tdemo__l">סוג העץ</p>${chips('סוג העץ', [['celebration', 'עץ לשמחה'], ['memorial', 'עץ לזכר']], d.mode)}</div>
        <div class="tdemo__group" data-g="hours">
          <p class="tdemo__l"><span>שעה ביער</span><output class="tdemo__out" data-hours-out></output></p>
          <div class="tdemo__row">
            <input class="tdemo__range" type="range" min="0" max="23.75" step="0.25" value="${hours.toFixed(2)}" aria-label="שעה ביער" dir="ltr">
            <button class="tdemo__chip" type="button" aria-pressed="${d.hours == null}" data-live>עכשיו</button>
          </div>
        </div>
        <div class="tdemo__group" data-g="weather"><p class="tdemo__l">מזג האוויר <span class="tdemo__note">(בגרסה החיה: לפי תחזית למושב)</span></p>${chips('מזג האוויר', (['clear', 'wind', 'rain', 'hamsin'] as Weather[]).map((w) => [w, WEATHER_HE[w]]), d.weather)}</div>
        <div class="tdemo__group" data-g="season"><p class="tdemo__l">עונה</p>${chips('עונה', [['auto', 'לפי הלוח'], ...(['spring', 'summer', 'autumn', 'winter'] as Season[]).map((s) => [s, SEASON_HE[s]] as [string, string])], d.season ?? 'auto')}</div>
        <div class="tdemo__group tdemo__group--row">
          <button class="tdemo__chip" type="button" aria-pressed="${d.harvest}" data-harvest>${icon('basket')}<span>פירות בשלים</span></button>
          <button class="tdemo__chip" type="button" data-streak>${icon('leaf')}<span>רצף של 6 ימים</span></button>
          <button class="tdemo__chip" type="button" data-leaves>${icon('sprout')}<span>5 עלים חדשים</span></button>
          <button class="tdemo__chip" type="button" data-reset>${icon('rotate')}<span>מתחילים מחדש</span></button>
        </div>
        <p class="tdemo__foot">המקש <kbd>d</kbd> פותח וסוגר · הכתובת זוכרת את הבחירה</p>
      </div>`);
    ctx.stage.appendChild(p);
    this.panel = p;
    this.btn.setAttribute('aria-expanded', 'true');
    if (ctx.motion()) gsap.fromTo(p, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' });
    p.querySelector('.tdemo__x')!.addEventListener('click', () => this.close());
    p.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } });
    const out = p.querySelector<HTMLOutputElement>('[data-hours-out]')!;
    const range = p.querySelector<HTMLInputElement>('.tdemo__range')!;
    const live = p.querySelector<HTMLButtonElement>('[data-live]')!;
    const fmt = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
    const syncOut = () => { out.textContent = d.hours == null ? `${fmt(israelNow().hours)} · עכשיו בישראל` : fmt(d.hours); };
    syncOut();
    this.liveTimer = window.setInterval(() => { if (d.hours == null) { range.value = String(israelNow().hours); syncOut(); } }, 30_000);
    range.addEventListener('input', () => {
      d.hours = Number(range.value);
      live.setAttribute('aria-pressed', 'false');
      syncOut(); this.url(); ctx.refresh(); this.hooks.onWeather();
    });
    live.addEventListener('click', () => {
      d.hours = null; live.setAttribute('aria-pressed', 'true');
      range.value = String(israelNow().hours); syncOut(); this.url(); ctx.refresh(); this.hooks.onWeather();
    });
    const radio = (g: string, fn: (v: string) => void) => {
      p.querySelectorAll<HTMLButtonElement>(`[data-g="${g}"] [role="radio"]`).forEach((b) => b.addEventListener('click', () => {
        p.querySelectorAll(`[data-g="${g}"] [role="radio"]`).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        fn(b.dataset.v!);
        this.url();
      }));
    };
    radio('state', (v) => { d.state = v as PageState; ctx.run(v as PageState); });
    radio('mode', (v) => { d.mode = v as 'celebration' | 'memorial'; this.hooks.onMode(); });
    radio('weather', (v) => {
      d.weather = v as Weather;
      d.wind = v === 'wind' ? 0.75 : v === 'rain' ? 0.45 : v === 'hamsin' ? 0.15 : 0.22;
      ctx.refresh(); this.hooks.onWeather();
    });
    radio('season', (v) => { d.season = v === 'auto' ? null : (v as Season); this.hooks.onSeason(d.season); });
    const toggleBtn = (sel: string, fn: (on: boolean) => void) => {
      const b = p.querySelector<HTMLButtonElement>(sel)!;
      b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); fn(on); this.url(); });
    };
    toggleBtn('[data-harvest]', (on) => { d.harvest = on; this.hooks.onHarvest(on); });
    p.querySelector('[data-streak]')!.addEventListener('click', () => this.hooks.onStreak(6));
    p.querySelector('[data-leaves]')!.addEventListener('click', () => this.hooks.onNewLeaves(5));
    p.querySelector('[data-reset]')!.addEventListener('click', () => this.hooks.onReset());
    (p.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  /** the URL remembers the demo switches (so a presenter can share a state) */
  url() {
    const { ctx } = this;
    const d = ctx.demo;
    const q = new URLSearchParams(location.search);
    const set = (k: string, v: string | null) => { if (v == null) q.delete(k); else q.set(k, v); };
    set('state', ctx.flow === 'visit' ? null : ctx.flow);
    set('mode', d.mode === 'memorial' ? 'memorial' : null);
    set('hours', d.hours == null ? null : String(d.hours));
    set('weather', d.weather === 'clear' ? null : d.weather);
    set('season', d.season);
    set('harvest', d.harvest ? '1' : null);
    q.delete('birth');
    const s = q.toString();
    history.replaceState(history.state, '', `${location.pathname}${s ? `?${s}` : ''}${location.hash}`);
  }

  syncState() {
    this.panel?.querySelectorAll('[data-g="state"] [role="radio"]').forEach((x) => x.setAttribute('aria-checked', String((x as HTMLElement).dataset.v === this.ctx.flow)));
  }
}
