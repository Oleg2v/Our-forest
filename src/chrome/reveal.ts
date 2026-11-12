/* ==========================================================================
   Reveal system — data-reveal="lines|letters|words|fade|leaf"
   lines   : SplitText lines rise from under a mask, step .08 s, expo.out 1.2 s
   letters : letters rise from under the line mask with a slight turn, step .04 s
   words   : long paragraphs are "read" on scroll — words go from pale to full (scrub)
   fade    : soft rise + fade
   leaf    : image opens through a leaf-shaped clip-path, inner media scale 1.2 → 1, 1.4 s power4.out
   Optional: data-reveal-delay="0.2" (seconds), data-reveal-start="top 70%".
   Hidden states exist only while <html> has .reveals-on.motion (pre-paint script, 3 s failsafe).
   When a reveal finishes, data-reveal is swapped for data-reveal-done — no leftover overrides.
   Reduced motion / "stop animations" → everything is shown as is, nothing is split.
   ========================================================================== */
import { gsap, ScrollTrigger, SplitText, T, EASE } from '../core/gsap';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { qsa } from './util';

type Kind = 'lines' | 'letters' | 'words' | 'fade' | 'leaf';
interface Rec { el: HTMLElement; kind: Kind; split?: SplitText; anims: gsap.core.Animation[]; done?: boolean }

const root = document.documentElement;
const recs = new Map<HTMLElement, Rec>();
let enabled = false;
let ready: Promise<unknown> = Promise.resolve();
let lastEnter = 0;
let cascade = 0;

export function initReveal(hold?: Promise<unknown>) {
  if (hold) ready = hold;
  // the head failsafe already showed everything (JS arrived after 3 s): never hide content again
  const late = root.classList.contains('chrome-off');
  enabled = env.motionAllowed() && !late;
  if (!enabled) root.classList.remove('reveals-on');
  else {
    root.classList.add('reveals-on');
    // after the page's own modules ran (pins exist → correct trigger positions)
    ready.then(() => requestAnimationFrame(() => scanReveal(document)));
  }
  bus.on<{ allowed: boolean }>('motion:change', ({ allowed }) => {
    if (!allowed && enabled) { enabled = false; disableAll(); root.classList.remove('reveals-on'); }
    else if (allowed && !enabled) {
      enabled = true;
      // only elements that are still below the fold get a reveal again
      qsa<HTMLElement>('[data-reveal]').forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) finish(el, null); });
      root.classList.add('reveals-on');
      scanReveal(document);
    }
  });
  window.addEventListener('load', () => { ScrollTrigger.sort(); }, { once: true });
}

export function scanReveal(scope: ParentNode = document) {
  if (!enabled) return;
  const list = qsa<HTMLElement>('[data-reveal]', scope);
  if (scope instanceof HTMLElement && scope.matches('[data-reveal]')) list.unshift(scope);
  for (const el of list) {
    if (recs.has(el)) continue;
    const kind = el.dataset.reveal as Kind;
    const rec: Rec = { el, kind, anims: [] };
    recs.set(el, rec);
    try {
      if (kind === 'lines' || kind === 'letters') splitRise(rec, kind === 'letters');
      else if (kind === 'words') readWords(rec);
      else if (kind === 'leaf') leaf(rec);
      else fade(rec);
    } catch (e) {
      finish(el, rec);
      if (import.meta.env.DEV) console.warn('[reveal]', e);
    }
  }
}

/* small automatic cascade when several elements enter together (grids, card rows) */
function enterDelay(el: HTMLElement) {
  const own = parseFloat(el.dataset.revealDelay || '') || 0;
  const now = performance.now();
  cascade = now - lastEnter < 120 ? Math.min(cascade + 0.08, 0.4) : 0;
  lastEnter = now;
  return own + cascade;
}
const startOf = (el: HTMLElement, def: string) => el.dataset.revealStart || def;

function finish(el: HTMLElement, rec: Rec | null) {
  const kind = el.dataset.reveal;
  if (kind) { el.dataset.revealDone = kind; el.removeAttribute('data-reveal'); }
  el.style.removeProperty('visibility');
  if (rec) rec.done = true;
}

/* ---------------------------------------------------------------- lines / letters */
function splitRise(rec: Rec, letters: boolean) {
  const el = rec.el;
  const nested = el.children.length > 0;
  rec.split = SplitText.create(el, {
    type: letters ? 'lines,words,chars' : 'lines',
    mask: 'lines',
    linesClass: 'rv-line',
    wordsClass: 'rv-word',
    charsClass: 'rv-char',
    autoSplit: true,
    // headings without nested markup get a clean label; otherwise the split stays readable as is
    aria: letters && !nested ? 'auto' : 'none',
    onSplit(self: SplitText) {
      el.style.visibility = 'visible';
      if (rec.done) return;
      const targets = letters ? self.chars : self.lines;
      const each = letters ? T.letterStep : T.lineStep;
      const amount = Math.min(each * (targets.length - 1), letters ? 0.9 : 0.6);
      const tween = gsap.from(targets, {
        yPercent: letters ? 118 : 112,
        rotate: letters ? 7 : 0,
        opacity: letters ? 0 : 1,
        transformOrigin: '50% 100%',
        // Touch screens: a plain 2D translate. GSAP's default adds translate3d(0,0,0) while a tween runs, which
        // gives every rising line its own layer — and the next line's mask overlaps it (the masks overlap by
        // their 0.12em padding), so Blink lifted everything painted after it into one tall overlap layer
        // (358×1457 on the /business phone) for the length of the reveal. A line repaints instead (a few px of
        // text per frame); at 2–3× pixel density the motion looks the same.
        force3D: env.isTouch ? false : 'auto',
        duration: T.appear,
        ease: EASE.appear,
        stagger: { amount: Math.max(0, amount) },
        paused: true,
        // landed: nothing left on the lines / letters (GSAP leaves an identity transform, its origin and
        // opacity inline) — no transform, no layer, nothing for the compositor to keep track of
        onComplete: () => { gsap.set(targets, { clearProps: 'transform,transformOrigin,opacity' }); finish(el, rec); },
      });
      const st = ScrollTrigger.create({
        trigger: el, start: startOf(el, 'top 88%'), once: true,
        onEnter: () => { tween.delay(enterDelay(el)); tween.play(); },
      });
      rec.anims.push(tween);
      tween.eventCallback('onInterrupt', () => st.kill());
      return tween;
    },
  } as any);
}

