/* Home: preloader "טבעות שנים" — STUB (owned by the hero agent).
   Resolves when the hero should start its entrance (ring window opened, or skipped). */
export function initPreloader(): Promise<void> { document.querySelector('.preloader')?.remove(); return Promise.resolve(); }
