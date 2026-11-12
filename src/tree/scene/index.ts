/* STUB implementation of the TreeScene contract — replaced by the tree-scene agent.
   Renders a plain placeholder so the UI can be developed in parallel. */
import type { TreeScene, TreeSceneState, Hotspot } from '../scene-api';

export function createTreeScene(initial: TreeSceneState): TreeScene {
  let state = { ...initial };
  let el: HTMLElement | null = null;
  const listeners = new Map<string, Set<(x: any) => void>>();
  const on = (ev: string, cb: (x: any) => void) => {
    (listeners.get(ev) ?? listeners.set(ev, new Set()).get(ev)!).add(cb);
    return () => listeners.get(ev)?.delete(cb);
  };
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  return {
    kind: 'svg',
    async mount(container) {
      el = document.createElement('div');
      el.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;font:500 18px var(--font-body);color:var(--bark)';
      el.textContent = `[tree scene stub · ${state.species} · ${state.ageDays}d]`;
      container.appendChild(el);
    },
    setState(p) { state = { ...state, ...p }; if (el) el.textContent = `[tree scene stub · ${state.species} · ${Math.round(state.ageDays)}d]`; },
    getState: () => state,
    async playBirth(o) { for (const p of ['soil', 'crack', 'sprout', 'reveal', 'done'] as const) { o?.onPhase?.(p); await wait(300); } },
    skipBirth() {},
    async playVisitIntro() {},
    waterStart() {}, waterProgress() {}, async waterEnd() {},
    shake() {}, async focus() {}, rotateBy() {},
    getHotspots: (): Hotspot[] => [],
    on: on as TreeScene['on'],
    async snapshot(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
    setPaused() {}, dispose() { el?.remove(); },
  };
}
