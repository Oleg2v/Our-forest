/* Radiogroup with roving tabindex (WAI-ARIA radio pattern, RTL-aware arrows). */
export interface RadioGroup { set(value: string): void; destroy(): void }

export function radioGroup(group: HTMLElement, onSelect: (value: string, el: HTMLElement) => void): RadioGroup {
  group.setAttribute('role', 'radiogroup');
  const items = () => Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]')).filter((el) => !el.hasAttribute('aria-disabled'));
  const set = (value: string) => {
    const list = items();
    let any = false;
    list.forEach((el) => {
      const on = el.dataset.value === value;
      el.setAttribute('aria-checked', String(on));
      el.tabIndex = on ? 0 : -1;
      any ||= on;
    });
    if (!any && list[0]) list[0].tabIndex = 0;
  };
  const choose = (el: HTMLElement, focus = false) => {
    const v = el.dataset.value ?? '';
    set(v);
    if (focus) el.focus();
    onSelect(v, el);
  };
  const onClick = (e: Event) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[role="radio"]');
    if (el && group.contains(el) && !el.hasAttribute('aria-disabled')) choose(el);
  };
  const onKey = (e: KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const rtl = getComputedStyle(group).direction === 'rtl';
    let j = -1;
    switch (e.key) {
      case 'ArrowDown': j = i + 1; break;
      case 'ArrowUp': j = i - 1; break;
      case 'ArrowLeft': j = rtl ? i + 1 : i - 1; break;
      case 'ArrowRight': j = rtl ? i - 1 : i + 1; break;
      case 'Home': j = 0; break;
      case 'End': j = list.length - 1; break;
      case ' ': case 'Enter': e.preventDefault(); choose(list[i]); return;
      default: return;
    }
    e.preventDefault();
    j = (j + list.length) % list.length;
    choose(list[j], true);
  };
  group.addEventListener('click', onClick);
  group.addEventListener('keydown', onKey);
  return {
    set,
    destroy() { group.removeEventListener('click', onClick); group.removeEventListener('keydown', onKey); },
  };
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
