/* ==========================================================================
   "ציר הזמן" (7.8) — a slider from right to left: "יום הנטיעה" → "היום" → a dashed tail
   "בעוד 5 שנים". Dragging grows or shrinks the tree smoothly (ageDays + that day's season),
   the team's real photos pop up as polaroids on their dates, the future shows the dashed
   adult silhouette. The planting-day mark replays the birth.
   ========================================================================== */
import { he } from '../../content/he';
import { ilDate, seasonOf } from '../../core/format';
import { gsap } from '../../core/gsap';
import { sound } from '../../core/sound';
import { pictureHtml, type ImageKey } from '../../content/images';
import { addDays, ageHe, israelDateKey, keyDiff, monthOf, SEASON_HE } from '../model';
import { icon } from './icons';
import { el, type Ctx } from './ctx';

const PAST = 0.72;            // share of the track for planting → today
const FUTURE_DAYS = 5 * 365;
const STEPS = 1000;

const MILESTONE: Record<string, string> = {
  planted: he.tree.milestones[0], firstLeaves: he.tree.milestones[1], firstSummer: he.tree.milestones[2],
  pruned: 'גיזום קל לפני החורף', teamWatering: 'הצוות השקה',
};

export class Timeline {
  private root: HTMLElement;
  private input!: HTMLInputElement;
  private info!: HTMLElement;
  private polaroid: HTMLElement | null = null;
  private polaroidKey = '';
  private today = israelDateKey();
  private total = 1;
  private value = 0;
  private dragging = false;
  private sndAt = 0;

  constructor(private ctx: Ctx, private onReplayBirth: () => void) {
    this.root = ctx.stage.querySelector<HTMLElement>('[data-timeline]')!;
    this.build();
  }

  private daysOf(v: number): number {
    const k = v / STEPS;
    if (k <= PAST) return (k / PAST) * this.total;
    return this.total + ((k - PAST) / (1 - PAST)) * FUTURE_DAYS;
  }
  private valueOf(days: number): number {
    if (days <= this.total) return Math.round((days / Math.max(1, this.total)) * PAST * STEPS);
    return Math.round((PAST + ((days - this.total) / FUTURE_DAYS) * (1 - PAST)) * STEPS);
  }

  build() {
    const { ctx } = this;
    this.today = israelDateKey();
    this.total = Math.max(1, keyDiff(ctx.tree.plantedAt, this.today));
    this.value = this.valueOf(this.total);
    const marks = ctx.tree.events
      .filter((e) => e.type !== 'teamWatering')
      .map((e) => {
        const d = keyDiff(ctx.tree.plantedAt, e.date);
        const pos = (this.valueOf(d) / STEPS) * 100;
        return `<span class="ttl__mark${e.imageKey ? ' ttl__mark--photo' : ''}" style="--p:${pos.toFixed(2)}%" title="${MILESTONE[e.type] ?? ''}"></span>`;
      }).join('');
    // the first fruit (soon): next summer, on the dashed tail
    const fruitDays = keyDiff(ctx.tree.plantedAt, `${Number(this.today.slice(0, 4)) + 1}-08-01`);
    const fruitPos = (this.valueOf(fruitDays) / STEPS) * 100;
    this.root.innerHTML = `
      <div class="ttl" data-ttl>
        <p class="ttl__title" id="ttl-title">${icon('clock')}<span>${he.tree.timeline.title}</span></p>
        <div class="ttl__track">
          <div class="ttl__rail" aria-hidden="true">
            <span class="ttl__past"></span><span class="ttl__future"></span>
            ${marks}
            <span class="ttl__mark ttl__mark--soon" style="--p:${fruitPos.toFixed(2)}%" title="${he.tree.milestones[3]}"></span>
            <span class="ttl__today" style="--p:${(PAST * 100).toFixed(2)}%"></span>
            <span class="ttl__thumb" data-thumb><span class="ttl__thumb-dot"></span></span>
          </div>
          <input class="ttl__input" type="range" min="0" max="${STEPS}" step="1" value="${this.value}" dir="rtl"
            aria-labelledby="ttl-title" aria-describedby="ttl-info">
        </div>
        <div class="ttl__labels" aria-hidden="false">
          <button class="ttl__lab ttl__lab--start" type="button" data-replay title="צפו בלידה שוב">${icon('rotate', 'icon ttl__lab-ic')}<span>${he.tree.timeline.planted}</span></button>
          <button class="ttl__lab ttl__lab--today" type="button" data-today style="--p:${(PAST * 100).toFixed(2)}%">${he.tree.timeline.today}</button>
          <span class="ttl__lab ttl__lab--end">${he.tree.timeline.future}</span>
        </div>
      </div>
      <div class="ttl-info" id="ttl-info" data-info></div>`;
    this.input = this.root.querySelector<HTMLInputElement>('.ttl__input')!;
    this.info = this.root.querySelector<HTMLElement>('[data-info]')!;
    this.root.querySelector('[data-replay]')!.addEventListener('click', () => { this.reset(true); this.onReplayBirth(); });
    this.root.querySelector('[data-today]')!.addEventListener('click', () => this.reset(false));
    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('pointerdown', () => { this.dragging = true; this.root.classList.add('is-drag'); });
    const up = () => { this.dragging = false; this.root.classList.remove('is-drag'); };
    this.input.addEventListener('pointerup', up);
    this.input.addEventListener('pointercancel', up);
    this.input.addEventListener('change', up);
    this.paint();
    this.input.setAttribute('aria-valuetext', `${he.tree.timeline.today}, ${ilDate(this.today)}`);
  }

