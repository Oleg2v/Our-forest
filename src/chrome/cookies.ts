/* Cookie consent — calm, never blocking, remembered (of:consent). Links to /legal/privacy.
   The choice is announced on bus 'consent:change' {analytics:boolean} and pushed to dataLayer. */
import { bus } from '../core/bus';
import { storage } from '../core/storage';
import { sound } from '../core/sound';
import { qs } from './util';
import type { PageName } from './index';

type Choice = 'all' | 'necessary';

export function initCookies(page: PageName, hold: Promise<unknown>) {
  const el = qs('[data-cookie]');
  if (!el) return;
  const saved = storage.get<{ v: Choice; t: number } | null>('consent', null);
  if (saved?.v) { announce(saved.v); return; }
  const show = () => {
    el.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => el.setAttribute('data-shown', '')));
  };
  const decide = (v: Choice) => {
    storage.set('consent', { v, t: Date.now() });
    announce(v);
    sound.play('click');
    const hadFocus = el.contains(document.activeElement);
    el.removeAttribute('data-shown');
    setTimeout(() => { el.hidden = true; }, 600);
    if (hadFocus) document.getElementById('main')?.focus({ preventScroll: true });
  };
  el.querySelector('[data-cookie-accept]')?.addEventListener('click', () => decide('all'));
  el.querySelector('[data-cookie-decline]')?.addEventListener('click', () => decide('necessary'));
  // after the first impression (the home preloader + hero letters), never on top of it
  hold.then(() => setTimeout(show, page === 'home' ? 2600 : 1400));
}

function announce(v: Choice) {
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event: 'consent_update', analytics_storage: v === 'all' ? 'granted' : 'denied', ad_storage: v === 'all' ? 'granted' : 'denied' });
  bus.emit('consent:change', { analytics: v === 'all' });
}
