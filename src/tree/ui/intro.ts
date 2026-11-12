/* ==========================================================================
   Arrivals (7.3 / 7.4): the birth with its caption, the gift envelope, the planting notice.
   ========================================================================== */
import { he } from '../../content/he';
import { ilDate } from '../../core/format';
import { gsap } from '../../core/gsap';
import { sound } from '../../core/sound';
import { israelDateKey } from '../model';
import { icon } from './icons';
import { el, esc, sleep, type Ctx } from './ctx';

export class Intro {
  private abort: AbortController | null = null;
  private layer: HTMLElement | null = null;
  private skipBtn: HTMLElement | null = null;
  private onStageTap = (e: Event) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    this.ctx.scene.skipBirth();
  };

  constructor(private ctx: Ctx) {}

  /** stop whatever arrival is running (presenter switches) */
  stop() {
    this.abort?.abort();
    this.abort = null;
    this.ctx.stage.removeEventListener('pointerup', this.onStageTap, true);
    this.layer?.remove(); this.layer = null;
    this.skipBtn?.remove(); this.skipBtn = null;
    this.ctx.stage.querySelector('.tbirth')?.remove();
    this.ctx.stage.querySelector('.tgift')?.remove();
    this.ctx.stage.querySelector('.tnotice')?.remove();
    delete this.ctx.stage.dataset.birth;
    this.veil(false, true);
  }

  private veil(on: boolean, instant = false) {
    const v = this.ctx.stage.querySelector<HTMLElement>('[data-veil]')!;
    if (instant || !this.ctx.motion()) { gsap.set(v, { opacity: on ? 1 : 0 }); v.classList.toggle('is-on', on); return; }
    v.classList.add('is-on');
    gsap.to(v, { opacity: on ? 1 : 0, duration: on ? 0.6 : 1.1, ease: 'power2.inOut', onComplete: () => { if (!on) v.classList.remove('is-on'); } });
  }

  /* ================================================================ birth 7.4 */
  async birth(dateKey: string) {
    const { ctx } = this;
    this.stop();
    const ac = new AbortController();
    this.abort = ac;
    ctx.setIntro(true);
    ctx.stage.dataset.birth = 'playing';
    // skippable by a tap on the stage, by Esc, or by the quiet button
    ctx.stage.addEventListener('pointerup', this.onStageTap, true);
    const skip = el(`<button class="tbirth-skip" type="button">${icon('arrow', 'icon arrow-fwd')}<span>דלגו</span></button>`);
    skip.addEventListener('click', () => ctx.scene.skipBirth());
    ctx.stage.appendChild(skip);
    this.skipBtn = skip;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') ctx.scene.skipBirth(); };
    document.addEventListener('keydown', onKey);
    if (ctx.motion()) gsap.fromTo(skip, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 1.2 });
    const eyebrow = el(`<p class="tbirth-eyebrow" aria-hidden="true">${he.tree.number(ctx.tree.id)}</p>`);
    ctx.stage.appendChild(eyebrow);
    if (ctx.motion()) gsap.fromTo(eyebrow, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', delay: 0.3 });
    ctx.announce('העץ שלכם נולד עכשיו: זרע באדמה נסדק, שורש יורד, נבט עולה, והשלט עולה מהאדמה');
    let shown = false;
    const showCaption = () => { if (shown || ac.signal.aborted) return; shown = true; this.caption(dateKey); };
    await ctx.scene.playBirth({
      signal: ac.signal,
      onPhase: (p) => {
        ctx.stage.dataset.birthPhase = p;
        // close-up on dark soil → light header; back to the scene's tone from the reveal on
        const dark = p === 'soil' || p === 'crack' || p === 'sprout';
        ctx.stage.dataset.header = dark || ctx.main.dataset.tone === 'dark' ? 'light' : 'dark';
        if (p === 'reveal' && ctx.motion()) gsap.to(eyebrow, { opacity: 0, duration: 0.6 });
        if (p === 'done') showCaption();
      },
    });
    document.removeEventListener('keydown', onKey);
    ctx.stage.removeEventListener('pointerup', this.onStageTap, true);
    eyebrow.remove();
    if (ac.signal.aborted) return;
    showCaption();
    skip.remove(); this.skipBtn = null;
    ctx.store.data.birthSeen = true; ctx.store.save();
  }

  /** 6.0–7.5 s: "העץ שלכם נולד" + date + "משקים בפעם הראשונה" / "משתפים" */
  private caption(dateKey: string) {
    const { ctx } = this;
    ctx.stage.dataset.birth = 'caption';
    sound.play('chime', { volume: 0.45 });
    const words = he.tree.states.born.split(' ').map((w) => `<span class="tbirth__w"><span>${w}</span></span>`).join(' ');
    const c = el(`
      <div class="tbirth" role="group" aria-labelledby="tbirth-t">
        <h2 class="tbirth__title" id="tbirth-t">${words}</h2>
        <p class="tbirth__date"><bdi>${ilDate(dateKey)}</bdi></p>
        <div class="tbirth__actions">
          <button class="btn btn--lg tbirth__water" type="button" data-first>${icon('drop')}<span>${he.tree.birth.waterFirst}</span></button>
          <button class="btn btn--outline btn--lg" type="button" data-share>${icon('share')}<span>${he.tree.birth.share}</span></button>
        </div>
      </div>`);
    ctx.stage.appendChild(c);
    ctx.stage.dataset.intro = 'caption';
    ctx.announce(`${he.tree.states.born}, ${ilDate(dateKey)}`);
    const done = (then: () => void) => {
      delete ctx.stage.dataset.birth;
      const fin = () => { c.remove(); ctx.setIntro(false); then(); };
      if (ctx.motion()) gsap.to(c, { opacity: 0, y: 12, duration: 0.45, ease: 'power2.in', onComplete: fin });
      else fin();
    };
    c.querySelector('[data-first]')!.addEventListener('click', () => done(() => ctx.focusWater()));
    c.querySelector('[data-share]')!.addEventListener('click', () => done(() => ctx.openShare()));
    if (ctx.motion()) {
      gsap.fromTo(c.querySelectorAll('.tbirth__w > span'), { yPercent: 110 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08 });
      gsap.fromTo(c.querySelectorAll('.tbirth__date, .tbirth__actions'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, delay: 0.35 });
    }
    (c.querySelector('[data-first]') as HTMLElement).focus({ preventScroll: true });
  }

  /* ================================================================ before planting 7.3 */
  async beforePlanting() {
    const { ctx } = this;
    this.stop();
    const ac = new AbortController();
    this.abort = ac;
    // the seed lies in the cut, the countdown in the panel; in the demo the planting comes right away
    await sleep(ctx.motion() ? 4200 : 2400);
    if (ac.signal.aborted) return;
    const n = el(`
      <button class="tnotice" type="button" aria-describedby="tnotice-t">
        <span class="tnotice__ic">${icon('bell')}</span>
        <span class="tnotice__txt"><span class="tnotice__app">${he.brand} · עכשיו</span><span class="tnotice__t" id="tnotice-t">${he.tree.states.planted}</span></span>
      </button>`);
    ctx.stage.appendChild(n);
    sound.play('chime', { volume: 0.3 });
    ctx.announce(he.tree.states.planted, true);
    if (ctx.motion()) gsap.fromTo(n, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out' });
    const go = () => {
      if (ac.signal.aborted) return;
      ac.abort();
      const fin = () => { n.remove(); ctx.flow = 'birth'; ctx.demo.state = 'birth'; ctx.refresh(); void this.birth(israelDateKey()); };
      if (ctx.motion()) gsap.to(n, { y: -30, opacity: 0, duration: 0.45, ease: 'power2.in', onComplete: fin }); else fin();
    };
    n.addEventListener('click', go);
    await sleep(2600);
    go();
  }

  /* ================================================================ gift 7.3 */
  async gift(from: string, msg: string) {
    const { ctx } = this;
    this.stop();
    const ac = new AbortController();
    this.abort = ac;
    ctx.setIntro(true);
    this.veil(true);
    const g = el(`
      <div class="tgift" role="dialog" aria-modal="false" aria-labelledby="tgift-t">
        <div class="tgift__env">
          <svg class="tgift__svg" viewBox="0 0 320 214" aria-hidden="true">
            <path class="tgift__back" d="M14 46h292c4.4 0 8 3.6 8 8v138c0 4.4-3.6 8-8 8H14c-4.4 0-8-3.6-8-8V54c0-4.4 3.6-8 8-8Z"/>
            <path class="tgift__fold" d="M8 196 128 130M312 196 192 130"/>
            <g class="tgift__flap"><path d="M10 50 160 124 310 50"/></g>
            <g class="tgift__seal" transform="translate(160 120)"><circle r="15"/><path d="M-7 7C-7-2-2-7 8-7 8 2 3 7-7 7Z"/><path d="M-7 7 1-1"/></g>
          </svg>
          <div class="tgift__front">
            <p class="tgift__eyebrow">${he.cta.gift}</p>
            <p class="tgift__from" id="tgift-t">מאת ${esc(from)}</p>
          </div>
          <div class="tgift__letter" aria-live="polite">
            <p class="tgift__msg">${esc(msg)}</p>
            <p class="tgift__sign">${esc(from)}</p>
          </div>
        </div>
        <button class="btn btn--lg tgift__open" type="button" data-open>${icon('envelope')}<span>פותחים את המעטפה</span></button>
      </div>`);
    ctx.stage.appendChild(g);
    const motion = ctx.motion();
    if (motion) gsap.fromTo(g, { opacity: 0, y: 30, rotation: -2 }, { opacity: 1, y: 0, rotation: 0, duration: 1.2, ease: 'expo.out' });
    const openBtn = g.querySelector<HTMLButtonElement>('[data-open]')!;
    openBtn.focus({ preventScroll: true });
    let opened = false;
    openBtn.addEventListener('click', async () => {
      if (!opened) {
        opened = true;
        sound.unlock();
        sound.play('paper', { volume: 0.7 });
        g.classList.add('is-open');
        openBtn.querySelector('span')!.textContent = 'פוגשים את העץ';
        openBtn.querySelector('svg')!.outerHTML = icon('sprout');
        if (motion) {
          gsap.to(g.querySelector('.tgift__flap'), { scaleY: -1, transformOrigin: '50% 0%', duration: 0.7, ease: 'power3.inOut' });
          gsap.fromTo(g.querySelector('.tgift__letter'), { yPercent: 0, opacity: 0 }, { yPercent: -58, opacity: 1, duration: 1.2, ease: 'expo.out', delay: 0.45 });
        } else {
          gsap.set(g.querySelector('.tgift__flap'), { scaleY: -1, transformOrigin: '50% 0%' });
          gsap.set(g.querySelector('.tgift__letter'), { yPercent: -58, opacity: 1 });
        }
        ctx.announce(`${msg}. ${from}`);
        return;
      }
      if (ac.signal.aborted) return;
      const fin = () => { g.remove(); this.veil(false); void this.birth(ctx.tree.plantedAt); };
      if (motion) gsap.to(g, { opacity: 0, y: -24, duration: 0.6, ease: 'power2.in', onComplete: fin }); else fin();
    });
  }
}
