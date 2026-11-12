/* The line-art dog (style of the forest's line icons) — CONTRACT (owned by the home "roots" agent).
   Lives in the "עבודה עם כלבים" node: follows the cursor along the bottom of the section,
   sits and wags on click, and runs across the footer once.
   Not on phones and not with reduced motion (return a no-op handle).
   STUB until implemented. */
export interface DogHandle { destroy(): void; runAcross(): Promise<void> }
export function mountDog(_host: HTMLElement, _opts: { mode: 'follow' | 'runAcross' } = { mode: 'follow' }): DogHandle {
  return { destroy() {}, async runAcross() {} };
}
