/* Tiny typed event bus for cross-module signals (sound, cursor, theme, a11y). */
type Handler<T = any> = (payload: T) => void;
const map = new Map<string, Set<Handler>>();
export const bus = {
  on<T = any>(ev: string, fn: Handler<T>) { (map.get(ev) ?? map.set(ev, new Set()).get(ev)!).add(fn); return () => bus.off(ev, fn); },
  off(ev: string, fn: Handler) { map.get(ev)?.delete(fn); },
  emit<T = any>(ev: string, payload?: T) { map.get(ev)?.forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } }); },
};
/* Known events (payload) — emitter → listeners:
   'motion:change'   {allowed:boolean}          env.setUserMotionOff / system reduced motion → everyone animating
   'sound:change'    {on:boolean}               core/sound → header/menu sound toggles
   'menu:open' / 'menu:close'                   chrome/menu → header (stays visible), phone bar (hides)
   'modal:open' / 'modal:close'  {id?:string}   any sheet/dialog (a11y panel, /plant sheets, tree sheets) → phone bar hides;
                                                scroll is locked by lockScroll() from core/scroll
   'page:leave'      {href:string}              chrome/transition: the leaf cover starts → pages may pause loops
   'page:restore'                               chrome/transition: back/forward cache restore → close menus, resume
   'theme:section'   {bg:string, dark:boolean|null}  chrome/bg: page background changed (season → dark:null)
   'consent:change'  {analytics:boolean}        chrome/cookies: the visitor chose (also pushed to dataLayer)
   'a11y:change'                                chrome/a11y: text size / contrast / motion changed → re-measure
   'cursor:drag'     {on:boolean}               chrome/cursor: pressing on a [data-cursor="גררו"] element
   'tree:watered'    {streak:number}            tree/ui/water: the visitor watered the tree
   listened by the chrome:
   'preloader:done'                             home preloader finished → first-screen reveals + cookie card
   'header:force'    {visible:boolean}          keep the header visible (ref-counted: send true, later false)
   'cursor:set'      {label?, fill?, icon?}|null  override the custom cursor ring (null = back to automatic)
*/
