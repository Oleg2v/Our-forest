/* ==========================================================================
   Bottom of the page (7.17): number, species, planting date, dedication, planted by;
   the card "מה שלום העץ?"; the QR note; the buttons "באים לבקר", "מצטרפים לשומרי העץ",
   "משתפים", "נוטעים עץ נוסף", "מוסיפים למסך הבית". Plus the calm additions (7.11).
   ========================================================================== */
import qrcode from 'qrcode-generator';
import { he } from '../../content/he';
import { prices } from '../../content/prices';
import { ilDate, priceHtml, waLink } from '../../core/format';
import { refreshChrome } from '../../chrome';
import { SPECIES, ageHe, keyDiff, israelDateKey, seasonNote, memorialName, WEATHER_HE, greetingFor } from '../model';
import { icon } from './icons';
import { treeUrl } from './share';
import { addToHomeScreen, isStandalone, onInstallChange } from './pwa';
import { esc, type Ctx } from './ctx';
import type { Dock } from './dock';

export class About {
  constructor(private ctx: Ctx, private dock: Dock) {
    onInstallChange(() => this.renderActions());
  }

  render() {
    this.renderFacts();
    this.renderHow();
    this.renderActions();
    this.renderMore();
    this.renderQr();
  }

  private renderFacts() {
    const { ctx } = this;
    const t = ctx.tree;
    const sp = SPECIES[t.species] ?? SPECIES.fig;
    const root = ctx.main.querySelector<HTMLElement>('[data-label]')!;
    root.querySelector('[data-f="number2"]')!.innerHTML = `עץ מס׳ <bdi>${t.id}</bdi>`;
    const planted = ctx.derive().planted;
    root.querySelector<HTMLElement>('[data-facts]')!.innerHTML = `
      <div><dt>מין</dt><dd>${sp.he} <span class="tree-label__latin" lang="la" dir="ltr">${sp.latin}</span></dd></div>
      <div><dt>תאריך הנטיעה</dt><dd>${planted ? `<bdi>${ilDate(t.plantedAt)}</bdi>` : he.tree.states.plantingIn(9)}</dd></div>
      <div><dt>הקדשה</dt><dd class="tree-label__ded">${esc(t.dedication)}</dd></div>
      <div><dt>נטעו</dt><dd>${esc(t.plantedBy)}</dd></div>
      <div><dt>מקום</dt><dd>${he.brand}, ${he.place} · שורה <bdi>${t.id.slice(0, 3)}</bdi></dd></div>`;
  }

  private renderHow() {
    const { ctx } = this;
    const t = ctx.tree;
    const s = ctx.derive();
    const today = israelDateKey();
    const team = keyDiff(t.lastTeamWatering, today);
    const when = (d: number) => (d <= 0 ? 'היום' : d === 1 ? 'אתמול' : d === 2 ? 'שלשום' : `לפני ${d} ימים`);
    const memorial = ctx.demo.mode === 'memorial';
    const rows: [string, string, string][] = s.planted ? [
      ['calendar', 'גיל', ageHe(s.ageDays)],
      ['leaf', 'עונה', seasonNote(s)],
      ['ruler', 'גובה', `<bdi>${t.heightCm}</bdi> ס״מ`],
      ['roots', 'שורשים', he.tree.gestures.rootsDepth(t.rootDepthCm)],
      ['drop', 'השקיה של הצוות', `${when(team)} · <bdi>${ilDate(t.lastTeamWatering)}</bdi>`],
      ...(t.lastPrune ? [['scissors', 'גיזום', `<bdi>${ilDate(t.lastPrune)}</bdi>`] as [string, string, string]] : []),
      [s.hours >= 19 || s.hours < 5 ? 'moon' : s.weather === 'rain' ? 'rain' : s.weather === 'wind' ? 'wind' : s.weather === 'hamsin' ? 'haze' : 'sun', 'עכשיו ביער', `${greetingFor(s.hours)} · ${WEATHER_HE[s.weather]}`],
    ] : [
      ['seed', 'מצב', he.tree.states.plantingIn(9)],
      ['pin', 'מקום', `${he.place}`],
    ];
    if (!memorial && ctx.store.wateredToday()) rows.splice(5, 0, ['drop', 'ההשקיה שלכם', 'היום, תודה']);
    ctx.main.querySelector<HTMLElement>('[data-how-list]')!.innerHTML = rows.map(([ic, k, v]) =>
      `<li><span class="tree-how__ic">${icon(ic)}</span><span class="tree-how__k">${k}</span><span class="tree-how__v">${v}</span></li>`).join('');
  }