  private onInput() {
    const v = Number(this.input.value);
    // snap softly onto "today"
    const todayV = PAST * STEPS;
    this.value = Math.abs(v - todayV) < 12 ? todayV : v;
    this.apply();
    const now = performance.now();
    if (now - this.sndAt > 160) { sound.play('hover', { volume: 0.4 }); this.sndAt = now; }
  }

  /** back to today (or to the planting day before a birth replay) */
  reset(_toStart: boolean) {
    this.value = PAST * STEPS;
    this.input.value = String(this.value);
    this.apply();
  }

  private apply() {
    const { ctx } = this;
    const days = this.daysOf(this.value);
    const atToday = Math.abs(this.value - PAST * STEPS) < 1;
    const future = days > this.total + 1;
    const dateKey = addDays(ctx.tree.plantedAt, Math.round(days));
    if (atToday) {
      delete ctx.override.ageDays; delete ctx.override.season; delete ctx.override.futureGhost; delete ctx.override.ghostAgeDays;
      delete ctx.stage.dataset.time;
    } else if (future) {
      // the future hasn't happened: the tree stays as it is today, and the dashed silhouette of what it
      // will be grows over it as the slider goes on (7.8: the dashed silhouette of the grown tree)
      ctx.override.ageDays = this.total;
      ctx.override.futureGhost = true;
      ctx.override.ghostAgeDays = days;
      delete ctx.override.season;
      ctx.stage.dataset.time = 'future';
    } else {
      ctx.override.ageDays = days;
      ctx.override.futureGhost = false;
      delete ctx.override.ghostAgeDays;
      ctx.override.season = ctx.demo.season ? undefined : seasonOf(monthOf(dateKey));
      if (!ctx.override.season) delete ctx.override.season;
      ctx.stage.dataset.time = 'past';
    }
    ctx.refresh();
    this.paint();
    this.describe(days, dateKey, atToday, future);
  }

  private paint() {
    const p = (this.value / STEPS) * 100;
    this.root.style.setProperty('--v', `${p.toFixed(2)}%`);
  }

