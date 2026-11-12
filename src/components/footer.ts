/* ==========================================================================
   Site footer (all pages) — CONTRACT: initFooter() (called by bootPage on every page).
   Markup: partials/footer.html (+ footer.css). Owned by the "lower" agent.

   ONE idea: "בואו לנטוע" is grass. The letters stand on the soil; each one turns on its
   own base (a damped spring per letter, transform: rotate only):
   · a slow gust travels through them right → left (the reading direction)
   · the cursor brushes them (horizontal pointer speed × proximity × how high you touch)
   · phones: a finger moving over them, and scrolling, give a gentle push
   · on first view they grow out of the soil; the soil has their roots (drawn lines)
   · a seed can be dragged into the ground → it sinks, a sprout grows there, the letters lean
     away from it, and "נוטעים עץ משלכם" appears where the seed was. A press / tap / Enter on
     the seed plants it in the gap between the two words (the button alternative).
     The sprout stays for the session (sessionStorage), on every page.
   · desktop + motion: the line dog runs across once, the first time the field is in view.
   Reduced motion: letters still, no intro, no dog; planting still works, without animation.
   Ticker runs only while the field is on screen.
   ========================================================================== */
import './footer.css';
import { gsap } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { sound } from '../core/sound';
import { session } from '../core/storage';
import { he } from '../content/he';
import { mountDog, type DogHandle } from './dog';

interface Ch { el: HTMLElement; inner: HTMLElement; cx: number; w: number; a: number; v: number }

const KEY = 'footer:sprout';
const SVGNS = 'http://www.w3.org/2000/svg';
const heGet = (path: string): unknown => path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), he);
const clamp = (min: number, max: number, v: number) => Math.min(max, Math.max(min, v));
/** seeded RNG — the same roots on every visit */
function rng(seed: number) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296); }

/* sprout drawing — ground at y = 0, stem up to y ≈ -78 (viewBox -40 -122 80 124) */
const SPROUT = {
  stem: 'M0 0C0-20-3-40 1.5-66',
  leafR: 'M1 -46C3-63 15-73 33-74C31-57 19-47 1-46Z',
  leafL: 'M.5 -30C-1.5-43-10.5-50.5-25-51C-23.5-38-14.5-31-.5-30Z',
  bud: 'M1.5 -66C1-71.5 3.5-75.5 8-77.5',
};

