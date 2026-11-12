/* The watering can + the water arc (7.5): a line-art can slides in from the corner and tilts;
   water flies in an arc — 200–400 particles with gravity and small splashes — on a 2D canvas
   over the scene. The RAF loop runs only while water is in the air, and the canvas has a backing store
   (stage × DPR, ≈ 4 MB on a phone — another full-screen layer over the WebGL one) only for that time. */
import { gsap } from '../../core/gsap';

const CAN_SVG = `
<svg class="tree-can__svg" viewBox="0 0 140 100" aria-hidden="true" focusable="false">
  <g class="tree-can__g">
    <path class="tree-can__body" d="M71 40h46c2.6 0 4.4 2.2 4 4.7l-6.4 42.6c-.4 2.4-2.4 4.2-4.9 4.2H78.6c-2.5 0-4.6-1.8-4.9-4.3L67 44.8c-.4-2.6 1.5-4.8 4-4.8Z"/>
    <path class="tree-can__line" d="M69.4 52.5h49.8"/>
    <path class="tree-can__line" d="M85 40c0-16.5 26-16.5 26 0"/>
    <path class="tree-can__line" d="M120.5 50c9 1.6 11.6 15.6 3 23.5"/>
    <path class="tree-can__spout" d="M70.2 78.6 24.6 60.4c-1.3-.5-2.6.6-2.2 1.9l.2.6 45.8 22.6"/>
    <path class="tree-can__rose" d="M16.2 50.6c-3 5-2.8 13 1.4 18.2"/>
    <path class="tree-can__line" d="M16.6 50.4 25 58.2M17.8 68.7l7.4-6.2"/>
    <circle class="tree-can__tip" data-spout cx="15.6" cy="59.6" r="0.6"/>
  </g>
</svg>`;

interface Drop { x: number; y: number; vx: number; vy: number; life: number; max: number; splash: boolean; w: number }

export class WaterFx {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  readonly can: HTMLElement;
  private drops: Drop[] = [];
  private raf = 0;
  private last = 0;
  private emitting = false;
  private rate = 0;
  private acc = 0;
  private w = 1; private h = 1; private dpr = 1;
  private src = { x: 0, y: 0 };
  private dst = { x: 0, y: 0 };
  private flight = 0.5;
  private gravity = 1500;
  private tone: 'light' | 'dark' = 'light';
  private tl: gsap.core.Timeline | null = null;
  private emitted = 0;

  constructor(private stage: HTMLElement, canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.can = document.createElement('div');
    this.can.className = 'tree-can';
    this.can.setAttribute('aria-hidden', 'true');
    this.can.innerHTML = CAN_SVG;
    stage.appendChild(this.can);
    // no bitmap until water flies (a canvas without size attributes would hold a 300×150 one)
    this.release();
    // iOS fires resize while scrolling (the address bar): no layout read, no reallocation then — the stage is
    // measured when the can comes in, and the bitmap resized only while water is actually in the air
    window.addEventListener('resize', () => { if (this.raf) { this.measure(); this.alloc(); } }, { passive: true });
  }

  setTone(t: 'light' | 'dark') { this.tone = t; }

  private measure() {
    const r = this.stage.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
  }
  /** the bitmap at stage × DPR — assigning width/height reallocates and clears even with the same value, so only on a change */
  private alloc() {
    const cw = Math.round(this.w * this.dpr), ch = Math.round(this.h * this.dpr);
    if (this.canvas.width !== cw) this.canvas.width = cw;
    if (this.canvas.height !== ch) this.canvas.height = ch;
  }
  private release() {
    if (this.canvas.width) this.canvas.width = 0;
    if (this.canvas.height) this.canvas.height = 0;
  }

  /** place the can so its spout pours onto `target` (stage coords), slide in from the corner and tilt */
  enter(target: { x: number; y: number }, motion: boolean) {
    this.measure();
    this.dst = { ...target };
    const mobile = this.w < 700;
    const canW = mobile ? 118 : 150;
    // spout tip in can-local units (viewBox 140×100) at rest
    const tipU = { x: 15.6, y: 59.6 };
    const k = canW / 140;
    const dx = mobile ? Math.min(96, Math.max(76, this.w * 0.22)) : Math.min(190, Math.max(120, this.w * 0.105));
    const dy = mobile ? Math.min(120, Math.max(90, this.h * 0.125)) : Math.min(190, Math.max(120, this.h * 0.16));
    // where the tip should be while pouring (to the reading-start side = right, above the soil)
    const tipX = target.x + dx, tipY = target.y - dy;
    // the can rotates around its body centre (95,66); approximate the tip offset after the tilt
    const ang = -34 * Math.PI / 180;
    const cx = 95 * k, cy = 66 * k;
    const tx = tipU.x * k - cx, ty = tipU.y * k - cy;
    const rx = tx * Math.cos(ang) - ty * Math.sin(ang), ry = tx * Math.sin(ang) + ty * Math.cos(ang);
    const left = tipX - (cx + rx), top = tipY - (cy + ry);
    const s = this.can.style;
    s.width = `${canW}px`;
    s.left = '0px'; s.top = '0px';
    s.transformOrigin = `${cx}px ${cy}px`;
    this.src = { x: tipX, y: tipY };
    this.tl?.kill();
    const from = { x: left + 160, y: top - 150, rotation: 8, opacity: 0 };
    const to = { x: left, y: top, rotation: -34, opacity: 1 };
    if (!motion) {
      gsap.set(this.can, { ...to, opacity: 0 });
      this.tl = gsap.timeline().to(this.can, { opacity: 1, duration: 0.3 });
      return;
    }
    this.tl = gsap.timeline()
      .fromTo(this.can, from, { x: left, y: top, rotation: -6, opacity: 1, duration: 0.55, ease: 'expo.out' })
      .to(this.can, { rotation: -34, duration: 0.5, ease: 'power3.inOut' }, 0.22);
  }

