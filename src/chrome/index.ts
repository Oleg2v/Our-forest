/* ==========================================================================
   Global chrome — CONTRACT (owned by the chrome agent).
   initChrome() wires every site-wide system from data-attributes, so pages
   and sections only declare markup:
     data-reveal="lines" | "letters" | "words" (read: pale→full on scroll) | "fade" | "leaf" (image clip reveal 1.2→1)
     data-bg="cream|sand|soil|moss|season"   section background for the page bg system
     data-magnetic                           magnetic pull (≈30px) on desktop
     data-cursor="שתלו|גלו|גררו"             custom cursor label; data-cursor-fill="fruit" fills the ring
     data-cursor-icon="<svg …>"              (optional) icon inside the ring (map trees)
     data-transition                          internal links get the leaf page transition (all same-origin <a> by default)
     data-sound-hover                         soft wooden click on hover (buttons/links get it by default)
   STUB until the chrome agent implements it.
   ========================================================================== */
export type PageName = 'home' | 'plant' | 'tree' | 'business' | 'legal' | 'notfound' | 'credits';

export function initChrome(_opts: { page: PageName }): void {}

/** Re-scan a subtree for data-reveal / data-magnetic / data-cursor after dynamic DOM changes. */
export function refreshChrome(_root: ParentNode = document): void {}

/** Navigate with the leaf transition (used by JS-driven navigation, e.g. after "payment"). */
export function navigate(href: string, _origin?: { x: number; y: number }): void { window.location.href = href; }
