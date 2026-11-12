/* Focusable DOM proxies over the scene's hotspots (7.6 / 7.15).
   Tab order: plaque, fruits, greeting leaves (+ trunk, the roots). Arrows rotate the island,
   Enter on the stage waters. Every gesture has a normal button. */
import type { Hotspot } from '../scene-api';
import { sound } from '../../core/sound';
import type { Ctx } from './ctx';
import type { Dock } from './dock';

const ORDER: Record<string, number> = { plaque: 0, qr: 1, fruit: 2, greeting: 3, trunk: 4, leaf: 5, ground: 6 };

export class Proxies {
  private host: HTMLElement;
  private list: Hotspot[] = [];
  private sig = '';

  constructor(private ctx: Ctx, private dock: Dock) {
    this.host = ctx.stage.querySelector<HTMLElement>('[data-hotspots]')!;
    this.host.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        // RTL: the right arrow turns toward the reading start
        ctx.scene.rotateBy(e.key === 'ArrowRight' ? 9 : -9);
      }
    });
  }

  update(list: Hotspot[]) {
    this.list = list;
    const vis = list.filter((h) => h.visible && h.kind !== 'leaf').sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9));
    const sig = vis.map((h) => h.id).join('|');
    const active = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.hs : undefined;
    if (sig !== this.sig) {
      this.sig = sig;
      this.host.textContent = '';
      for (const h of vis) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `tree-hs__b tree-hs__b--${h.kind}`;
        b.dataset.hs = h.id;
        b.setAttribute('aria-label', h.kind === 'ground' ? `${h.label} (לחיצה ארוכה)` : h.label);
        b.addEventListener('click', (e) => this.activate(h.id, (e as MouseEvent).detail === 0));
        this.host.appendChild(b);
      }
      if (active) (this.host.querySelector(`[data-hs="${CSS.escape(active)}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
    }
    for (const h of vis) {
      const b = this.host.querySelector<HTMLElement>(`[data-hs="${CSS.escape(h.id)}"]`);
      if (b) b.style.transform = `translate(${h.x}px, ${h.y}px)`;
    }
  }

  /** the same answer as a tap on the scene */
  activate(id: string, viaKeyboard: boolean) {
    const h = this.list.find((x) => x.id === id);
    if (!h) return;
    sound.unlock();
    if (h.kind === 'trunk') { this.ctx.scene.shake(); this.ctx.announce('העץ מתנער, וכמה עלים נושרים'); return; }
    if (h.kind === 'leaf') { if (this.ctx.scene.poke) this.ctx.scene.poke(h.id); else sound.play('rustle', { volume: 0.4 }); return; }
    // the same motion as a tap: the fruit swings, the greeting leaf pulses, the roots glow
    if (h.kind === 'fruit' || h.kind === 'greeting' || h.kind === 'ground') this.ctx.scene.poke?.(h.id);
    this.dock.fromHotspot(h, viaKeyboard);
  }
}
