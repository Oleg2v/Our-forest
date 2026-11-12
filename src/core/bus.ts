/* Tiny typed event bus for cross-module signals (sound, cursor, theme, a11y). */
type Handler<T = any> = (payload: T) => void;
const map = new Map<string, Set<Handler>>();
export const bus = {
  on<T = any>(ev: string, fn: Handler<T>) { (map.get(ev) ?? map.set(ev, new Set()).get(ev)!).add(fn); return () => bus.off(ev, fn); },
  off(ev: string, fn: Handler) { map.get(ev)?.delete(fn); },
  emit<T = any>(ev: string, payload?: T) { map.get(ev)?.forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } }); },
};
/* Known events:
   'motion:change'   {allowed:boolean}        — reduced motion / a11y "stop animations" toggled
   'sound:change'    {on:boolean}
   'menu:open' / 'menu:close'
   'modal:open' / 'modal:close'                 — sheets/dialogs: scroll is locked by scroll.lock()
   'page:leave'      {href:string}
   'theme:section'   {bg:string, dark:boolean}  — section background changed
*/
