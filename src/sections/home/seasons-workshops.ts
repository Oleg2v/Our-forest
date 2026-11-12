/* ==========================================================================
   Seasons — "הסדנאות הקרובות" (the upcoming workshops list under the strip).
   Rows: date (Israeli format + weekday), title, seats left, price, "שומרים מקום"
   → /plant?product=workshop&ws=<id>&date=<iso> (the same dates/seats/prices the configurator offers,
   so the link lands on exactly that session).
   Desktop (fine pointer + motion): hovering a row makes that workshop's photo float after the
   cursor — a leaf-shaped card that trails with a soft lag and leans with the cursor's speed.
   Touch / reduced motion: a small thumbnail sits in every row instead.
   ========================================================================== */
import { gsap, EASE } from '../../core/gsap';
import { env } from '../../core/env';
import { bus } from '../../core/bus';
import { he } from '../../content/he';
import { ils, ilDate } from '../../core/format';
import { pictureHtml, type ImageKey } from '../../content/images';
import { track } from '../../core/analytics';
import { WORKSHOPS, workshopDates, type WorkshopId } from '../../plant/catalog';

const PHOTO: Record<WorkshopId, ImageKey> = { carpentry: 'wsCarpentry', dogs: 'wsDogs', garden: 'wsGarden' };
const ROWS = 4;

interface Session { id: WorkshopId; title: string; date: string; seats: number; price: number }

function sessions(now = new Date()): Session[] {
  const all: Session[] = [];
  for (const w of WORKSHOPS) {
    workshopDates(w.id, now).forEach((date, k) => {
      all.push({ id: w.id, title: w.title, date, seats: w.seats[k] ?? w.seats[0], price: w.price });
    });
  }
  return all.sort((a, b) => a.date.localeCompare(b.date)).slice(0, ROWS);
}

const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const ARROW = '<svg class="icon arrow-fwd" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
const SEAT = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.5 7.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M5 20c.6-3.8 3.3-6 7-6s6.4 2.2 7 6"/></svg>';

function rowHtml(s: Session): string {
  const d = new Date(`${s.date}T12:00:00`);
  const href = `/plant?product=workshop&ws=${s.id}&date=${s.date}`;
  const few = s.seats <= 3;
  const wd = weekday.format(d);
  // four links all read "שומרים מקום": in a links list each one also says which workshop and when
  const ctx = `, ${s.title}, ${wd}, ${ilDate(s.date)}`;
  return `<li class="seasons__row" data-ws="${s.id}">
    <span class="seasons__thumb" aria-hidden="true">${pictureHtml(PHOTO[s.id], { sizes: '72px', className: 'cover' })}</span>
    <p class="seasons__when"><span class="seasons__wd">${esc(wd)}</span><bdi class="seasons__date num">${ilDate(s.date)}</bdi></p>
    <h3 class="seasons__row-title">${esc(s.title)}</h3>
    <p class="seasons__seats${few ? ' is-few' : ''}">${SEAT}<span>${esc(he.workshops.seatsLeft(s.seats))}</span></p>
    <p class="seasons__row-price"><bdi class="price">${ils(s.price)}</bdi> <span class="seasons__unit">${esc(he.pricing.perParticipant)}</span></p>
    <a class="btn btn--outline btn--sm seasons__reserve" href="${href}" data-ws-id="${s.id}" data-date="${s.date}" data-price="${s.price}"><span>${esc(he.workshops.reserve)}</span><span class="sr-only">${esc(ctx)}</span>${ARROW}</a>
  </li>`;
}

