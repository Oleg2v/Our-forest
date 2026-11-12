/* Partner form (demo): name, company, phone, e-mail, employees, interest, message, consent.
   Validates in Hebrew, focuses the first problem, then shows a growing sapling and
   track('generate_lead'). Nothing is sent anywhere. Package buttons pre-select "interest". */
import { gsap } from '../core/gsap';
import { env } from '../core/env';
import { sound } from '../core/sound';
import { track } from '../core/analytics';
import { qs, qsa } from '../static/util';

const MSG = {
  name: 'נא לכתוב שם מלא',
  company: 'נא לכתוב את שם החברה או הארגון',
  phone: 'נא לכתוב מספר טלפון ישראלי, למשל 050-1234567',
  email: 'נא לכתוב כתובת אימייל תקינה',
  consent: 'כדי לשלוח צריך לאשר את מדיניות הפרטיות',
} as const;
type Key = keyof typeof MSG;

/** Israeli phone: mobile 05X / 07X (10 digits) or landline 02/03/04/08/09 (9 digits); +972 allowed */
export function validIsraeliPhone(v: string): boolean {
  let d = v.replace(/[\s\-–־().]/g, '');
  if (d.startsWith('+972')) d = '0' + d.slice(4);
  else if (d.startsWith('972')) d = '0' + d.slice(3);
  return /^0(5\d|7\d)\d{7}$/.test(d) || /^0[23489]\d{7}$/.test(d);
}
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function initForm() {
  const form = qs<HTMLFormElement>('[data-biz-form]');
  const done = qs<HTMLElement>('[data-form-done]');
  const panel = qs<HTMLElement>('[data-form-panel]');
  const status = qs<HTMLElement>('[data-form-status]');
  if (!form || !done || !panel) return;
  let tried = false;

  const field = (k: Key) => form.elements.namedItem(k) as HTMLInputElement | null;
  const errEl = (k: Key) => qs<HTMLElement>(`#bf-${k}-err`, form);

  function check(k: Key): boolean {
    const f = field(k);
    if (!f) return true;
    const v = f.value.trim();
    const ok = k === 'consent' ? f.checked
      : k === 'phone' ? validIsraeliPhone(v)
      : k === 'email' ? validEmail(v)
      : v.length >= 2;
    const err = errEl(k);
    f.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (err) {
      err.hidden = ok;
      err.textContent = ok ? '' : MSG[k];
      if (ok) f.removeAttribute('aria-describedby'); else f.setAttribute('aria-describedby', err.id);
    }
    return ok;
  }

  (Object.keys(MSG) as Key[]).forEach((k) => {
    const f = field(k);
    if (!f) return;
    const ev = k === 'consent' ? 'change' : 'blur';
    f.addEventListener(ev, () => { if (tried || f.value) check(k); });
    f.addEventListener('input', () => { if (f.getAttribute('aria-invalid') === 'true') check(k); });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    tried = true;
    const keys = Object.keys(MSG) as Key[];
    const bad = keys.filter((k) => !check(k));
    if (bad.length) {
      if (status) status.textContent = bad.length === 1 ? 'יש שדה אחד לתיקון' : `יש ${bad.length} שדות לתיקון`;
      field(bad[0])?.focus();
      sound.play('click', { volume: 0.5, rate: 0.8 });
      return;
    }
    submit();
  });

  function submit() {
    const btn = qs<HTMLButtonElement>('.biz-form__send', form!);
    btn?.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'שולחים…';
    const data = new FormData(form!);
    const interest = String(data.get('interest') || '');
    const employees = String(data.get('employees') || '');
    window.setTimeout(() => {
      btn?.removeAttribute('aria-busy');
      track('generate_lead', { form: 'business', interest: interest || 'none', employees: employees || 'unknown', currency: 'ILS' });
      sound.play('chime');
      sound.haptic([8, 40, 12]);
      showDone();
    }, env.motionAllowed() ? 900 : 200);
  }

  function showDone() {
    const h0 = panel!.offsetHeight;
    form!.hidden = true;
    done!.hidden = false;
    if (status) status.textContent = '';
    done!.focus({ preventScroll: true });
    if (!env.motionAllowed()) return;
    const h1 = panel!.offsetHeight;
    const paths = qsa<SVGPathElement>('.biz-done__art path', done!);
    gsap.timeline()
      .fromTo(panel, { height: h0 }, { height: h1, duration: 0.8, ease: 'expo.out', clearProps: 'height' }, 0)
      .fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2, ease: 'power2.out', stagger: 0.14 }, 0.1)
      .fromTo(qsa('.biz-done__title, .biz-done__text, .biz-done__demo, .biz-done__actions', done!), { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08, clearProps: 'opacity,transform' }, 0.35);
  }

  qs('[data-form-again]', done)?.addEventListener('click', () => {
    form.reset();
    tried = false;
    (Object.keys(MSG) as Key[]).forEach((k) => { field(k)?.removeAttribute('aria-invalid'); const er = errEl(k); if (er) { er.hidden = true; er.textContent = ''; } });
    done.hidden = true;
    form.hidden = false;
    field('name')?.focus();
  });

  /* package buttons → pre-select the interest chip, then the chrome scrolls to #partner */
  qsa<HTMLAnchorElement>('[data-biz-pick]').forEach((a) => {
    a.addEventListener('click', () => {
      const id = a.dataset.bizPick!;
      const input = qs<HTMLInputElement>(`input[name="interest"][value="${id}"]`, form);
      if (!input) return;
      input.checked = true;
      track('select_item', { item_list_id: 'business_packages', item_id: id });
      const chip = input.closest('.chip');
      if (chip && env.motionAllowed()) {
        chip.classList.remove('is-picked');
        window.setTimeout(() => chip.classList.add('is-picked'), 900);
      }
    });
  });
}