  renderActions() {
    const { ctx } = this;
    const t = ctx.tree;
    const memorial = ctx.demo.mode === 'memorial';
    const root = ctx.main.querySelector<HTMLElement>('[data-actions]')!;
    const visitText = memorial ? `שלום! נשמח לבוא לבקר ליד העץ ${t.dedication}, מס׳ ${t.id}` : `שלום! נשמח לבוא לבקר את העץ שלנו, מס׳ ${t.id}`;
    root.innerHTML = `
      <a class="btn btn--lg" href="${waLink(visitText)}" target="_blank" rel="noopener" data-track="tree_visit">${icon('pin')}<span>${he.tree.buttons.visit}</span></a>
      ${memorial ? '' : `<a class="btn btn--outline btn--lg" href="/plant?species=${t.species}&x=guardians">${icon('leaf')}<span>${he.tree.buttons.guardians}</span><span class="tree-actions__price">${priceHtml(prices.guardiansMonthly)} ${he.pricing.perMonth}</span></a>`}
      <button class="btn btn--outline btn--lg" type="button" data-share>${icon('share')}<span>${he.tree.buttons.share}</span></button>
      <a class="btn btn--fruit btn--lg" href="/plant" data-cursor="שתלו" data-cursor-fill="fruit">${icon('sprout')}<span>${he.tree.buttons.another}</span></a>
      ${isStandalone() ? '' : `<button class="btn btn--outline btn--lg" type="button" data-install>${icon('homescreen')}<span>${he.tree.buttons.homescreen}</span></button>`}`;
    root.querySelector('[data-share]')!.addEventListener('click', () => ctx.openShare());
    root.querySelector('[data-install]')?.addEventListener('click', () => void addToHomeScreen());
    refreshChrome(root);
  }

  private renderMore() {
    const { ctx } = this;
    const t = ctx.tree;
    const memorial = ctx.demo.mode === 'memorial';
    const s = ctx.derive();
    const cert = he.plant.extras.find((x) => x.id === 'certificate')?.title ?? '';
    const box = he.plant.extras.find((x) => x.id === 'box')?.title ?? '';
    const cards: string[] = [];
    cards.push(`<li class="tmore">
      <span class="tmore__ic">${icon('tree')}</span>
      <p class="tmore__eyebrow">${he.tree.upsell.sibling}</p>
      <p class="tmore__t">נוטעים עץ נוסף, ממש ליד</p>
      <p class="tmore__d">${memorial ? 'עוד עץ באותו מקום, לזכרו.' : 'השניים גדלים יחד, על אותו אי.'} המקום מסומן על האי.</p>
      <button class="tmore__btn" type="button" data-sibling>${icon('pin')}<span>מראים לי את המקום</span></button>
    </li>`);
    cards.push(`<li class="tmore">
      <span class="tmore__ic">${icon('frame')}</span>
      <p class="tmore__eyebrow">להדפסה</p>
      <p class="tmore__t">${cert}</p>
      <p class="tmore__d">עם השלט החרוט, התאריך וקוד לעמוד הזה. ${priceHtml(prices.certificateFramed)}</p>
      <a class="tmore__btn" href="/plant?species=${t.species}&x=certificate">${icon('arrow', 'icon arrow-fwd')}<span>מזמינים</span></a>
    </li>`);
    cards.push(`<li class="tmore">
      <span class="tmore__ic">${icon('book')}</span>
      <p class="tmore__eyebrow">הזמנה מוקדמת</p>
      <p class="tmore__t">פוסטר עם העץ</p>
      <p class="tmore__d">הציור של העץ שלכם, כמו בספר בוטניקה ישן, עם ההקדשה.</p>
      <a class="tmore__btn" href="${waLink(`שלום! נשמח להזמין פוסטר של עץ מס׳ ${t.id}`)}" target="_blank" rel="noopener" data-track="tree_poster">${icon('arrow', 'icon arrow-fwd')}<span>מזמינים מראש</span></a>
    </li>`);
    if (!memorial) cards.push(`<li class="tmore${s.harvestReady ? ' tmore--ripe' : ''}">
      <span class="tmore__ic">${icon('basket')}</span>
      <p class="tmore__eyebrow">${s.harvestReady ? 'הפירות בשלים' : 'בעונת הקטיף'}</p>
      <p class="tmore__t">${box}</p>
      <p class="tmore__d">פירות מהיער, בעונה שלהם. ${priceHtml(prices.forestBox)}</p>
      <a class="tmore__btn" href="/plant?x=box">${icon('arrow', 'icon arrow-fwd')}<span>מזמינים</span></a>
    </li>`);
    const list = ctx.main.querySelector<HTMLElement>('[data-more-list]')!;
    list.innerHTML = cards.join('');
    list.querySelector('[data-sibling]')!.addEventListener('click', () => {
      ctx.stage.scrollIntoView({ behavior: ctx.motion() ? 'smooth' : 'auto', block: 'start' });
      setTimeout(() => this.dock.sibling(), ctx.motion() ? 650 : 0);
    });
    void memorialName;
  }

  private renderQr() {
    const host = this.ctx.main.querySelector<HTMLElement>('[data-qr]');
    if (!host) return;
    try {
      const q = qrcode(0, 'M');
      q.addData(`${treeUrl(this.ctx.tree.id)}?qr=1`);
      q.make();
      host.innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
      host.querySelector('svg')?.setAttribute('aria-hidden', 'true');
    } catch { /* ignore */ }
  }
}