export function initWorkshops(host: HTMLElement): void {
  const list = host.querySelector<HTMLOListElement>('.seasons__rows');
  if (!list) return;
  let rows: Session[] = [];
  try { rows = sessions(); } catch { /* keep the static fallback rows */ }
  if (rows.length) list.innerHTML = rows.map(rowHtml).join('');
  list.querySelectorAll<HTMLElement>('.seasons__row').forEach((li) => li.setAttribute('data-reveal', 'fade'));

  list.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('.seasons__reserve');
    if (!a) return;
    track('select_item', { item_list_id: 'home_workshops', item_id: a.dataset.wsId, date: a.dataset.date, price: Number(a.dataset.price) || undefined, currency: 'ILS' });
  });

  /* ---------- floating photo (desktop) ---------- */
  const float = document.createElement('div');
  float.className = 'seasons__float';
  float.setAttribute('aria-hidden', 'true');
  float.innerHTML = (Object.keys(PHOTO) as WorkshopId[])
    .map((id) => `<span class="seasons__float-img" data-ws="${id}">${pictureHtml(PHOTO[id], { sizes: '320px', className: 'cover' })}</span>`).join('');
  const frames = new Map<string, HTMLElement>();
  float.querySelectorAll<HTMLElement>('.seasons__float-img').forEach((el) => frames.set(el.dataset.ws!, el));

  let on = false;
  let current = '';
  let qx: gsap.QuickToFunc | null = null, qy: gsap.QuickToFunc | null = null, qr: gsap.QuickToFunc | null = null;
  let lastX = 0, lastT = 0, inside = false;
  let px = -1, py = -1, scrollRaf = 0;

  const canFloat = () => !env.isTouch && env.motionAllowed() && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const show = (id: string) => {
    if (id === current) return;
    const wasHidden = !current;
    const prev = frames.get(current);
    const next = frames.get(id);
    current = id;
    if (prev) gsap.to(prev, { opacity: 0, scale: 1.04, duration: 0.45, ease: EASE.soft, overwrite: true });
    if (next) {
      gsap.fromTo(next, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.7, ease: EASE.appear, overwrite: true });
    }
    if (wasHidden) {
      gsap.to(float, { autoAlpha: 1, duration: 0.35, ease: EASE.soft, overwrite: 'auto' });
      gsap.fromTo(float, { '--open': 0 }, { '--open': 1, duration: 0.9, ease: EASE.appear });
    }
  };
  const hide = () => {
    current = '';
    inside = false;
    gsap.to(float, { autoAlpha: 0, duration: 0.4, ease: EASE.soft, overwrite: 'auto' });
  };

  const onMove = (e: PointerEvent) => {
    if (!on || e.pointerType !== 'mouse') return;
    // the photo is position:fixed (viewport coords) — it never adds scrollable overflow
    const x = e.clientX, y = e.clientY;
    px = x; py = y;
    if (!inside) {
      inside = true;
      gsap.set(float, { x, y });
      lastX = e.clientX; lastT = performance.now();
    }
    qx!(x); qy!(y);
    const now = performance.now();
    const v = (e.clientX - lastX) / Math.max(8, now - lastT); // px per ms
    lastX = e.clientX; lastT = now;
    qr!(gsap.utils.clamp(-7, 7, v * 9));
    const row = (e.target as Element).closest<HTMLElement>('.seasons__row');
    if (row?.dataset.ws) show(row.dataset.ws); else if (current) hide();
  };
  const onLeave = () => { if (on) { hide(); qr?.(0); } };
  // wheel-scrolling under a still cursor: follow the row that is now under it
  const onScroll = () => {
    if (!on || !current || scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const el = document.elementFromPoint(px, py);
      const row = el?.closest<HTMLElement>('.seasons__row');
      if (!el || !list.contains(el)) onLeave();
      else if (row?.dataset.ws) show(row.dataset.ws);
    });
  };

  const enable = () => {
    if (on || !canFloat()) return;
    on = true;
    host.classList.remove('seasons--thumbs');
    host.appendChild(float);
    gsap.set(float, { autoAlpha: 0, xPercent: -50, yPercent: -100, x: 0, y: 0, rotation: 0 });
    qx = gsap.quickTo(float, 'x', { duration: 0.75, ease: 'power3.out' });
    qy = gsap.quickTo(float, 'y', { duration: 0.75, ease: 'power3.out' });
    qr = gsap.quickTo(float, 'rotation', { duration: 0.9, ease: 'power3.out' });
    list.addEventListener('pointermove', onMove, { passive: true });
    list.addEventListener('pointerleave', onLeave, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
  };
  const disable = () => {
    host.classList.add('seasons--thumbs');
    if (!on) return;
    on = false;
    list.removeEventListener('pointermove', onMove);
    list.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('scroll', onScroll);
    gsap.killTweensOf(float);
    float.remove();
    current = '';
  };

  if (canFloat()) enable(); else disable();
  bus.on<{ allowed: boolean }>('motion:change', () => (canFloat() ? enable() : disable()));
}
