/* ==========================================================================
   Home section 8 — "צרו קשר" (contact). Markup: partials/home/contact.html
   A demo form: real validation with Hebrew messages, nothing leaves the browser.
   · errors: aria-invalid + aria-describedby, focus moves to the first problem, a polite live status
   · phone: Israeli mobile / landline (+972 allowed), formatted 050-1234567 on blur
   · send → track('generate_lead', {form:'contact', interest})
   ONE motion idea (after sending): a seed falls into the ground, settles, and sprouts —
   the form fades, the seed drops with gravity, the soil answers, the stem and leaves draw
   themselves. Reduced motion → the sprout is simply there.
   · desktop (the form beside the title): the panel keeps the form's height and the thank-you sits
     centred in it, so nothing below moves seconds after the click (no layout shift)
   · one column (tablet / phone): the panel eases to the shorter thank-you and, if its top went off
     screen, the page brings it back (the footer is below the fold there, nothing visible jumps)
   ========================================================================== */
import './contact.css';
import { gsap } from '../../core/gsap';
import { env } from '../../core/env';
import { sound } from '../../core/sound';
import { track } from '../../core/analytics';
import { scrollTo } from '../../core/scroll';
import { he } from '../../content/he';

const MSG = {
  name: 'נא לכתוב שם מלא',
  phone: 'נא לכתוב מספר טלפון ישראלי, למשל 050-1234567',
  email: 'נא לבדוק את כתובת האימייל, למשל name@example.co.il',
  consent: 'כדי לשלוח צריך לאשר את מדיניות הפרטיות',
} as const;
type Key = keyof typeof MSG;
const KEYS = Object.keys(MSG) as Key[];

const heGet = (path: string): unknown => path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), he);