export function initFooter(): void {
  const root = document.getElementById('footer');
  if (!root || root.dataset.footerReady) return;
  root.dataset.footerReady = '1';

  root.querySelectorAll<HTMLElement>('[data-he]').forEach((el) => {
    const v = heGet(el.dataset.he!);
    if (typeof v === 'string' && el.textContent !== v) el.textContent = v;
  });
  const year = root.querySelector<HTMLElement>('[data-footer-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  const field = root.querySelector<HTMLElement>('[data-footer-field]');
  const big = root.querySelector<HTMLElement>('[data-footer-big]');
  const seedbox = root.querySelector<HTMLElement>('[data-footer-seedbox]');
  const ask = root.querySelector<HTMLElement>('[data-footer-ask]');
  const seed = root.querySelector<HTMLButtonElement>('[data-footer-seed]');
  const hint = root.querySelector<HTMLElement>('[data-footer-hint]');
  const cta = root.querySelector<HTMLAnchorElement>('[data-footer-cta]');
  const soil = root.querySelector<HTMLElement>('[data-footer-soil]');
  const under = root.querySelector<SVGSVGElement>('[data-footer-under]');
  const status = root.querySelector<HTMLElement>('[data-footer-status]');
  if (!field || !big || !seedbox || !soil) return;

  /* ------------------------------------------------------------ letters */
  const text = he.footer.big;
  big.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'visually-hidden';
  sr.textContent = text;
  big.append(sr);
  const chars: Ch[] = [];
  let gapEl: HTMLElement | null = null;
  for (const c of Array.from(text)) {
    if (c === ' ') {
      gapEl = document.createElement('span');
      gapEl.className = 'site-footer__sp';
      gapEl.setAttribute('aria-hidden', 'true');
      big.append(gapEl);
      continue;
    }
    const el = document.createElement('span');
    el.className = 'site-footer__ch';
    el.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'site-footer__ch-in';
    inner.textContent = c;
    el.append(inner);
    big.append(el);
    chars.push({ el, inner, cx: 0, w: 0, a: 0, v: 0 });
  }

  /* ------------------------------------------------------------ layout */
  let fs = 0;
  let fieldW = 0;
  let groundY = 0;  // field-relative y of the soil line (= field bottom)
  let topY = 0;     // field-relative y of the letters' tops (approx.)
  let glyphH = 1;
  let gapX = 0;

  function layout() {
    const avail = field!.clientWidth;
    if (!avail) return;
    // fit the two words to the full width
    big!.style.setProperty('--big-fs', '20px');
    const first = chars[0].el;
    const last = chars[chars.length - 1].el;
    const natural = Math.abs((first.offsetLeft + first.offsetWidth) - last.offsetLeft) || 1;
    fs = clamp(30, 560, (20 * avail) / natural * 0.985);
    big!.style.setProperty('--big-fs', `${fs.toFixed(2)}px`);
    // the baseline: the letters stand on the soil and turn around it
    const probe = document.createElement('i');
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    chars[0].inner.append(probe);
    // offset* ignore transforms (letters may be mid-sway or still under the soil)
    const desc = (first.offsetTop + first.offsetHeight) - probe.offsetTop;
    probe.remove();
    big!.style.setProperty('--big-desc', `${Math.max(0, desc).toFixed(2)}px`);
    big!.style.setProperty('--big-sink', `${Math.max(3, fs * 0.02).toFixed(1)}px`);

    fieldW = field!.clientWidth;
    groundY = field!.clientHeight;
    glyphH = fs * 0.72;
    topY = groundY - glyphH;
    for (const ch of chars) { ch.w = ch.el.offsetWidth; ch.cx = big!.offsetLeft + ch.el.offsetLeft + ch.w / 2; }
    gapX = gapEl ? big!.offsetLeft + gapEl.offsetLeft + gapEl.offsetWidth / 2 : fieldW / 2;
    seedbox!.style.setProperty('--gap-shift', `${(gapX - fieldW / 2).toFixed(1)}px`);
    const sh = clamp(66, 176, fs * 0.64);
    root!.style.setProperty('--sprout-h', `${sh.toFixed(1)}px`);
    root!.style.setProperty('--sprout-w', `${(sh * 80 / 124).toFixed(1)}px`);
    drawUnder();
    placeSprout();
  }

  /* roots of the letters + a few pebbles in the soil (SVG, field-independent soil coordinates) */
  let rootPaths: SVGPathElement[] = [];
  function drawUnder() {
    if (!under) return;
    const W = soil!.clientWidth;
    const off = field!.offsetLeft;
    const H = 130;
    under.setAttribute('viewBox', `0 0 ${W} ${H}`);
    under.textContent = '';
    rootPaths = [];
    const r = rng(1405);
    const depth = clamp(26, 96, fs * 0.34);
    chars.forEach((ch) => {
      const x0 = off + ch.cx;
      const n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const sx = x0 + (r() - 0.5) * ch.w * 0.5;
        const d = depth * (0.55 + r() * 0.6);
        const bend = (r() - 0.5) * d * 0.7;
        const ex = sx + bend;
        const p = document.createElementNS(SVGNS, 'path');
        p.setAttribute('d', `M${sx.toFixed(1)} 2C${(sx + bend * 0.1).toFixed(1)} ${(d * 0.35).toFixed(1)} ${(ex - bend * 0.4).toFixed(1)} ${(d * 0.7).toFixed(1)} ${ex.toFixed(1)} ${d.toFixed(1)}`);
        under.append(p);
        rootPaths.push(p);
        if (r() > 0.45) {
          // one rootlet off the side
          const t = 0.45 + r() * 0.3;
          const bx = sx + bend * t * 0.8;
          const by = d * t;
          const dir = r() > 0.5 ? 1 : -1;
          const q = document.createElementNS(SVGNS, 'path');
          q.setAttribute('d', `M${bx.toFixed(1)} ${by.toFixed(1)}q${(dir * d * 0.12).toFixed(1)} ${(d * 0.08).toFixed(1)} ${(dir * d * 0.3).toFixed(1)} ${(d * 0.26).toFixed(1)}`);
          under.append(q);
          rootPaths.push(q);
        }
      }
    });
    const pr = rng(77);
    const count = Math.round(W / 46);
    for (let i = 0; i < count; i++) {
      const e = document.createElementNS(SVGNS, 'ellipse');
      e.setAttribute('class', 'pebble');
      e.setAttribute('cx', (pr() * W).toFixed(1));
      e.setAttribute('cy', (14 + pr() * (H - 54)).toFixed(1));
      const rx = 1.6 + pr() * 4.2;
      e.setAttribute('rx', rx.toFixed(1));
      e.setAttribute('ry', (rx * (0.55 + pr() * 0.3)).toFixed(1));
      under.append(e);
    }
    if (introPending && env.motionAllowed()) gsap.set(rootPaths, { drawSVG: '0%' });
  }

  /* ------------------------------------------------------------ physics (grass) */
  const K = 92;   // stiffness (1/s²)
  const C = 6.4;  // damping (1/s)
  let t = 0;
  let inView = false;
  let ticking = false;
  const tick = (_time: number, deltaMs: number) => {
    const dt = Math.min(0.033, deltaMs / 1000);
    t += dt;
    const amp = env.isTouch ? 1.2 : 1.6;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      // a slow gust travelling right → left (DOM order), leaning the tops to the left
      const gust = 0.5 + 0.5 * Math.sin(t * 1.05 - i * 0.52);
      const flutter = Math.sin(t * 2.3 + i * 1.7) * 0.18;
      const target = -amp * (0.25 + 0.75 * gust) + flutter;
      ch.v += (-K * (ch.a - target) - C * ch.v) * dt;
      ch.a = clamp(-24, 24, ch.a + ch.v * dt);
      ch.el.style.transform = `rotate(${ch.a.toFixed(2)}deg)`;
    }
  };
  const syncTicker = () => {
    const want = inView && env.motionAllowed();
    if (want && !ticking) { gsap.ticker.add(tick); ticking = true; }
    else if (!want && ticking) {
      gsap.ticker.remove(tick); ticking = false;
      if (!env.motionAllowed()) chars.forEach((c) => { c.a = 0; c.v = 0; c.el.style.transform = ''; });
    }
  };

  /** a brush through the grass at (clientX, clientY) moving dx px horizontally */
  function brush(clientX: number, clientY: number, dx: number, gain: number) {
    if (!ticking || !dx) return;
    const r = field!.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    if (y < topY - 40 || y > groundY + 16) return;
    const lev = clamp(0.2, 1.15, (groundY - y) / glyphH);
    for (const ch of chars) {
      const d = (x - ch.cx) / (ch.w * 0.9 + 18);
      const infl = Math.exp(-d * d);
      if (infl < 0.03) continue;
      ch.v = clamp(-260, 260, ch.v + clamp(-40, 40, dx) * gain * infl * lev);
    }
  }
  let lastX: number | null = null;
  field.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && !dragging) return;
    const dx = lastX == null ? 0 : e.clientX - lastX;
    lastX = e.clientX;
    brush(e.clientX, e.clientY, dx, 4.4);
  }, { passive: true });
  field.addEventListener('pointerleave', () => { lastX = null; }, { passive: true });
  // phones: a finger moving across the words (the page still scrolls)
  let lastTouchX: number | null = null;
  field.addEventListener('touchstart', (e) => { lastTouchX = e.touches[0]?.clientX ?? null; }, { passive: true });
  field.addEventListener('touchmove', (e) => {
    const tch = e.touches[0];
    if (!tch) return;
    const dx = lastTouchX == null ? 0 : tch.clientX - lastTouchX;
    lastTouchX = tch.clientX;
    brush(tch.clientX, tch.clientY, dx, 3.2);
  }, { passive: true });
  // scrolling is a soft breeze too (stronger on phones, where there is no cursor)
  let lastScroll = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const dy = y - lastScroll;
    lastScroll = y;
    if (!ticking) return;
    const g = env.isTouch ? 0.55 : 0.3;
    chars.forEach((ch, i) => { ch.v = clamp(-260, 260, ch.v + clamp(-50, 50, dy) * g * (0.65 + 0.35 * Math.sin(i * 1.3))); });
  }, { passive: true });

  /** letters lean away from a new sprout */
  function shock(x: number) {
    if (!ticking) return;
    for (const ch of chars) {
      const d = ch.cx - x;
      const k = Math.exp(-((d / (fs * 1.1)) ** 2));
      ch.v += Math.sign(d || 1) * 120 * k;
    }
  }

  /* ------------------------------------------------------------ the sprout */
  let sprout: SVGSVGElement | null = null;
  let sproutRatio: number | null = null;
  function buildSprout(): SVGSVGElement {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'site-footer__sprout');
    svg.setAttribute('viewBox', '-40 -122 80 124');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const layer of ['halo', 'line']) {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', layer);
      (Object.keys(SPROUT) as (keyof typeof SPROUT)[]).forEach((k) => {
        const p = document.createElementNS(SVGNS, 'path');
        p.setAttribute('d', SPROUT[k]);
        p.setAttribute('data-part', k);
        if (k.startsWith('leaf')) p.setAttribute('class', 'leaf');
        g.append(p);
      });
      svg.append(g);
    }
    return svg;
  }
  function placeSprout() {
    if (!sprout || sproutRatio == null) return;
    const w = parseFloat(getComputedStyle(root!).getPropertyValue('--sprout-w')) || 80;
    sprout.style.left = `${(sproutRatio * fieldW - w / 2).toFixed(1)}px`;
  }
  function growSprout(x: number, animate: boolean) {
    sproutRatio = clamp(0.03, 0.97, x / (fieldW || 1));
    sprout?.remove();
    sprout = buildSprout();
    field!.append(sprout);
    placeSprout();
    if (!animate) return;
    const part = (k: string) => Array.from(sprout!.querySelectorAll<SVGPathElement>(`[data-part="${k}"]`));
    const leaves = [...part('leafR'), ...part('leafL')];
    gsap.timeline()
      .set([...part('stem'), ...leaves, ...part('bud')], { drawSVG: '0%' })
      .set(part('leafR'), { scale: 0.4, svgOrigin: '1 -46' })
      .set(part('leafL'), { scale: 0.4, svgOrigin: '0.5 -30' })
      .to(part('stem'), { drawSVG: '100%', duration: 0.9, ease: 'power2.out' })
      .to(leaves, { drawSVG: '100%', duration: 0.7, ease: 'power2.out', stagger: 0.12 }, '-=0.45')
      .to(leaves, { scale: 1, duration: 1.1, ease: 'elastic.out(1, 0.55)', stagger: 0.12 }, '<')
      .to(part('bud'), { drawSVG: '100%', duration: 0.45, ease: 'power2.out' }, '-=0.7');
  }

  /* ------------------------------------------------------------ seed → ground */
  let planted = false;
  let dragging = false;
  let suppressClick = false;
  let hole: HTMLElement | null = null;

  function showCta(focus: boolean) {
    root!.classList.remove('site-footer--seed');
    root!.classList.add('site-footer--planted');
    if (ask) ask.hidden = true;
    if (cta) {
      cta.removeAttribute('tabindex');
      cta.removeAttribute('aria-hidden');
      if (env.motionAllowed()) gsap.fromTo(cta, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', clearProps: 'opacity,transform' });
      if (focus) cta.focus({ preventScroll: true });
    }
  }

  function ensureHole(): HTMLElement {
    if (!hole) {
      hole = document.createElement('span');
      hole.className = 'site-footer__hole';
      hole.setAttribute('aria-hidden', 'true');
      soil!.append(hole);
    }
    return hole;
  }
  function moveHole(clientX: number, state: 'near' | 'open' | 'none') {
    const h = ensureHole();
    const sr = soil!.getBoundingClientRect();
    h.style.left = `${(clientX - sr.left).toFixed(1)}px`;
    h.classList.toggle('is-near', state === 'near');
    h.classList.toggle('is-open', state === 'open');
  }

  function plant(x: number, how: 'drag' | 'tap' | 'keyboard') {
    if (planted || !seed) return;
    planted = true;
    x = clamp(fieldW * 0.03, fieldW * 0.97, x);
    session.set(KEY, String(x / (fieldW || 1)));
    if (status) status.textContent = 'נבט קטן צומח מהאדמה';
    const focusCta = how === 'keyboard' || document.activeElement === seed;

    if (!env.motionAllowed()) {
      growSprout(x, false);
      showCta(focusCta);
      sound.play('pop');
      return;
    }

    const fr = field!.getBoundingClientRect();
    const sr = seed.getBoundingClientRect();
    const cx = sr.left + sr.width / 2;
    const cy = sr.top + sr.height / 2;
    const curX = Number(gsap.getProperty(seed, 'x')) || 0;
    const curY = Number(gsap.getProperty(seed, 'y')) || 0;
    const tx = curX + (fr.left + x - cx);
    const ty = curY + (fr.bottom - cy) - 6;
    const tl = gsap.timeline();
    if (how === 'drag') {
      tl.to(seed, { x: tx, y: ty, rotation: 30, duration: 0.32, ease: 'power2.in' });
    } else {
      // a little toss, then gravity
      moveHole(fr.left + x, 'near');
      tl.to(seed, { x: tx, duration: 0.95, ease: 'power1.inOut' }, 0)
        .to(seed, { y: curY - Math.min(46, sr.height), rotation: -40, duration: 0.34, ease: 'power2.out' }, 0)
        .to(seed, { y: ty, rotation: 40, duration: 0.61, ease: 'power2.in' }, 0.34);
    }
    tl.add(() => {
      moveHole(fr.left + x, 'open');
      seed.classList.add('is-falling'); // drops behind the soil
      sound.play('crack', { volume: 0.7 });
      sound.haptic(12);
    })
      .to(seed, { y: '+=44', rotation: '+=50', duration: 0.6, ease: 'power2.in' })
      .add(() => {
        hole?.classList.remove('is-open', 'is-near');
        growSprout(x, true);
        shock(x);
        sound.play('pop');
      }, '-=0.15')
      .add(() => showCta(focusCta), '+=0.75');
  }

  if (seed && ask && cta) {
    if (hint && env.isTouch) hint.textContent = 'גררו את הזרע לאדמה, או הקישו עליו';
    let pid = -1;
    let x0 = 0;
    let y0 = 0;
    let moved = false;
    const overSoil = (clientY: number) => clientY >= field.getBoundingClientRect().bottom - 8;
    const nearSoil = (clientY: number) => clientY >= field.getBoundingClientRect().bottom - Math.max(90, fs * 0.5);

    seed.addEventListener('pointerdown', (e) => {
      if (planted || (e.pointerType === 'mouse' && e.button !== 0)) return;
      pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; moved = false;
      try { seed.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    seed.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid || planted) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (!moved) {
        if (Math.hypot(dx, dy) < 6) return;
        moved = true;
        dragging = true;
        gsap.killTweensOf(seed);
        seed.classList.add('is-dragging');
        root.classList.add('site-footer--dragging');
        sound.play('rustle', { volume: 0.4 });
      }
      gsap.set(seed, { x: dx, y: dy, rotation: clamp(-50, 50, dx * 0.08) });
      moveHole(e.clientX, overSoil(e.clientY) ? 'open' : nearSoil(e.clientY) ? 'near' : 'none');
      // the seed brushes the grass on its way down
      brush(e.clientX, e.clientY, e.movementX || 0, 3.6);
    });
    const end = (e: PointerEvent, ok: boolean) => {
      if (e.pointerId !== pid) return;
      pid = -1;
      dragging = false;
      seed.classList.remove('is-dragging');
      root.classList.remove('site-footer--dragging');
      if (!moved) return; // a plain press → the click handler plants it
      suppressClick = true;
      window.setTimeout(() => { suppressClick = false; }, 60);
      if (ok && overSoil(e.clientY)) {
        const r = field.getBoundingClientRect();
        plant(e.clientX - r.left, 'drag');
      } else {
        hole?.classList.remove('is-open', 'is-near');
        gsap.to(seed, { x: 0, y: 0, rotation: 0, duration: env.motionAllowed() ? 0.9 : 0, ease: 'elastic.out(1, 0.6)' });
      }
    };
    seed.addEventListener('pointerup', (e) => end(e, true));
    seed.addEventListener('pointercancel', (e) => end(e, false));
    seed.addEventListener('click', (e) => {
      if (suppressClick || planted) { suppressClick = false; return; }
      plant(gapX, e.detail === 0 ? 'keyboard' : 'tap');
    });
  }

  /* ------------------------------------------------------------ intro + dog */
  let introPending = false;
  let dog: DogHandle | null = null;
  let dogDone = false;
  function intro() {
    if (!introPending) return;
    introPending = false;
    if (!env.motionAllowed()) { gsap.set(chars.map((c) => c.inner), { clearProps: 'transform' }); gsap.set(rootPaths, { clearProps: 'all' }); return; }
    gsap.to(chars.map((c) => c.inner), { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.055, clearProps: 'transform' });
    gsap.to(rootPaths, { drawSVG: '100%', duration: 1.6, ease: 'power2.out', stagger: 0.012, delay: 0.35, onComplete() { gsap.set(rootPaths, { clearProps: 'all' }); } });
    chars.forEach((c, i) => { c.v += (i % 2 ? 1 : -1) * 30; });
  }
  function runDog() {
    if (dogDone || !env.motionAllowed() || env.isTouch || env.isMobile()) return;
    dogDone = true;
    window.setTimeout(() => {
      dog = mountDog(field!, { mode: 'runAcross', autoplay: false, ground: 6 });
      dog.runAcross().then(() => { window.setTimeout(() => { dog?.destroy(); dog = null; }, 400); });
    }, 700);
  }

  /* ------------------------------------------------------------ boot */
  const saved = session.get(KEY);
  const savedRatio = saved != null ? Number(saved) : NaN;
  if (seed && ask && cta) {
    if (Number.isFinite(savedRatio)) {
      planted = true;
      root.classList.add('site-footer--planted');
    } else {
      root.classList.add('site-footer--seed');
      ask.hidden = false;
      cta.setAttribute('tabindex', '-1');
      cta.setAttribute('aria-hidden', 'true');
    }
  }
  // letters wait under the soil until the field is first seen (only if it is not on screen already)
  if (env.motionAllowed()) {
    const r = field.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.9) {
      introPending = true;
      gsap.set(chars.map((c) => c.inner), { yPercent: 108 });
    }
  }
  layout();
  if (planted && Number.isFinite(savedRatio)) growSprout(savedRatio * fieldW, false);

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      inView = e.isIntersecting;
      syncTicker();
      if (e.isIntersecting && e.intersectionRatio >= 0.3) { intro(); runDog(); }
    }
  }, { threshold: [0, 0.3, 0.6] });
  io.observe(field);

  // re-fit when the fonts arrive and when the width changes
  document.fonts?.ready.then(() => layout());
  window.addEventListener('load', () => layout(), { once: true });
  let lw = field.clientWidth;
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      const w = field.clientWidth;
      if (Math.abs(w - lw) < 1) return;
      lw = w;
      layout();
    }).observe(field);
  }

  bus.on('motion:change', ({ allowed }: { allowed: boolean }) => {
    syncTicker();
    if (!allowed) {
      if (introPending) { introPending = false; gsap.set(chars.map((c) => c.inner), { clearProps: 'transform' }); gsap.set(rootPaths, { clearProps: 'all' }); }
      dog?.destroy();
      dog = null;
    }
  });
}