/* ---------------------------------------------------------------- words (scrubbed reading) */
function readWords(rec: Rec) {
  const el = rec.el;
  rec.split = SplitText.create(el, { type: 'words', wordsClass: 'rv-w', aria: 'none' } as any);
  el.style.setProperty('opacity', '1');
  const words = rec.split.words;
  const start = startOf(el, 'top 82%');
  // words turn pale only once the paragraph enters the viewport — text nobody can see yet keeps
  // its full colour (so contrast checks and find-in-page never meet a page of faded text)
  const tween = gsap.fromTo(words, { opacity: 0.2 }, {
    opacity: 1, ease: 'none', stagger: 0.1, immediateRender: false,
    scrollTrigger: { trigger: el, start, end: 'bottom 52%', scrub: 0.6 },
  });
  const pale = ScrollTrigger.create({
    trigger: el, start: 'top bottom', endTrigger: el, end: start,
    onToggle: (self) => { if (self.isActive && !tween.progress()) gsap.set(words, { opacity: 0.2 }); },
  });
  rec.anims.push(tween, pale as unknown as gsap.core.Animation);
}

/* ---------------------------------------------------------------- fade */
function fade(rec: Rec) {
  const el = rec.el;
  const tween = gsap.fromTo(el, { opacity: 0, y: 28 }, {
    opacity: 1, y: 0, duration: T.appear, ease: EASE.appear, paused: true,
    onComplete: () => { gsap.set(el, { clearProps: 'opacity,transform' }); finish(el, rec); },
  });
  rec.anims.push(tween);
  rec.anims.push(ScrollTrigger.create({
    trigger: el, start: startOf(el, 'top 90%'), once: true,
    onEnter: () => { tween.delay(enterDelay(el)); tween.play(); },
  }) as unknown as gsap.core.Animation);
}

/* ---------------------------------------------------------------- leaf (images) */
function radii(el: HTMLElement): string {
  const cs = getComputedStyle(el);
  const w = el.offsetWidth || 1;
  const v = (s: string) => { const n = parseFloat(s) || 0; return s.trim().endsWith('%') ? (n / 100) * w : n; };
  return [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((r) => `${v(r.split(' ')[0])}px`).join(' ');
}
function leaf(rec: Rec) {
  const el = rec.el;
  const media = el.matches('img,video,canvas,picture') ? el : el.querySelector<HTMLElement>('img,video,canvas');
  const r = parseFloat(getComputedStyle(root).getPropertyValue('--leaf-r')) || 120;
  const from = `inset(30% 22% 30% 22% round ${r}px 0px ${r}px 0px)`;
  const to = `inset(0% 0% 0% 0% round ${radii(el)})`;
  const tl = gsap.timeline({
    paused: true,
    onComplete: () => { el.style.removeProperty('clip-path'); if (media) gsap.set(media, { clearProps: 'scale' }); finish(el, rec); },
  });
  tl.fromTo(el, { clipPath: from }, { clipPath: to, duration: T.image, ease: EASE.image }, 0);
  if (media) tl.fromTo(media, { scale: 1.2 }, { scale: 1, duration: T.image, ease: EASE.image }, 0);
  rec.anims.push(tl);
  rec.anims.push(ScrollTrigger.create({
    trigger: el, start: startOf(el, 'top 85%'), once: true,
    onEnter: () => { tl.delay(enterDelay(el)); tl.play(); },
  }) as unknown as gsap.core.Animation);
}

/* ---------------------------------------------------------------- off switch */
function disableAll() {
  recs.forEach((rec) => {
    rec.anims.forEach((a) => { try { (a as any).kill?.(); } catch { /* */ } });
    try { rec.split?.revert(); } catch { /* */ }
    const el = rec.el;
    gsap.set(el, { clearProps: 'opacity,transform,clipPath,visibility' });
    el.querySelectorAll<HTMLElement>('img,video,canvas').forEach((m) => gsap.set(m, { clearProps: 'scale' }));
    if (el.dataset.reveal) finish(el, rec);
  });
  recs.clear();
  // anything never scanned is simply shown
  qsa<HTMLElement>('[data-reveal]').forEach((el) => finish(el, null));
}
