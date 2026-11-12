/* ==========================================================================
   The tree's journal + greeting leaves (7.7).
   · the feed: the team's records (planting, first leaves, pruning, waterings) and every greeting
   · "מזמינים חברים להשקות" → a WhatsApp link with a ready text (→ ?greet=1)
   · the friends' mini-page without registration: name, greeting, 18/36/54 ₪ or own amount,
     Bit or card (mock) → they see their leaf appear on the tree.
   · memorial: "מילים לזכר [שם]" instead of greetings — free, no amounts.
   ========================================================================== */
import { he } from '../../content/he';
import { prices } from '../../content/prices';
import { ilDate, ils, priceHtml } from '../../core/format';
import { track } from '../../core/analytics';
import { sound } from '../../core/sound';
import { scrollTo } from '../../core/scroll';
import { gsap } from '../../core/gsap';
import { pictureHtml, type ImageKey } from '../../content/images';
import { allGreetings, initialsOf, israelDateKey, memorialName, type Greeting } from '../model';
import { icon } from './icons';
import { openSheet } from './sheet';
import { esc, sleep, type Ctx } from './ctx';
import type { Dock } from './dock';

const EVENT_TEXT: Record<string, { title: string; text: string; ic: string }> = {
  planted: { title: he.tree.milestones[0], text: 'הצוות שתל את העץ באדמה, ליד השלט החרוט.', ic: 'sprout' },
  firstLeaves: { title: he.tree.milestones[1], text: 'העלים הראשונים נפתחו בקצות הענפים.', ic: 'leaf' },
  firstSummer: { title: he.tree.milestones[2], text: 'העץ עבר את הקיץ הראשון שלו, ירוק ועבות.', ic: 'sun' },
  pruned: { title: 'גיזום קל', text: 'הצוות גזם ענפים יבשים לפני החורף.', ic: 'scissors' },
  teamWatering: { title: 'השקיה של הצוות', text: 'השקינו לפי הלחות באדמה.', ic: 'drop' },
};

export function leafGlyph(initials: string, glowing: boolean) {
  return `<span class="tleaf${glowing ? ' tleaf--glow' : ''}" aria-hidden="true">
    <svg viewBox="0 0 40 40"><path d="M6 34C6 17 17 6 34 6c0 17-11 28-28 28Z"/><path d="M6 34 22 18"/></svg>
    <b>${esc(initials)}</b></span>`;
}

export class Feed {
  private root: HTMLElement;
  constructor(private ctx: Ctx, private dock: Dock) {
    this.root = ctx.main.querySelector<HTMLElement>('[data-feed]')!;
  }

  render() {
    const { ctx } = this;
    const memorial = ctx.demo.mode === 'memorial';
    const t = ctx.tree;
    const name = memorialName(t.dedication);
    const today = israelDateKey();
    this.root.querySelector('[data-feed-title]')!.textContent = memorial ? he.tree.memorial.words(name) : he.tree.greetings.everyGreeting;
    this.root.querySelector('[data-feed-lead]')!.innerHTML = memorial
      ? 'כותבים כמה מילים, והן נשמרות כאן, ליד העץ. בלי תשלום ובלי הרשמה.'
      : `חברים ומשפחה משקים את העץ במתנה, ${priceHtml(prices.greetingMin, { from: true })}, וכל השקיה כזאת הופכת לעלה זוהר עם ראשי התיבות שלהם. העלה זוהר שבוע, ואחר כך נשארת עליו נקודה קטנה.`;
    const ctas = this.root.querySelector<HTMLElement>('[data-feed-ctas]')!;
    if (memorial) {
      ctas.innerHTML = `<button class="btn" type="button" data-greet>${icon('leaf')}<span>כותבים מילים לזכר ${esc(name)}</span></button>`;
    } else {
      // the same invite as the stage's button: one sheet with the ready text, WhatsApp and copy-link
      ctas.innerHTML = `
        <button class="btn" type="button" data-invite>${icon('invite')}<span>${he.tree.greetings.inviteFriends}</span></button>
        <button class="btn btn--outline" type="button" data-greet>${icon('leaf')}<span>משקים במתנה ומשאירים ברכה</span></button>`;
      ctas.querySelector('[data-invite]')!.addEventListener('click', () => ctx.openInvite());
    }
    ctas.querySelector('[data-greet]')!.addEventListener('click', () => this.open());

    // the journal: newest first
    const greets = allGreetings(t, ctx.store.facts());
    type Item = { date: string; html: string };
    const items: Item[] = [];
    for (const e of t.events) {
      const m = EVENT_TEXT[e.type];
      if (!m) continue;
      const photo = e.imageKey ? `<div class="tfeed__photo">${pictureHtml(e.imageKey as ImageKey, { sizes: '(max-width: 768px) 30vw, 140px', className: 'cover' })}</div>` : '';
      items.push({ date: e.date, html: `<span class="tfeed__ic">${icon(m.ic)}</span><div class="tfeed__txt"><p class="tfeed__t">${m.title}</p><p class="tfeed__d">${m.text}</p></div>${photo}` });
    }
    for (const g of greets) {
      const glowing = (new Date(`${today}T12:00:00Z`).getTime() - new Date(`${g.date}T12:00:00Z`).getTime()) / 86400000 < 7;
      items.push({
        date: g.date,
        html: `${leafGlyph(g.initials, glowing && !memorial)}<div class="tfeed__txt"><p class="tfeed__q">„${esc(g.text)}”</p><p class="tfeed__d">${esc(g.from)}${g.mine ? ' · מכם' : ''}</p></div>`,
      });
    }
    if (ctx.store.wateredToday() && !memorial) items.push({ date: today, html: `<span class="tfeed__ic">${icon('drop')}</span><div class="tfeed__txt"><p class="tfeed__t">השקיתם את העץ</p><p class="tfeed__d">${he.tree.water.honest}</p></div>` });
    items.sort((a, b) => b.date.localeCompare(a.date));
    const list = this.root.querySelector<HTMLElement>('[data-feed-list]')!;
    list.innerHTML = items.map((i) => `<li class="tfeed__item"><time class="tfeed__date" datetime="${i.date}"><bdi>${ilDate(i.date)}</bdi></time><div class="tfeed__body">${i.html}</div></li>`).join('');
  }