/** digits only, +972 / 972 → 0 */
function phoneDigits(v: string): string {
  let d = v.replace(/[\s\-–־().]/g, '');
  if (d.startsWith('+972')) d = '0' + d.slice(4);
  else if (d.startsWith('972')) d = '0' + d.slice(3);
  return d;
}
/** Israeli phone: mobile 05X / 07X (10 digits) or landline 02/03/04/08/09 (9 digits) */
function validPhone(v: string): boolean {
  const d = phoneDigits(v);
  return /^0(5\d|7\d)\d{7}$/.test(d) || /^0[23489]\d{7}$/.test(d);
}
/** 0501234567 → 050-1234567, 031234567 → 03-1234567 */
function formatPhone(v: string): string {
  const d = phoneDigits(v);
  if (/^0(5\d|7\d)\d{7}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (/^0[23489]\d{7}$/.test(d)) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return v;
}
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function initContact(): void {
  const root = document.getElementById('contact');
  if (!root) return;
  root.querySelectorAll<HTMLElement>('[data-he]').forEach((el) => {
    const v = heGet(el.dataset.he!);
    if (typeof v === 'string' && el.textContent !== v) el.textContent = v;
  });

  const form = root.querySelector<HTMLFormElement>('[data-contact-form]');
  const done = root.querySelector<HTMLElement>('[data-contact-done]');
  const panel = root.querySelector<HTMLElement>('[data-contact-panel]');
  const status = root.querySelector<HTMLElement>('[data-contact-status]');
  if (!form || !done || !panel) return;
  form.noValidate = true;

  // interest options from he.ts (the HTML carries the same list for no-JS)
  const select = form.querySelector<HTMLSelectElement>('[data-contact-interest]');
  if (select) {
    const opts = he.contact.interest.options;
    Array.from(select.options).slice(1).forEach((o, i) => { if (opts[i] && o.textContent !== opts[i]) o.textContent = opts[i]; });
    const paint = () => select.classList.toggle('is-empty', !select.value);
    select.addEventListener('change', paint);
    paint();
  }

  let tried = false;
  const field = (k: Key) => form.elements.namedItem(k) as HTMLInputElement | null;
  const errEl = (k: Key) => root.querySelector<HTMLElement>(`#cf-${k}-err`);

  function check(k: Key): boolean {
    const f = field(k);
    if (!f) return true;
    const v = f.value.trim();
    const ok = k === 'consent' ? f.checked
      : k === 'phone' ? validPhone(v)
      : k === 'email' ? (v === '' || validEmail(v))
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

  KEYS.forEach((k) => {
    const f = field(k);
    if (!f) return;
    if (k === 'consent') f.addEventListener('change', () => { if (tried) check(k); });
    else {
      f.addEventListener('blur', () => {
        if (k === 'phone' && validPhone(f.value)) f.value = formatPhone(f.value);
        if (tried || f.value.trim()) check(k);
      });
      f.addEventListener('input', () => { if (f.getAttribute('aria-invalid') === 'true') check(k); });
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    tried = true;
    const bad = KEYS.filter((k) => !check(k));
    if (bad.length) {
      if (status) status.textContent = bad.length === 1 ? `יש שדה אחד לתיקון: ${MSG[bad[0]]}` : `יש ${bad.length} שדות לתיקון`;
      field(bad[0])?.focus();
      sound.play('click', { volume: 0.5, rate: 0.8 });
      return;
    }
    send();
  });

  function send() {
    const btn = form!.querySelector<HTMLButtonElement>('.contact__send');
    btn?.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'שולחים…';
    const data = new FormData(form!);
    const interest = String(data.get('interest') || '');
    const first = String(data.get('name') || '').trim().split(/\s+/)[0] || '';
    window.setTimeout(() => {
      btn?.removeAttribute('aria-busy');
      // demo: nothing is sent anywhere — the lead event only
      track('generate_lead', { form: 'contact', interest: interest || 'none' });
      const nameEl = done!.querySelector<HTMLElement>('[data-contact-name]');
      if (nameEl) nameEl.textContent = first ? `, ${first}` : '';
      showDone();
      if (status) status.textContent = `הפנייה נשלחה. תודה${first ? `, ${first}` : ''}!`;
    }, env.motionAllowed() ? 650 : 120);
  }

  const art = (sel: string) => Array.from(done.querySelectorAll<SVGGraphicsElement>(`[data-art="${sel}"]`));
  const grid = root.querySelector<HTMLElement>('.contact__grid');

  /** the form sits beside the title (two columns): its height is the row's height */
  const sideBySide = () => !!grid && getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length > 1;
  /** keep the panel at the form's height while the thank-you shows (centred by .contact__panel--held) */
  function hold(h: number) {
    panel!.style.minHeight = `${h}px`;
    panel!.classList.add('contact__panel--held');
  }
  function release() {
    panel!.style.minHeight = '';
    panel!.classList.remove('contact__panel--held');
  }
  // the layout became one column while the thank-you shows: the held height is no longer needed
  window.addEventListener('resize', () => { if (panel!.classList.contains('contact__panel--held') && !sideBySide()) release(); }, { passive: true });

  /** the thank-you (and its sprout) is shorter than the form: if the panel's top is now off screen
      (a phone, after scrolling down to the button), bring it back below the header */
  function revealDone() {
    const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    const top = panel!.getBoundingClientRect().top;
    if (top < hh + 8 || top > window.innerHeight * 0.55) scrollTo(panel!, { offset: -(hh + 20) });
  }
  let tl: gsap.core.Timeline | null = null;

  function showDone() {
    tl?.kill();
    const motion = env.motionAllowed();
    const parts = Array.from(form!.children) as HTMLElement[];
    const seed = art('seed')[0];
    const ground = art('ground');
    const specks = art('specks').flatMap((g) => Array.from(g.children)) as SVGGraphicsElement[];
    const mound = art('mound');
    const stem = art('stem');
    const leaves = art('leaf');
    const bud = art('bud');
    const texts = Array.from(done!.querySelectorAll<HTMLElement>('.contact__done-title, .contact__done-text, .contact__done-demo, .contact__done-actions'));

    const h0 = panel!.offsetHeight;
    const keep = sideBySide();
    if (!motion) {
      if (keep) hold(h0);
      form!.hidden = true;
      done!.hidden = false;
      gsap.set(seed, { opacity: 0 });
      done!.focus({ preventScroll: true });
      revealDone();
      sound.play('chime');
      return;
    }

    tl = gsap.timeline();
    tl.to(parts, { opacity: 0, y: -10, duration: 0.42, ease: 'power2.in', stagger: 0.03 })
      .add(() => {
        form!.hidden = true;
        done!.hidden = false;
        gsap.set(parts, { clearProps: 'opacity,transform' });
        if (keep) hold(h0);
        else {
          const h1 = panel!.offsetHeight;
          gsap.fromTo(panel, { height: h0 }, { height: h1, duration: 0.9, ease: 'expo.out', clearProps: 'height' });
        }
        done!.focus({ preventScroll: true });
        revealDone();
      })
      .set(texts, { opacity: 0, y: 18 })
      .set([...stem, ...leaves, ...bud, ...mound], { drawSVG: '0%' })
      // leaves are filled shapes: hidden until their outline draws (no pale blobs before the stem)
      .set(leaves, { transformOrigin: '0% 100%', scale: 0.6, opacity: 0 })
      .set(specks, { opacity: 0, transformOrigin: '50% 50%' })
      // the seed waits invisible inside the panel (not above it)
      .set(seed, { x: 160, y: -6, rotation: -30, opacity: 0 })
      .fromTo(ground, { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: 0.9, ease: 'power3.inOut' }, '<')
      // the seed appears and falls (gravity), turning a little in the air
      .to(seed, { opacity: 1, duration: 0.18, ease: 'none' }, '-=0.35')
      .to(seed, { y: 141, rotation: 110, duration: 0.66, ease: 'power2.in' }, '<')
      .add(() => { sound.play('crack', { volume: 0.7 }); sound.haptic(10); })
      // lands: a small hop, the soil answers
      .to(seed, { y: 134, rotation: 140, duration: 0.18, ease: 'power2.out' })
      .to(specks, { opacity: 1, y: (i: number) => (i % 2 ? -3 : -5), duration: 0.35, ease: 'power2.out', stagger: 0.02 }, '<')
      .to(seed, { y: 143, rotation: 160, duration: 0.22, ease: 'power2.in' })
      .to(specks, { y: 0, duration: 0.5, ease: 'power2.inOut' }, '<')
      // sinks into the ground (clipped at the surface), the soil closes over it
      .to(seed, { y: 166, duration: 0.6, ease: 'power2.inOut' }, '+=0.12')
      .to(mound, { drawSVG: '0% 100%', duration: 0.5, ease: 'power2.out' }, '-=0.3')
      // …and comes up as a sprout
      .add(() => sound.play('pop'), '+=0.05')
      .to(stem, { drawSVG: '0% 100%', duration: 0.95, ease: 'power2.out' }, '<')
      .to(leaves, { drawSVG: '0% 100%', duration: 0.8, ease: 'power2.out', stagger: 0.16 }, '-=0.55')
      .to(leaves, { opacity: 1, duration: 0.25, ease: 'none', stagger: 0.16 }, '<')
      .to(leaves, { scale: 1, duration: 1.1, ease: 'elastic.out(1, 0.6)', stagger: 0.16 }, '<')
      .to(bud, { drawSVG: '0% 100%', duration: 0.5, ease: 'power2.out' }, '-=0.6')
      .to(texts, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, '-=0.9')
      .add(() => sound.play('chime', { volume: 0.6 }), '-=0.6')
      .add(() => gsap.set([...texts, ...leaves], { clearProps: 'opacity,transform' }));
  }

  root.querySelector<HTMLButtonElement>('[data-contact-again]')?.addEventListener('click', () => {
    tl?.kill();
    tl = null;
    form.reset();
    tried = false;
    select?.classList.add('is-empty');
    KEYS.forEach((k) => { field(k)?.removeAttribute('aria-invalid'); field(k)?.removeAttribute('aria-describedby'); const er = errEl(k); if (er) { er.hidden = true; er.textContent = ''; } });
    // back to the drawn rest state (the seed keeps its transform; it is hidden again on the next send)
    const svgParts = Array.from(done.querySelectorAll<SVGGraphicsElement>('[data-art], [data-art] *'))
      .filter((n) => !n.closest('[data-art="seed"]'));
    gsap.set(svgParts, { clearProps: 'all' });
    release();
    done.hidden = true;
    form.hidden = false;
    if (status) status.textContent = '';
    field('name')?.focus();
  });
}
