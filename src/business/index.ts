/* /business — orchestrator. Markup: business/index.html (copy synced from src/content/he.ts). */
import './business.css';
import '../static/todo.css';
import { gsap } from '../core/gsap';
import { env } from '../core/env';
import { ilDate } from '../core/format';
import { qs, whenMotion } from '../static/util';
import { buildArt, drawArtOnView } from './art';
import { initSteps } from './steps';
import { initGallery } from './gallery';
import { initFaq } from './faq';
import { initForm } from './form';

/** Tu BiShvat 2027 (brief: 23 January 2027) — the holiday-gift card shows it until it passes */
const TU_BISHVAT = '2027-01-23';

function initHero() {
  const media = qs<HTMLElement>('[data-biz-parallax]');
  const hero = qs<HTMLElement>('.biz-hero');
  if (!media || !hero) return;
  // a slow parallax inside the leaf (desktop, motion on) — the leaf itself stays put
  whenMotion(() => {
    if (env.isTouch || env.isMobile()) return;
    gsap.fromTo(media, { yPercent: -3 }, {
      yPercent: 5, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
  });
}

function initSeason() {
  const el = qs<HTMLElement>('[data-biz-season]');
  const date = qs<HTMLElement>('[data-biz-tubishvat]');
  if (!el || !date) return;
  const tb = new Date(`${TU_BISHVAT}T23:59:59+02:00`);
  if (Date.now() > tb.getTime()) return;
  date.textContent = ilDate(TU_BISHVAT);
  el.hidden = false;
}

/** Open questions for the client (FAQ [data-todo]) show with ?notes=1 for the rest of the session
 *  (?notes=0 hides them again); the public page shows only the answers. */
function initNotes() {
  let on = false;
  try {
    const q = new URLSearchParams(location.search).get('notes');
    if (q !== null) sessionStorage.setItem('of:notes', q === '0' ? '0' : '1');
    on = sessionStorage.getItem('of:notes') === '1';
  } catch { /* storage blocked: notes stay hidden */ }
  document.documentElement.toggleAttribute('data-notes', on);
}

export function initBusiness() {
  initNotes();
  buildArt();
  drawArtOnView();
  initSeason();
  initHero();
  initSteps();
  initGallery();
  initFaq();
  initForm();
}