  /* ================================================================ the mini-page */
  open() {
    const { ctx } = this;
    const memorial = ctx.demo.mode === 'memorial';
    const t = ctx.tree;
    const name = memorialName(t.dedication);
    if (!memorial) track('gift_started', { tree_id: t.id, via: 'greet' });
    const amounts = prices.greetingOptions as readonly number[];
    const sh = openSheet({
      cls: 'tsheet--greet',
      eyebrow: memorial ? he.tree.number(t.id) : `העץ של ${esc(t.owner)} · ${he.tree.number(t.id)}`,
      title: memorial ? he.tree.memorial.words(esc(name)) : he.tree.greetings.everyGreeting,
      html: `
        <form class="tgreet" novalidate>
          <p class="tgreet__lead">${memorial ? 'כמה מילים, והן נשמרות ביומן העץ. בלי תשלום ובלי הרשמה.' : 'משקים את העץ במתנה, משאירים ברכה, והעלה שלכם מופיע על הענפים. בלי הרשמה.'}</p>
          <div class="tgreet__grid">
            <div class="tgreet__fields">
              <div class="field">
                <label for="tg-name">השם שלכם</label>
                <input id="tg-name" name="name" autocomplete="name" maxlength="30" required>
                <p class="tgreet__err" data-err="name" hidden>נשמח לדעת מי ${memorial ? 'כותב' : 'מברך'}</p>
              </div>
              <div class="field">
                <label for="tg-text">${memorial ? 'המילים' : 'הברכה'}</label>
                <textarea id="tg-text" name="text" rows="3" maxlength="140" required></textarea>
                <p class="tgreet__err" data-err="text" hidden>כמה מילים, ${memorial ? 'מה שבא מהלב' : 'של ברכה'}</p>
              </div>
              ${memorial ? '' : `
              <fieldset class="tgreet__set">
                <legend>כמה משקים?</legend>
                <div class="tgreet__chips">
                  ${amounts.map((a, i) => `<label class="chip"><input class="visually-hidden" type="radio" name="amount" value="${a}"${i === 1 ? ' checked' : ''}><bdi>${ils(a)}</bdi></label>`).join('')}
                  <label class="chip"><input class="visually-hidden" type="radio" name="amount" value="own"><span>סכום אחר</span></label>
                </div>
                <div class="field tgreet__own" hidden>
                  <label for="tg-own">הסכום (מ־<bdi>${ils(prices.greetingMin)}</bdi>)</label>
                  <input id="tg-own" name="own" type="number" inputmode="numeric" min="${prices.greetingMin}" step="1" value="72" dir="ltr">
                </div>
              </fieldset>
              <fieldset class="tgreet__set">
                <legend>איך משלמים?</legend>
                <div class="tgreet__chips">
                  <label class="chip"><input class="visually-hidden" type="radio" name="pay" value="bit" checked><span>Bit</span></label>
                  <label class="chip"><input class="visually-hidden" type="radio" name="pay" value="card">${icon('card')}<span>כרטיס אשראי</span></label>
                </div>
                <p class="tgreet__demo">זה עמוד לדוגמה: שום תשלום לא מתבצע.</p>
              </fieldset>`}
            </div>
            <div class="tgreet__preview" aria-hidden="true">
              ${leafGlyph('·', !memorial)}
              <p class="tgreet__pv-text" data-pv>${memorial ? '' : '„…”'}</p>
            </div>
          </div>
          <button class="btn ${memorial ? '' : 'btn--fruit'} btn--lg tgreet__go" type="submit" data-go></button>
        </form>`,
    });
    const form = sh.body.querySelector<HTMLFormElement>('form')!;
    const go = form.querySelector<HTMLButtonElement>('[data-go]')!;
    const own = form.querySelector<HTMLElement>('.tgreet__own');
    const pvLeaf = form.querySelector<HTMLElement>('.tleaf b')!;
    const pvText = form.querySelector<HTMLElement>('[data-pv]')!;
    const amount = () => {
      const v = (form.querySelector<HTMLInputElement>('input[name="amount"]:checked')?.value) ?? '36';
      if (v !== 'own') return Number(v);
      return Math.max(prices.greetingMin, Math.round(Number(form.querySelector<HTMLInputElement>('#tg-own')!.value) || prices.greetingMin));
    };
    const syncBtn = () => {
      go.innerHTML = memorial
        ? `${icon('leaf')}<span>משאירים את המילים</span>`
        : `${icon('drop')}<span>משקים ומשאירים ברכה</span><bdi class="tgreet__sum">${ils(amount())}</bdi>`;
      if (own) own.hidden = form.querySelector<HTMLInputElement>('input[name="amount"]:checked')?.value !== 'own';
    };
    const syncPreview = () => {
      const n = form.querySelector<HTMLInputElement>('#tg-name')!.value.trim();
      const tx = form.querySelector<HTMLTextAreaElement>('#tg-text')!.value.trim();
      pvLeaf.textContent = n ? initialsOf(n) : '·';
      pvText.textContent = tx ? `„${tx}”` : memorial ? '' : '„…”';
    };
    form.addEventListener('input', () => { syncBtn(); syncPreview(); });
    form.addEventListener('change', syncBtn);
    syncBtn();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = form.querySelector<HTMLInputElement>('#tg-name')!;
      const tx = form.querySelector<HTMLTextAreaElement>('#tg-text')!;
      let bad: HTMLElement | null = null;
      for (const [f, key] of [[n, 'name'], [tx, 'text']] as const) {
        const err = form.querySelector<HTMLElement>(`[data-err="${key}"]`)!;
        const ok = f.value.trim().length > 0;
        err.hidden = ok;
        f.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (ok) f.removeAttribute('aria-describedby'); else { err.id = `tg-err-${key}`; f.setAttribute('aria-describedby', err.id); }
        if (!ok && !bad) bad = f;
      }
      if (bad) { bad.focus(); return; }
      go.disabled = true;
      go.innerHTML = `<span>${memorial ? 'שומרים…' : 'משלמים…'}</span>`;
      await sleep(memorial ? 500 : 1100);
      const g: Greeting = {
        id: `me-${Date.now().toString(36)}`, from: n.value.trim().slice(0, 30), initials: initialsOf(n.value),
        text: tx.value.trim().slice(0, 140), date: israelDateKey(), amount: memorial ? 0 : amount(), mine: true,
      };
      ctx.store.addGreeting(g);
      if (!memorial) track('purchase', { value: g.amount, currency: 'ILS', item_name: 'greeting_leaf', tree_id: t.id });
      sh.close();
      this.render();
      await this.reveal(g, memorial);
    });
  }

  /** after "payment": back to the tree, the new leaf lights up with their initials */
  private async reveal(g: Greeting, memorial: boolean) {
    const { ctx } = this;
    if (memorial) {
      this.dock.toast('המילים נשמרו ביומן העץ', 'leaf');
      ctx.announce('המילים נשמרו ביומן העץ');
      return;
    }
    scrollTo(0, { offset: 0 });
    await sleep(ctx.motion() ? 700 : 50);
    ctx.refresh();
    sound.play('sparkle', { volume: 0.7 });
    await sleep(ctx.motion() ? 500 : 50);
    const anchor = `greeting-${g.id}`;
    const hs = ctx.hotspots().find((h) => h.id === anchor && h.visible);
    this.dock.show({
      id: `g-${g.id}`, anchor: hs ? anchor : 'leaf', kind: 'joy',
      eyebrow: `העלה שלכם על העץ · <bdi>${esc(g.initials)}</bdi>`,
      title: `<span class="tdock-quote">${esc(g.text)}</span>`,
      body: `<p class="tdock-meta">${esc(g.from)} · <bdi>${ils(g.amount ?? 0)}</bdi></p><p>העלה זוהר שבוע, ונשאר על הענף.</p>`,
    });
    ctx.announce(`העלה שלכם הופיע על העץ, עם ראשי התיבות ${g.initials}`);
    if (ctx.motion()) {
      const b = ctx.stage.querySelector(`[data-hs="${CSS.escape(anchor)}"]`);
      if (b) gsap.fromTo(b, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    }
  }
}
