/* ==========================================================================
   Winner-level details:
   · favicon = a small leaf that changes with the Israeli season
   · tab hidden → title "העץ מחכה לכם"
   · lazy photos sharpen in from their own blurred colour preview
   · a tree drawn in characters + credits in the console
   · every WhatsApp link (a[href*="wa.me"]) → track('whatsapp_click'); [data-wa] links get the prefilled text
   · soft wooden click on hover for links/buttons/[data-sound-hover] (only while sound is on)
   ========================================================================== */
import { env } from '../core/env';
import { sound } from '../core/sound';
import { track } from '../core/analytics';
import { seasonOf, waLink } from '../core/format';
import { he } from '../content/he';
import { qsa } from './util';
import type { PageName } from './index';

export function initDetails(page: PageName) {
  favicon();
  tabTitle();
  whatsapp(page);
  hoverSounds();
  consoleTree();
}

function favicon() {
  const link = document.getElementById('of-favicon') as HTMLLinkElement | null;
  const href = `/favicons/${seasonOf()}.svg`;
  if (link && !link.href.endsWith(href)) link.href = href;
}

function tabTitle() {
  let original = document.title;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (document.title !== he.pages.tabAway) original = document.title;
      document.title = he.pages.tabAway;
    } else if (document.title === he.pages.tabAway) {
      document.title = original;
    }
  });
}

/* ---------------------------------------------------------------- WhatsApp */
const WA_TEXT = 'שלום, אשמח לשמוע עוד על היער שלנו';
export function scanWhatsApp(scope: ParentNode = document) {
  qsa<HTMLAnchorElement>('a[data-wa]', scope).forEach((a) => {
    if (a.dataset.waReady) return;
    a.dataset.waReady = '1';
    a.href = waLink(a.dataset.wa || WA_TEXT);
  });
}
function whatsapp(page: PageName) {
  scanWhatsApp();
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href*="wa.me"]') as HTMLAnchorElement | null;
    if (!a) return;
    const placement = a.dataset.track
      || (a.closest('.mbar') ? 'sticky_bar' : a.closest('.menu') ? 'menu' : a.closest('footer') ? 'footer' : a.closest('section[id]')?.id || 'page');
    track('whatsapp_click', { page, placement });
  }, true);
}

/* ---------------------------------------------------------------- hover sound */
function hoverSounds() {
  let last: Element | null = null;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || !sound.isOn()) return;
    const t = (e.target as Element | null)?.closest?.('a[href], button:not([disabled]), [data-sound-hover], [role="button"], [role="switch"], summary, .chip') ?? null;
    if (t === last) return;
    last = t;
    if (t && !t.closest('[data-sound-hover="off"]')) sound.play('hover');
  }, { passive: true });
}

/* ---------------------------------------------------------------- lazy images */
const seenImg = new WeakSet<HTMLImageElement>();
export function scanImages(scope: ParentNode = document) {
  if (!env.motionAllowed()) return;
  qsa<HTMLImageElement>('img[data-img-key][loading="lazy"]:not([data-img-pending])', scope).forEach((img) => {
    if (seenImg.has(img)) return;
    seenImg.add(img);
    if (img.complete && img.naturalWidth > 0) return;
    img.classList.add('img-sharpen');
    const clear = () => setTimeout(() => img.classList.remove('img-sharpen', 'is-loaded'), 1100);
    img.addEventListener('load', () => {
      img.decode?.().catch(() => {}).finally(() => requestAnimationFrame(() => { img.classList.add('is-loaded'); clear(); }));
    }, { once: true });
    img.addEventListener('error', () => img.classList.remove('img-sharpen'), { once: true });
  });
}

/* ---------------------------------------------------------------- console */
function consoleTree() {
  const w = window as any;
  if (w.__ofConsole) return;
  w.__ofConsole = true;
  const tree = String.raw`
                    .   *   .
              _.-~~~~~~~~~~~~~-._
          .-~~  ~~  ~  ~~~  ~~   ~~-.
        .~  ~~  ~  ~~ ~  ~~  ~~  ~  ~.
       (  ~   ~~  ~  ~~  ~  ~~  ~~  ~  )
        (  ~~  ~  ~~ \  |  / ~  ~~  ~ )
         '-._  ~~  ~  \ | /  ~~  _.-'
              '-.__    \|/   __.-'
                    '-. | .-'
                       \|/
                        |
                        |
    ~~~~~~~~~~~~~~~~~~~~|~~~~~~~~~~~~~~~~~~~~~
          .        __.-/|\-.__        .
               .  /   / | \   \  .
                 /   /  |  \   \
              ._/  _/   |   \_  \_.
                  /     |     \
                        '`;
  const olive = 'color:#8F8E45;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.25';
  const title = 'font-family:Frank Ruhl Libre,Georgia,serif;font-size:22px;color:#626630;padding:6px 0';
  const body = 'font-family:Heebo,system-ui,sans-serif;font-size:12px;color:#6B4A2E;line-height:1.7';
  try {
    console.log(`%c${tree}`, olive);
    console.log(`%c${he.brand}%c\n${he.hero.subtitle}\nיער מאכל ב${he.place} שמחבר בין אנשים, אדמה וכלבים.`, title, body);
    console.log(
      '%cCredits\n' +
      '· Design & code — a hand-made demo: Vite · TypeScript · GSAP · Lenis · Three.js\n' +
      '· Sound — synthesised live with WebAudio, no recordings (try “צלילי היער” in the header)\n' +
      '· Type — Frank Ruhl Libre & Heebo (SIL Open Font License)\n' +
      '· Photos and licences — /credits\n' +
      `· ${he.cta.plant} → /plant`,
      body,
    );
  } catch { /* consoles without styling */ }
}
