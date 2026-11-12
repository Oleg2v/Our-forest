/* ==========================================================================
   /tree/0427 — "העץ שלכם": the page around the living scene.
   States (7.3), birth (7.4), watering (7.5), gestures & cards (7.6), greeting leaves (7.7),
   timeline (7.8), herbarium (7.9), share (7.10), money without pressure (7.11),
   memorial (7.12), sound (7.13), a11y (7.15), bottom of the page (7.17), PWA.
   The scene itself is the tree-scene agent's (src/tree/scene) — used only via scene-api.ts.
   ========================================================================== */
import './tree.css';
import './panel.css';
import './cards.css';
import './sections.css';
import { createTreeScene } from '../scene';
import type { TreeSceneState, Hotspot } from '../scene-api';
import { env, gpuTier } from '../../core/env';
import { bus } from '../../core/bus';
import { gsap } from '../../core/gsap';
import { sound, type Ambient } from '../../core/sound';
import { dayPeriod, israelNow, seasonOf, ilDate } from '../../core/format';
import { he } from '../../content/he';
import {
  TREE, MEMORIAL_DEMO, readDemo, deriveScene, describeTree, seasonNote, familyTrees, israelDateKey, allGreetings, plantedTodayFields,
  SPECIES, WEATHER_HE, SEASON_HE, initialsOf, greetingFor, ageHe,
  type Demo, type PageState, type TreeRecord, type Greeting,
} from '../model';
import { TreeStore } from './store';
import { Panel } from './water';
import { Dock } from './dock';
import { Proxies } from './hotspots';
import { Intro } from './intro';
import { Timeline } from './timeline';
import { Feed } from './feed';
import { Herbarium } from './herbarium';
import { About } from './about';
import { Presenter } from './presenter';
import { openInviteSheet, openShareSheet, renderShare } from './share';
import { initPwa, addToHomeScreen } from './pwa';
import { icon } from './icons';
import { el, esc, type Ctx } from './ctx';