  private describe(days: number, dateKey: string, atToday: boolean, future: boolean) {
    const { ctx } = this;
    const motion = ctx.motion();
    let html = '';
    let photo: { key: ImageKey; label: string; date: string } | null = null;
    if (atToday) {
      this.input.setAttribute('aria-valuetext', `${he.tree.timeline.today}, ${ilDate(this.today)}`);
      this.info.innerHTML = '';
      this.hidePolaroid();
      return;
    }
    if (future) {
      const years = Math.max(1, Math.round((days - this.total) / 365));
      // the caption follows the slider: "ככה הוא ייראה בעוד שנה" … the brief's "ככה הוא ייראה בעוד 5 שנים" at the end
      const when = years >= 5 ? he.tree.timeline.future : `בעוד ${years === 1 ? 'שנה' : years === 2 ? 'שנתיים' : `${years} שנים`}`;
      const caption = years >= 5 ? he.tree.timeline.futureCaption : `ככה הוא ייראה ${when}`;
      // a tree in memory stays quiet (7.12): no subscription offer at the end of its timeline
      const link = ctx.demo.mode === 'memorial' ? ''
        : `<a class="ttl-info__link" href="/plant?species=${ctx.tree.species}&x=guardians">${he.tree.timeline.futureLink}${icon('arrow', 'icon arrow-fwd')}</a>`;
      html = `<p class="ttl-info__eyebrow"><bdi>${ilDate(dateKey)}</bdi> · ${ageHe(days)}</p>
        <p class="ttl-info__title">${caption}</p>
        ${link}`;
      this.input.setAttribute('aria-valuetext', `${ilDate(dateKey)}, ${caption}`);
    } else {
      // the nearest team event within ±12 days (photos pop up on their dates)
      const near = ctx.tree.events
        .map((e) => ({ e, d: Math.abs(keyDiff(e.date, dateKey)) }))
        .filter((x) => x.d <= 12)
        .sort((a, b) => a.d - b.d)[0]?.e;
      const season = SEASON_HE[seasonOf(monthOf(dateKey))];
      const label = near ? MILESTONE[near.type] ?? '' : season;
      html = `<p class="ttl-info__eyebrow"><bdi>${ilDate(dateKey)}</bdi> · ${ageHe(days)}</p>
        <p class="ttl-info__title">${label}</p>
        <button class="ttl-info__back" type="button" data-back>${icon('returnTo')}<span>חוזרים להיום</span></button>`;
      if (near?.imageKey) photo = { key: near.imageKey as ImageKey, label, date: near.date };
      this.input.setAttribute('aria-valuetext', `${ilDate(dateKey)}${near ? `, ${label}` : ''}`);
    }
    // while dragging only the date line changes: update it in place; re-build (and animate) only when
    // the title changes — otherwise the whole caption flickered on every step of the slider
    const eyebrowRe = /<p class="ttl-info__eyebrow">[\s\S]*?<\/p>/;
    const sig = html.replace(eyebrowRe, '');
    const eyebrow = html.match(eyebrowRe)?.[0] ?? '';
    const curEyebrow = this.info.querySelector('.ttl-info__eyebrow');
    if (this.info.dataset.sig === sig && curEyebrow) {
      const inner = eyebrow.replace(/^<p class="ttl-info__eyebrow">/, '').replace(/<\/p>$/, '');
      if (curEyebrow.innerHTML !== inner) curEyebrow.innerHTML = inner;
    } else {
      this.info.dataset.sig = sig;
      this.info.innerHTML = html;
      this.info.querySelector('[data-back]')?.addEventListener('click', () => { this.reset(false); this.input.focus(); });
      if (future) {
        const back = el(`<button class="ttl-info__back" type="button">${icon('returnTo')}<span>חוזרים להיום</span></button>`);
        back.addEventListener('click', () => { this.reset(false); this.input.focus(); });
        this.info.appendChild(back);
      }
      if (motion) gsap.fromTo(this.info.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.05 });
    }
    if (photo) this.showPolaroid(photo); else this.hidePolaroid();
  }

  private showPolaroid(p: { key: ImageKey; label: string; date: string }) {
    if (this.polaroidKey === p.key) return;
    this.hidePolaroid();
    this.polaroidKey = p.key;
    const rot = (p.key.length % 2 ? -1 : 1) * (2.5 + (p.key.length % 3));
    const card = el(`<figure class="tpola" style="--r:${rot}deg">
        <div class="tpola__img">${pictureHtml(p.key, { sizes: '240px', className: 'cover', eager: true })}</div>
        <figcaption class="tpola__cap"><span>${p.label}</span><bdi>${ilDate(p.date)}</bdi></figcaption>
      </figure>`);
    this.ctx.stage.appendChild(card);
    this.polaroid = card;
    sound.play('paper', { volume: 0.5 });
    if (this.ctx.motion()) gsap.fromTo(card, { opacity: 0, y: 40, scale: 0.92, rotation: rot * 2 }, { opacity: 1, y: 0, scale: 1, rotation: rot, duration: 0.9, ease: 'expo.out' });
  }
  private hidePolaroid() {
    const c = this.polaroid;
    if (!c) return;
    this.polaroid = null; this.polaroidKey = '';
    if (this.ctx.motion()) gsap.to(c, { opacity: 0, y: 24, duration: 0.4, ease: 'power2.in', onComplete: () => c.remove() });
    else c.remove();
  }

  /** a new tree (multi) or a new day */
  rebuild() { this.hidePolaroid(); this.build(); }
}