  leave(motion: boolean) {
    this.tl?.kill();
    if (!motion) { this.tl = gsap.timeline().to(this.can, { opacity: 0, duration: 0.35 }); return; }
    const x = Number(gsap.getProperty(this.can, 'x')), y = Number(gsap.getProperty(this.can, 'y'));
    this.tl = gsap.timeline()
      .to(this.can, { rotation: 4, duration: 0.45, ease: 'power2.inOut' })
      .to(this.can, { x: x + 140, y: y - 120, opacity: 0, duration: 0.6, ease: 'power3.in' }, 0.3);
  }

  /** read the real spout position from the DOM (after the tilt) */
  private spout() {
    const tip = this.can.querySelector('[data-spout]');
    if (!tip) return this.src;
    const r = tip.getBoundingClientRect();
    const s = this.stage.getBoundingClientRect();
    return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
  }

  start() {
    this.alloc();
    this.emitting = true;
    this.emitted = 0;
    this.rate = 0;
    this.loop();
  }
  /** 0..1 — more water with a fuller ring */
  setRate(p: number) { this.rate = p; }
  stop() { this.emitting = false; }
  clear() { this.drops = []; this.emitting = false; this.draw(); }

  private loop() {
    if (this.raf) return;
    this.last = performance.now();
    const tick = (ts: number) => {
      this.raf = 0;
      const dt = Math.min(0.05, (ts - this.last) / 1000);
      this.last = ts;
      this.step(dt);
      this.draw();
      if (this.emitting || this.drops.length) this.raf = requestAnimationFrame(tick);
      else this.release(); // the last drop has landed (draw() just cleared it): give the bitmap back
    };
    this.raf = requestAnimationFrame(tick);
  }

  private step(dt: number) {
    if (document.hidden) return;
    const g = this.gravity;
    if (this.emitting && Number(gsap.getProperty(this.can, 'rotation')) < -20) {
      // 140 → 520 drops per second as the ring fills; ≈ 200–400 in a 1.5 s pour
      const perSec = 140 + 380 * Math.min(1, this.rate);
      this.acc += perSec * dt;
      const sp = this.spout();
      const T = this.flight;
      const tx = this.dst.x, ty = this.dst.y;
      while (this.acc >= 1 && this.drops.length < 420) {
        this.acc -= 1;
        this.emitted++;
        const jT = T * (0.86 + Math.random() * 0.28);
        const spread = (this.w < 700 ? 9 : 14) + 16 * this.rate;
        const ex = tx + (Math.random() - 0.5) * spread * 2;
        const ey = ty + (Math.random() - 0.5) * spread * 0.35;
        const vx = (ex - sp.x) / jT;
        const vy = (ey - sp.y) / jT - 0.5 * g * jT;
        this.drops.push({
          x: sp.x + (Math.random() - 0.5) * 2, y: sp.y + (Math.random() - 0.5) * 2,
          vx, vy, life: 0, max: jT, splash: false, w: 0.9 + Math.random() * 0.9,
        });
      }
    }
    const next: Drop[] = [];
    for (const d of this.drops) {
      d.life += dt;
      d.vy += g * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (!d.splash && d.life >= d.max) {
        // the soil: small splashes, then gone
        const n = Math.random() < 0.55 ? 1 + Math.floor(Math.random() * 2) : 0;
        for (let i = 0; i < n && next.length < 460; i++) {
          next.push({ x: d.x, y: d.y, vx: (Math.random() - 0.5) * 150, vy: -60 - Math.random() * 110, life: 0, max: 0.22 + Math.random() * 0.16, splash: true, w: 0.8 });
        }
        continue;
      }
      if (d.splash && d.life >= d.max) continue;
      next.push(d);
    }
    this.drops = next;
  }

  private draw() {
    const c = this.ctx;
    if (!c) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    if (!this.drops.length) return;
    const ink = this.tone === 'dark' ? '201, 207, 160' : '58, 70, 62';
    const hi = this.tone === 'dark' ? '251, 241, 230' : '251, 241, 230';
    c.lineCap = 'round';
    for (const d of this.drops) {
      const sp = Math.hypot(d.vx, d.vy);
      const len = d.splash ? 1.6 : Math.min(9, 2 + sp * 0.012);
      const ux = d.vx / (sp || 1), uy = d.vy / (sp || 1);
      const a = d.splash ? 0.55 * (1 - d.life / d.max) : 0.62;
      c.strokeStyle = `rgba(${ink}, ${a})`;
      c.lineWidth = d.w;
      c.beginPath();
      c.moveTo(d.x - ux * len, d.y - uy * len);
      c.lineTo(d.x, d.y);
      c.stroke();
      if (!d.splash && d.w > 1.5) {
        c.strokeStyle = `rgba(${hi}, 0.7)`;
        c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(d.x - ux * len * 0.6, d.y - uy * len * 0.6); c.lineTo(d.x - ux * len * 0.2, d.y - uy * len * 0.2); c.stroke();
      }
    }
  }

  get count() { return this.emitted; }
}