export function initTreePage(main: HTMLElement) {
  const stage = main.querySelector<HTMLElement>('[data-stage]')!;
  const sceneEl = stage.querySelector<HTMLElement>('[data-scene]')!;
  const fxCanvas = stage.querySelector<HTMLCanvasElement>('[data-fx]')!;
  const { demo: fromUrl, flags } = readDemo();
  /** an arrival (birth, gift) hides the stage UI ([data-intro] in tree.css: visibility hidden; the caption only fades
   *  while it plays). On wide screens the hidden parts below and beside the scene are also inert meanwhile: the cookie
   *  card's placement skips [inert] (src/chrome/cookies.ts). It used to count the hidden timeline, readout, 'דמו' button,
   *  hotspots and caption as present and took the top-left over the moon and the 'דמו' button on a first visit. The
   *  panel column (title, watering, share) keeps counting while hidden: it is where the page appears when the arrival
   *  ends, so the card settles where it will stay clear of it — the bottom corner on the far side, as on a return
   *  visit. Hidden is hidden for the eye, the keyboard and the screen reader alike, so nothing else changes.
   *  Phones and landscape phones keep their placement as it was. */
  const INTRO_HIDDEN = '.tree-tl, .tree-cond, .tree-demo-btn, .tree-hs';
  const wideMQ = matchMedia('(min-width: 769px) and (min-height: 561px)');
  const setIntroAttr = (phase: '' | '1' | 'caption') => {
    stage.dataset.intro = phase;
    const wide = wideMQ.matches;
    const mark = (n: HTMLElement, on: boolean) => { if (n.inert !== on) n.inert = on; };
    stage.querySelectorAll<HTMLElement>(INTRO_HIDDEN).forEach((n) => mark(n, wide && !!phase));
    stage.querySelectorAll<HTMLElement>('.tree-caption').forEach((n) => mark(n, wide && phase === '1'));
  };

  /* ---------------- data */
  const base: TreeRecord = { ...TREE, greetings: [...TREE.greetings], events: [...TREE.events] };
  if (flags.species) base.species = flags.species;
  if (flags.text) base.dedication = flags.text;
  // the hand-off from /plant (?birth=1&species=…&text=…): the visitor's own tree, planted today (in the demo the
  // birth comes right away, 7.3) — a sapling with a fresh history, not the demo tree's nine months
  if (flags.birth && (flags.species || flags.text)) Object.assign(base, plantedTodayFields(israelDateKey()));
  let replanted: Partial<TreeRecord> | null = null;
  const demo: Demo = { state: 'visit', mode: 'celebration', hours: null, weather: 'clear', wind: 0.22, season: null, harvest: false, ...fromUrl };
  if (demo.weather === 'wind') demo.wind = 0.75; else if (demo.weather === 'rain') demo.wind = 0.45; else if (demo.weather === 'hamsin') demo.wind = 0.15;
  if (demo.mode === 'memorial' && !flags.text) base.dedication = MEMORIAL_DEMO.dedication;
  let store = new TreeStore(base.id);
  const flow: PageState = flags.birth ? 'birth'
    : fromUrl.state ? fromUrl.state
    : flags.gift ? 'gift'
    : !navigator.onLine ? 'offline'
    : flags.greet ? 'visit'
    : store.isFirstVisit ? 'birth'
    : store.daysAway() >= 14 ? 'absent' : 'visit';
  demo.state = flow;
  store.visit();
  // online now: this is the version an offline visit will show later
  if (navigator.onLine && flow !== 'offline') { store.data.syncedAt = Date.now(); store.save(); }
  // a dried leaf of this season goes into the herbarium on every seasonal visit
  store.collect(seasonOf(israelNow().month));
  if (flags.qr) store.collectSpecial('firstVisit');
  if (demo.harvest) store.collectSpecial('firstFruit');

  let quality: 0 | 1 | 2 | 3 = env.motionAllowed() ? (env.isTouch ? 1 : 2) : 0;
  let hotspots: Hotspot[] = [];
  const live = main.querySelector<HTMLElement>('[data-live]')!;
  const liveUrgent = main.querySelector<HTMLElement>('[data-live-urgent]')!;

  /* ---------------- context */
  const ctx: Ctx = {
    main, stage, sceneEl,
    scene: null as unknown as Ctx['scene'],
    tree: base, demo, flags, store, flow,
    override: {},
    online: flow === 'offline' ? false : navigator.onLine,
    derive() {
      const s = deriveScene(ctx.tree, { ...ctx.demo, state: ctx.flow }, ctx.store.facts(), quality);
      const o = ctx.override;
      const out: TreeSceneState = { ...s };
      // a birth is the news itself: no blinking "יש חדש" dot over the seed / the new sapling
      if (ctx.flow === 'birth' || ctx.flow === 'gift') out.hasNews = false;
      for (const k of Object.keys(o) as (keyof TreeSceneState)[]) if (o[k] !== undefined) (out as any)[k] = o[k];
      return out;
    },
    refresh() { push(); },
    announce(msg, urgent) {
      const n = urgent ? liveUrgent : live;
      n.textContent = '';
      setTimeout(() => { n.textContent = msg; }, 60);
    },
    motion: () => env.motionAllowed(),
    mobile: () => env.isMobile(),
    hotspots: () => hotspots,
    stageRect: () => stage.getBoundingClientRect(),
    setIntro(on) {
      if (on) setIntroAttr(on === 'caption' ? 'caption' : '1'); else if (stage.dataset.intro) { setIntroAttr(''); revealUi(); }
    },
    run: (f) => runFlow(f),
    focusWater() {
      if (window.scrollY > 40) stage.scrollIntoView({ behavior: env.motionAllowed() ? 'smooth' : 'auto' });
      const b = stage.querySelector<HTMLElement>('[data-water], [data-candle]');
      b?.focus({ preventScroll: true });
      const wp = stage.querySelector<HTMLElement>('[data-wp]');
      if (wp) { wp.classList.remove('is-hint'); void wp.offsetWidth; wp.classList.add('is-hint'); setTimeout(() => wp.classList.remove('is-hint'), 2600); }
    },
    replant(today) {
      if (today) {
        const fresh = plantedTodayFields(israelDateKey());
        if (!replanted) replanted = Object.fromEntries(Object.keys(fresh).map((k) => [k, (ctx.tree as any)[k]])) as Partial<TreeRecord>;
        Object.assign(ctx.tree, fresh);
      } else if (replanted) {
        Object.assign(ctx.tree, replanted);
        replanted = null;
      } else return;
      timeline.rebuild(); feed.render(); herb.render(); about.render();
      push();
    },
    openShare: () => openShareSheet(ctx),
    openInvite: () => openInviteSheet(ctx),
    openGreet: () => feed.open(),
    openInstall: () => void addToHomeScreen(),
  };

  /* ---------------- scene */
  const scene = createTreeScene(ctx.derive());
  ctx.scene = scene;
  const dock = new Dock(ctx);
  const panel = new Panel(ctx, dock, fxCanvas);
  const proxies = new Proxies(ctx, dock);
  const intro = new Intro(ctx);
  const feed = new Feed(ctx, dock);
  const herb = new Herbarium(ctx);
  const about = new About(ctx, dock);
  const timeline = new Timeline(ctx, () => runFlow('birth'));
  initPwa();

  scene.on('hotspots-change', (list) => {
    hotspots = list;
    proxies.update(list);
    dock.position();
    panel.positionCandle();
  });
  scene.on('hotspot', (h) => {
    sound.unlock();
    if (stage.dataset.birth === 'playing') return;
    if (h.kind === 'trunk' || h.kind === 'leaf') return; // the scene shakes / rustles by itself
    dock.fromHotspot(h, false, true);
  });

  // the custom cursor (desktop) says "גררו" only over the island and the tree, not over the empty paper
  // around it (a label parked at the window's corner read as a stray "ג")
  let curOver = false, curT = 0;
  const setCursor = (over: boolean) => {
    if (over === curOver) return;
    curOver = over;
    if (over) sceneEl.dataset.cursor = 'גררו'; else delete sceneEl.dataset.cursor;
    bus.emit('cursor:set', over ? { label: 'גררו' } : null);
  };
  sceneEl.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const now = performance.now();
    if (now - curT < 60) return;
    curT = now;
    const r = sceneEl.getBoundingClientRect();
    setCursor(!!scene.hitTest?.(e.clientX - r.left, e.clientY - r.top));
  }, { passive: true });
  sceneEl.addEventListener('pointerleave', () => setCursor(false));

  // the scene element: focusable, Enter waters, arrows rotate (7.6 keyboard)
  sceneEl.tabIndex = 0;
  sceneEl.setAttribute('role', 'group');
  sceneEl.addEventListener('keydown', (e) => {
    if (e.target !== sceneEl) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); scene.rotateBy(e.key === 'ArrowRight' ? 9 : -9); }
    else if (e.key === 'Enter') { e.preventDefault(); if (ctx.demo.mode === 'memorial') (stage.querySelector('[data-candle]') as HTMLElement | null)?.click(); else panel.start(true); }
  });

  /* ---------------- tone: night → the interface goes into --moss */
  const tone = () => {
    const t = sceneEl.dataset.sceneTone === 'dark' ? 'dark' : 'light';
    if (main.dataset.tone !== t) {
      main.dataset.tone = t;
      stage.dataset.header = t === 'dark' ? 'light' : 'dark';
      panel.setTone(t);
      // the header re-reads its tone (night: the interface goes into --moss)
      if (window.scrollY < stage.offsetHeight * 0.6) bus.emit('theme:section', { bg: t === 'dark' ? 'moss' : 'cream', dark: t === 'dark' });
    }
  };
  new MutationObserver(tone).observe(sceneEl, { attributes: true, attributeFilter: ['data-scene-tone'] });
  // pinch-zoom on the crown (7.6): the enlarged scene runs under the panel → the panel steps aside meanwhile
  const zoomBtn = el(`<button class="tree-unzoom" type="button">${icon('back', 'icon')}<span>חוזרים לעץ</span></button>`);
  zoomBtn.addEventListener('click', () => void scene.focus('reset'));
  stage.appendChild(zoomBtn);
  new MutationObserver(() => {
    const z = 'zoomed' in sceneEl.dataset;
    if (('zoomed' in stage.dataset) === z) return;
    if (z) stage.dataset.zoomed = ''; else delete stage.dataset.zoomed;
  }).observe(sceneEl, { attributes: true, attributeFilter: ['data-zoomed'] });

  /* ---------------- the light parts that follow the state */
  const headEls = {
    number: stage.querySelector<HTMLElement>('[data-f="number"]')!,
    species: stage.querySelector<HTMLElement>('[data-f="species"]')!,
    dedication: stage.querySelector<HTMLElement>('[data-f="dedication"]')!,
    note: stage.querySelector<HTMLElement>('[data-f="note"]')!,
    news: stage.querySelector<HTMLButtonElement>('[data-news]')!,
    desc: stage.querySelector<HTMLElement>('[data-a11y-desc]')!,
    cond: stage.querySelector<HTMLElement>('[data-cond]')!,
  };
  headEls.news.addEventListener('click', () => dock.news());
  let lastAmbient: Ambient | undefined;
  let condSig = '';

  function push() {
    const s = ctx.derive();
    scene.setState(s);
    stage.dataset.flow = ctx.flow;
    const sp = SPECIES[s.species] ?? SPECIES.fig;
    headEls.number.innerHTML = `${he.tree.number(ctx.tree.id).replace(ctx.tree.id, `<bdi>${ctx.tree.id}</bdi>`)}`;
    headEls.species.textContent = sp.he;
    headEls.dedication.textContent = ctx.tree.dedication;
    headEls.note.textContent = s.planted ? `${seasonNote(s)} · ${ageHe(s.ageDays)}` : he.tree.states.plantingIn(9);
    headEls.news.hidden = !s.hasNews || ctx.flow === 'before' || !!stage.dataset.time;
    const d = describeTree(ctx.tree, s, ctx.store.facts());
    headEls.desc.textContent = d;
    sceneEl.setAttribute('aria-label', `${d}. Enter משקה, החיצים מסובבים את האי`);
    // ambient by time of day / weather (off until the visitor turns sound on in the header)
    const amb: Ambient = ctx.demo.mode === 'memorial' ? 'memorial' : s.weather === 'rain' ? 'rain'
      : ({ morning: 'morning', noon: 'day', evening: 'evening', night: 'night' } as const)[dayPeriod(s.hours)];
    if (amb !== lastAmbient) { lastAmbient = amb; sound.setAmbient(amb); }
    // the honest readout: what shapes the tree right now
    const hh = Math.floor(s.hours), mm = Math.round((s.hours % 1) * 60);
    const timeIc = s.hours >= 19 || s.hours < 5.5 ? 'moon' : 'sun';
    const wIc = s.weather === 'clear' ? timeIc : s.weather === 'hamsin' ? 'haze' : s.weather;
    const sig = `${hh}:${mm}|${s.weather}|${s.season}|${ctx.flow}|${stage.dataset.time ?? ''}`;
    if (sig !== condSig) {
      condSig = sig;
      headEls.cond.innerHTML = `
        <p class="tree-cond__t">עכשיו ביער${ctx.demo.hours == null && !stage.dataset.time ? '' : ' (בדמו)'}</p>
        <ul class="tree-cond__list" role="list">
          <li>${icon(timeIc)}<span><bdi>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</bdi> · ${greetingFor(s.hours)}</span></li>
          <li>${icon(wIc)}<span>${WEATHER_HE[s.weather]}</span></li>
          <li>${icon('leaf')}<span>${SEASON_HE[s.season]}</span></li>
          <li>${icon('drop')}<span>השקיה של הצוות: <bdi>${ilDate(ctx.tree.lastTeamWatering)}</bdi></span></li>
        </ul>`;
    }
  }

  /* ---------------- reveal the UI around the scene (after an arrival) */
  function revealUi() {
    if (!env.motionAllowed()) return;
    const head = stage.querySelectorAll('.tree-head > :not([hidden])');
    gsap.fromTo(head, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, clearProps: 'transform,opacity' });
    gsap.fromTo(stage.querySelectorAll('[data-panel] > .wp, .tree-tl, .tree-cond'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, delay: 0.25, clearProps: 'transform,opacity' });
  }

  /* ---------------- multi: swipe between islands like cards */
  let family: TreeRecord[] = [];
  let familyIdx = 0;
  let pager: HTMLElement | null = null;
  function buildPager() {
    pager?.remove();
    family = familyTrees().map((t, i) => (i === 0 ? ctx.tree : t));
    familyIdx = 0;
    pager = el(`<nav class="tree-pager" aria-label="העצים שלכם">
      <button class="tree-pager__arr" type="button" data-dir="-1" aria-label="העץ הקודם">${icon('back')}</button>
      <ol class="tree-pager__dots" role="list">${family.map((t, i) => `<li><button type="button" class="tree-pager__dot" data-i="${i}" aria-current="${i === 0}" aria-label="${he.tree.number(t.id)}, ${esc(t.dedication)}"><bdi>${t.id}</bdi></button></li>`).join('')}</ol>
      <button class="tree-pager__arr" type="button" data-dir="1" aria-label="העץ הבא">${icon('arrow')}</button>
    </nav>`);
    if (env.isMobile()) stage.appendChild(pager); else stage.querySelector('[data-head]')!.prepend(pager);
    // a flag, not .tree-stage:has(.tree-pager): a :has() on the stage made every text change inside it (the scene's
    // labels, the clock) re-check the whole stage subtree
    stage.toggleAttribute('data-pager', true);
    pager.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((b) => b.addEventListener('click', () => go(familyIdx + Number(b.dataset.dir))));
    pager.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.i))));
  }
  function go(i: number) {
    if (!family.length) return;
    const n = (i + family.length) % family.length;
    if (n === familyIdx) return;
    const dir = (i > familyIdx ? 1 : -1);
    familyIdx = n;
    pager?.querySelectorAll('[data-i]').forEach((b) => b.setAttribute('aria-current', String(Number((b as HTMLElement).dataset.i) === n)));
    const swap = () => {
      dock.close(true);
      ctx.tree = family[n];
      ctx.store = store = new TreeStore(ctx.tree.id);
      store.visit();
      ctx.override = {};
      panel.render();
      timeline.rebuild();
      feed.render(); herb.render(); about.render();
      push();
      ctx.announce(`${he.tree.number(ctx.tree.id)}: ${ctx.tree.dedication}`);
    };
    if (!env.motionAllowed()) { swap(); return; }
    // RTL: "next" travels to the left
    gsap.timeline()
      .to([sceneEl, stage.querySelector('.tree-head')], { x: dir * -60, opacity: 0, duration: 0.45, ease: 'power3.in' })
      .call(swap)
      .fromTo([sceneEl, stage.querySelector('.tree-head')], { x: dir * 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.9, ease: 'expo.out', clearProps: 'transform' });
  }
  // swipe on the text & panel area (the scene itself turns the island)
  let sx = 0, sy = 0, st = 0;
  stage.addEventListener('pointerdown', (e) => {
    if (!pager || (e.target as HTMLElement).closest('.ts, input, [data-water]')) return;
    sx = e.clientX; sy = e.clientY; st = performance.now();
  });
  stage.addEventListener('pointerup', (e) => {
    if (!pager || !st) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (performance.now() - st < 600 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(familyIdx + (dx > 0 ? 1 : -1));
    st = 0;
  });

  /* ---------------- offline (7.3 "נקודת" no network) */
  let offlineBanner: HTMLElement | null = null;
  function setOffline(off: boolean, simulated = false) {
    ctx.online = !off;
    if (off && !offlineBanner) {
      // the version on screen is the one this browser last saw online
      const saved = new Date(store.data.syncedAt ?? Date.now());
      const il = israelNow(saved);
      const hm = `${String(il.hour).padStart(2, '0')}:${String(il.minute).padStart(2, '0')}`;
      const savedKey = israelDateKey(saved);
      const when = savedKey === israelDateKey() ? hm : `${ilDate(savedKey)}, ${hm}`;
      offlineBanner = el(`<p class="tree-offline" role="status">${icon('wifiOff')}<span class="tree-offline__long">אין חיבור כרגע. מוצגת הגרסה האחרונה ששמרנו (<bdi>${ilDate(savedKey)}, ${hm}</bdi>). השקיה תישמר ותישלח כשהחיבור יחזור.</span><span class="tree-offline__short">אין חיבור כרגע · מוצגת הגרסה מ־<bdi>${when}</bdi></span></p>`);
      stage.appendChild(offlineBanner);
      stage.toggleAttribute('data-offline', true); // the flag tree.css reads (no :has() on the stage)
      if (env.motionAllowed()) gsap.fromTo(offlineBanner, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' });
    }
    if (!off) {
      offlineBanner?.remove(); offlineBanner = null;
      stage.toggleAttribute('data-offline', false);
      const q = store.flush();
      if (q.length) {
        panel.flushed(q.length);
        dock.toast('החיבור חזר, וההשקיה נשלחה', 'check');
        ctx.announce('החיבור חזר, וההשקיה נשלחה');
      }
    }
    void simulated;
  }
  // a real connection change (not the demo switch): back online → send the queued watering
  let demoOffline = fromUrl.state === 'offline';
  window.addEventListener('offline', () => setOffline(true));
  window.addEventListener('online', () => {
    if (demoOffline) return;
    setOffline(false);
    if (ctx.flow === 'offline') { ctx.flow = 'visit'; ctx.demo.state = 'visit'; presenter.syncState(); }
  });

  /* ---------------- flows (7.3) */
  let firstRun = true;
  function runFlow(f: PageState, byDemo = true) {
    const prev = ctx.flow;
    if (byDemo) demoOffline = f === 'offline';
    intro.stop();
    dock.close(true);
    dock.closePlaque(true);
    ctx.flow = f; ctx.demo.state = f;
    presenter.syncState();
    if (prev === 'offline' && f !== 'offline') setOffline(!navigator.onLine);
    if (f !== 'multi' && pager) {
      pager.remove(); pager = null;
      stage.toggleAttribute('data-pager', false);
      if (ctx.tree.id !== base.id) { ctx.tree = base; ctx.store = store = new TreeStore(base.id); timeline.rebuild(); feed.render(); herb.render(); about.render(); }
    }
    ctx.override = {};
    // a sapling "planted today" by the before → birth demo goes back to being the demo tree
    if (f !== 'birth') ctx.replant(false);
    timeline.reset(false);
    panel.render();
    push();
    about.render();
    switch (f) {
      case 'birth': void intro.birth(ctx.tree.plantedAt); break;
      case 'before':
        ctx.setIntro(false);
        void scene.playVisitIntro();
        void intro.beforePlanting();
        break;
      case 'gift': void intro.gift(flags.from ?? 'סבתא רותי', flags.msg ?? 'מזל טוב! מחכים לתאנה הראשונה'); break;
      default: {
        ctx.setIntro(false);
        if (!firstRun) revealUi();
        void scene.playVisitIntro();
        if (f === 'offline') setOffline(true, true);
        if (f === 'multi') buildPager();
        arrivalNotes(f);
      }
    }
    firstRun = false;
  }

  /** after a visit: "התגעגענו" / "יש חדש" / "נועה, יש לך N עלים חדשים" / ripe fruit */
  function arrivalNotes(f: PageState) {
    const delay = env.motionAllowed() ? 1600 : 300;
    const memorial = ctx.demo.mode === 'memorial';
    setTimeout(() => {
      if (ctx.flow !== f || dock.openId) return;
      if (f === 'absent') { dock.missed(Math.max(14, store.daysAway() || 23)); return; }
      if (flags.greet) return;
      if (memorial) return;
      const since = store.previousVisit;
      const fresh = since ? allGreetings(ctx.tree, store.facts()).filter((g) => g.date > since && !g.mine).length : 0;
      if (fresh > 0) { dock.newLeaves(fresh); return; }
      if (ctx.derive().harvestReady) dock.harvest();
    }, delay);
  }

  /* ---------------- presenter */
  const presenter = new Presenter(ctx, {
    onSeason(s) {
      if (s) { store.collect(s); herb.render(); }
      push();
    },
    onReset() {
      store.reset(); store.visit(); store.collect(seasonOf(israelNow().month));
      ctx.tree.greetings = [...TREE.greetings];
      panel.render(); feed.render(); herb.render(); about.render(); push();
      dock.toast('הדמו התחיל מחדש', 'rotate');
    },
    onStreak(n) { store.seedStreak(n); panel.render(); dock.toast(`רצף של ${n} ימים: גפן של עלים סביב הכפתור`, 'leaf'); },
    onNewLeaves(n) {
      const names: [string, string][] = [['יעל ותומר', 'שתגדלי יחד עם התאנה'], ['סבא משה', 'מזל טוב, נועה'], ['דודה מיכל', 'הרבה אור ומים'], ['החברים מהעבודה', 'באהבה מכולנו'], ['נגה', 'מחכה לתאנה הראשונה']];
      const today = israelDateKey();
      const add: Greeting[] = names.slice(0, n).map(([from, text], i) => ({ id: `demo-${Date.now().toString(36)}-${i}`, from, initials: initialsOf(from), text, date: today, amount: 18 * (1 + (i % 3)) }));
      ctx.tree.greetings = [...ctx.tree.greetings, ...add];
      feed.render(); push();
      sound.play('sparkle', { volume: 0.6 });
      setTimeout(() => dock.newLeaves(n), 350);
    },
    onWeather() { push(); },
    onMode() {
      const memorial = ctx.demo.mode === 'memorial';
      if (!flags.text) ctx.tree.dedication = memorial ? MEMORIAL_DEMO.dedication : TREE.dedication;
      if (!memorial) panel.removeCandle();
      dock.close(true); dock.closePlaque(true);
      panel.render(); feed.render(); herb.render(); about.render(); push();
      main.dataset.mode = ctx.demo.mode;
      ctx.announce(memorial ? 'מצב זיכרון: בלי משחק, רק נר ומילים' : 'עץ לשמחה');
    },
    onHarvest(on) {
      push();
      if (on) { store.collectSpecial('firstFruit'); herb.render(); setTimeout(() => dock.harvest(), env.motionAllowed() ? 700 : 0); }
      about.render();
    },
  });

  /* ---------------- phone: the sticky bar steps aside while the tree's own panel is under the thumb */
  if ('IntersectionObserver' in window) {
    const root = document.documentElement;
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio > 0.35) root.setAttribute('data-hide-sticky', ''); else root.removeAttribute('data-hide-sticky');
      // off screen: the stage's endless CSS loops pause (cards.css) — the scene pauses its own render loop
      stage.toggleAttribute('data-away', !e.isIntersecting);
    }, { threshold: [0, 0.35, 0.6] }).observe(stage);
  }

  /* ---------------- boot */
  main.dataset.mode = ctx.demo.mode;
  feed.render();
  herb.render();
  about.render();
  push();
  setIntroAttr(flow === 'birth' || flow === 'gift' ? '1' : '');
  const boot = async () => {
    // a birth (or the gift envelope before it) opens on empty paper → the soil close-up, never on the grown tree
    await scene.mount(sceneEl, { birth: flow === 'birth' || flow === 'gift' });
    tone();
    runFlow(flow, !!fromUrl.state);
    if (flags.greet) setTimeout(() => feed.open(), env.motionAllowed() ? 1400 : 200);
    // device tier → leaves count / hatching (after first paint, never blocking)
    gpuTier().then((r) => { const q = Math.max(env.motionAllowed() ? 1 : 0, Math.min(3, r.tier)) as 0 | 1 | 2 | 3; if (q !== quality) { quality = q; push(); } }).catch(() => {});
  };
  // first paint: the page shell; the scene's static SVG right after, the 3D after its first frame
  requestAnimationFrame(() => setTimeout(() => void boot(), 0));
  // live Israel time: the light follows the clock
  setInterval(() => { if (ctx.demo.hours == null) push(); }, 60_000);
  bus.on('motion:change', () => push());

  if (import.meta.env.DEV) {
    (window as any).__tree = { ctx, scene, renderShare: (f: 'story' | 'square' | 'og') => renderShare(ctx, f), panel, dock, store: () => ctx.store };
  }
}
