/* 404 — a lonely leaf. A small physics-ish model of a falling leaf:
   it swings like a pendulum (falls fastest at the bottom of each swing, almost hovers at the ends),
   tumbles in 3D, and a soft wind carries it right → left (RTL). The cursor pushes the air around it
   (repulsion + the cursor's own velocity as a gust); a click / tap is a puff. When it reaches the
   ground it settles, rocks, and after a while a gust lifts it again; if it leaves the screen it
   comes back from the top after a breath. Reduced motion: it simply rests on the ground. */
import './notfound.css';
import { env } from '../core/env';
import { bus } from '../core/bus';
import { sound } from '../core/sound';
import { seasonOf } from '../core/format';
import { qs } from './util';

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function initNotFound() {
  const stage = qs<HTMLElement>('[data-nf]');
  const leaf = qs<HTMLElement>('[data-nf-leaf]');
  const turn = qs<HTMLElement>('[data-nf-turn]');
  const ground = qs<SVGSVGElement>('.nf__ground');
  if (!stage || !leaf || !turn) return;
  document.documentElement.dataset.season = seasonOf();

  let W = 0, H = 0, lw = 0, lh = 0, groundY = 0;
  let x = 0, y = 0, vx = 0, vy = 0, ang = 0, av = 0, phase = 0, t = 0;
  let mode: 'fly' | 'rest' | 'wait' = 'wait';
  let modeT = 0;
  let raf = 0, last = 0, visible = true, running = false;
  // pointer (stage coordinates) and its smoothed velocity
  let px = -9999, py = -9999, pvx = 0, pvy = 0, pointerOn = false, lastMove = 0;
  let hinted = false;

  function measure() {
    const r = stage!.getBoundingClientRect();
    W = r.width; H = r.height;
    lw = leaf!.offsetWidth; lh = leaf!.offsetHeight;
    const g = ground?.getBoundingClientRect();
    // the soil edge sits at ~52% of the ground drawing
    groundY = g ? g.top - r.top + g.height * 0.52 : H - 60;
  }

  function place() {
    leaf!.style.transform = `translate3d(${(x - lw / 2).toFixed(1)}px, ${(y - lh / 2).toFixed(1)}px, 0) rotate(${ang.toFixed(2)}deg)`;
  }
  function tumble(ry: number, rx: number) {
    turn!.style.transform = `rotateY(${ry.toFixed(1)}deg) rotateX(${rx.toFixed(1)}deg)`;
  }

  function restPose() {
    measure();
    x = W * (env.isMobile() ? 0.74 : 0.2);
    y = groundY - lw * 0.32;
    ang = -74;
    place();
    tumble(0, 0);
  }

  function spawn(first = false) {
    x = W * (first ? 0.78 : 0.6 + Math.random() * 0.35);
    y = first ? H * 0.06 : -lh;
    vx = -12; vy = 24; av = 0;
    ang = -20 + Math.random() * 40;
    phase = Math.random() * TAU;
    mode = 'fly'; modeT = 0;
  }

  function pointerForce(dt: number, s: number) {
    if (!pointerOn) return;
    const dx = x - px, dy = y - py;
    const d = Math.hypot(dx, dy) || 1;
    const R = env.isMobile() ? 150 : 200;
    if (d > R) return;
    const f = (1 - d / R) ** 2;
    const speed = Math.hypot(pvx, pvy);
    vx += ((dx / d) * 1150 * f + pvx * 3.1 * f) * dt * s;
    vy += ((dy / d) * 1150 * f + pvy * 3.1 * f) * dt * s;
    av += ((pvx * dy - pvy * dx) / (d + 20)) * 1.6 * f * dt * 60 * s;
    if (mode === 'rest' && f > 0.15 && speed > 140) lift(0.6 + f);
  }

  function lift(k = 1) {
    mode = 'fly'; modeT = 0;
    vy = -(170 + 160 * k);
    vx = -(90 + 110 * k) * (Math.random() > 0.2 ? 1 : -1);
    av = (Math.random() > 0.5 ? 1 : -1) * (180 + 120 * k);
    phase = 0;
    sound.play('rustle', { volume: 0.45 });
  }

  function step(dt: number) {
    t += dt; modeT += dt;
    pvx *= Math.exp(-dt * 7); pvy *= Math.exp(-dt * 7);
    if (performance.now() - lastMove > 1400 && env.isTouch) pointerOn = false;
    const wind = -24 + 15 * Math.sin(t * 0.31) + 8 * Math.sin(t * 0.97 + 1.3);

    if (mode === 'wait') {
      if (modeT > 1.2) spawn();
      return;
    }

    if (mode === 'fly') {
      phase += dt * (TAU / 3.4);
      const c = Math.cos(phase), s = Math.sin(phase);
      const tvx = wind + 66 * c;
      const tvy = 44 * (0.26 + 1.05 * c * c);
      const k = 1 - Math.exp(-dt * 1.7);
      vx += (tvx - vx) * k;
      vy += (tvy - vy) * k;
      pointerForce(dt, 1);
      const sp = Math.hypot(vx, vy);
      if (sp > 1100) { vx *= 1100 / sp; vy *= 1100 / sp; }
      x += vx * dt; y += vy * dt;
      const target = s * 34 + clamp(vx, -320, 320) * 0.07;
      av += ((target - ang) * 9 - av * 3.4) * dt;
      ang += av * dt;
      tumble(s * 50, Math.cos(phase * 0.5) * 16);
      // landing
      if (y >= groundY - lw * 0.32 && vy > 0) {
        y = groundY - lw * 0.32;
        mode = 'rest'; modeT = 0; vy = 0; vx *= 0.25; av *= 0.2;
        sound.play('paper', { volume: 0.3 });
      }
      // gone off screen → come back from the top after a breath
      if (x < -lh * 1.5 || x > W + lh * 2 || y < -H * 0.9) { mode = 'wait'; modeT = 0; }
    } else {
      // resting: lie down, rock a little, then a gust lifts it again
      const lie = ang >= 0 ? 76 : -76;
      av += ((lie - ang) * 14 - av * 5) * dt;
      ang += av * dt;
      vx *= Math.exp(-dt * 3.5);
      x += vx * dt;
      tumble(Math.sin(modeT * 2.2) * 8 * Math.exp(-modeT), 0);
      pointerForce(dt, 0.25);
      if (modeT > 3.6) lift(0.7);
    }
    place();
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    step(dt);
    if (!hinted && t > 2.6 && !env.isTouch) { hinted = true; stage!.setAttribute('data-hint', ''); }
  }

  function startLoop() {
    if (running || !visible || document.hidden) return;
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stopLoop() { running = false; cancelAnimationFrame(raf); }

  function enable() {
    measure();
    stage!.setAttribute('data-live', '');
    spawn(true);
    place();
    startLoop();
  }
  function disable() {
    stopLoop();
    stage!.removeAttribute('data-live');
    stage!.removeAttribute('data-hint');
    restPose();
  }

  /* pointer: the air moves with the cursor / finger */
  const toLocal = (e: PointerEvent) => { const r = stage.getBoundingClientRect(); return { lx: e.clientX - r.left, ly: e.clientY - r.top }; };
  stage.addEventListener('pointermove', (e) => {
    const { lx, ly } = toLocal(e);
    const now = performance.now();
    const dt = Math.max(8, now - lastMove) / 1000;
    if (pointerOn && dt < 0.2) {
      pvx = pvx * 0.6 + ((lx - px) / dt) * 0.4;
      pvy = pvy * 0.6 + ((ly - py) / dt) * 0.4;
    }
    px = lx; py = ly; lastMove = now; pointerOn = true;
    if (hinted) stage.removeAttribute('data-hint');
  }, { passive: true });
  stage.addEventListener('pointerleave', () => { pointerOn = false; });
  stage.addEventListener('pointerdown', (e) => {
    if (!running || (e.target as Element).closest('a,button')) return;
    const { lx, ly } = toLocal(e);
    px = lx; py = ly; lastMove = performance.now(); pointerOn = true;
    const dx = x - lx, dy = y - ly, d = Math.hypot(dx, dy) || 1;
    const f = 1 / (1 + d / 220);
    if (mode === 'rest') lift(f * 1.4);
    else if (mode === 'fly') {
      vx += (dx / d) * 560 * f;
      vy += ((dy / d) * 560 - 160) * f;
      av += (dx > 0 ? 1 : -1) * 260 * f;
      sound.play('rustle', { volume: 0.35 + f * 0.3 });
    }
    stage.removeAttribute('data-hint');
  });

  // pause when hidden / off screen
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopLoop(); else if (env.motionAllowed()) startLoop(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (!visible) stopLoop(); else if (env.motionAllowed() && stage.hasAttribute('data-live')) startLoop();
    }).observe(stage);
  }
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (env.isTouch && window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    measure();
    if (!env.motionAllowed()) restPose();
  }, { passive: true });
  bus.on<{ allowed: boolean }>('motion:change', ({ allowed }) => (allowed ? enable() : disable()));

  if (env.motionAllowed()) enable(); else restPose();
  // fonts settle → the ground may move
  document.fonts?.ready.then(() => { measure(); if (!env.motionAllowed()) restPose(); });
}
