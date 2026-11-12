/* Shared page context for the /tree UI modules (one per page). */
import type { TreeScene, TreeSceneState, Hotspot } from '../scene-api';
import type { Demo, PageState, TreeRecord } from '../model';
import type { TreeStore } from './store';

export interface Flags { birth: boolean; greet: boolean; qr: boolean; gift: boolean; from?: string; msg?: string }

export interface Ctx {
  main: HTMLElement;
  stage: HTMLElement;
  sceneEl: HTMLElement;
  scene: TreeScene;
  tree: TreeRecord;
  demo: Demo;
  flags: Flags;
  store: TreeStore;
  /** current page flow */
  flow: PageState;
  /** extra scene overrides (timeline scrub, sibling spot, before-planting) */
  override: Partial<TreeSceneState>;
  online: boolean;
  /** derived scene state (without pushing) */
  derive(): TreeSceneState;
  /** re-derive and push to the scene + every UI part */
  refresh(): void;
  announce(msg: string, urgent?: boolean): void;
  motion(): boolean;
  mobile(): boolean;
  hotspots(): Hotspot[];
  /** stage-local rectangle helpers */
  stageRect(): DOMRect;
  /** show/hide the regular UI around the scene (birth, envelope hide it); 'caption' = the birth's last phase, its
   *  caption over the scene (the UI stays hidden) */
  setIntro(on: boolean | 'caption'): void;
  /** run a page flow (state switch from the presenter or the URL) */
  run(flow: PageState): void;
  /** water from anywhere (keyboard Enter on the stage, birth button) */
  focusWater(): void;
  /** the demo tree was just planted (before → birth): a fresh sapling with today's date; false restores the demo tree */
  replant(today: boolean): void;
  openShare(): void;
  /** the owner's "מזמינים חברים להשקות": a ready WhatsApp text + link for the friends' greeting mini-page */
  openInvite(): void;
  openGreet(): void;
  openInstall(): void;
}

/** tiny DOM helper */
export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
