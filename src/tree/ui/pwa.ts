/* PWA (12): the tree page installs to the home screen and keeps working offline.
   · manifest: /manifest.webmanifest (scope /tree/), icons in /icons/
   · service worker /sw.js — registered only in production builds (never breaks dev)
   · "מוסיפים למסך הבית": beforeinstallprompt where available, instructions on iOS/others
   Push notifications ("ניטע", "פרח", "הפירות בשלו", "יום קטיף") are for the live version. */
import { env } from '../../core/env';
import { icon } from './icons';
import { openSheet } from './sheet';

interface BIPEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const reg = () => navigator.serviceWorker.register('/sw.js', { scope: '/tree/' }).catch(() => { /* offline support is a bonus */ });
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg, { once: true });
  }
}

export function onInstallChange(fn: () => void) { listeners.add(fn); }
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export async function addToHomeScreen(): Promise<void> {
  if (isStandalone()) {
    openSheet({ title: 'העץ כבר על מסך הבית', html: '<p class="tpwa__p">פותחים אותו מהאייקון, כמו כל אפליקציה.</p>' });
    return;
  }
  if (deferred) {
    try { await deferred.prompt(); await deferred.userChoice; } catch { /* ignore */ }
    deferred = null;
    return;
  }
  const ios = env.isIOS;
  openSheet({
    title: 'מוסיפים את העץ למסך הבית',
    eyebrow: 'שתי נגיעות, וזהו',
    cls: 'tsheet--pwa',
    html: ios
      ? `<ol class="tpwa" role="list">
          <li>${icon('share')}<span>בספארי, נוגעים בכפתור השיתוף שבתחתית המסך</span></li>
          <li>${icon('homescreen')}<span>בוחרים „הוספה למסך הבית”</span></li>
          <li>${icon('leaf')}<span>העץ מופיע ליד האפליקציות, ונפתח ישר אליו</span></li>
        </ol>`
      : `<ol class="tpwa" role="list">
          <li>${icon('sliders')}<span>פותחים את תפריט הדפדפן (שלוש הנקודות)</span></li>
          <li>${icon('homescreen')}<span>בוחרים „התקנת האפליקציה” או „הוספה למסך הבית”</span></li>
          <li>${icon('leaf')}<span>העץ מופיע ליד האפליקציות, ונפתח ישר אליו</span></li>
        </ol>`,
  });
}
