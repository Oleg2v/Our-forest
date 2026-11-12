/* Shared page boot: styles, env classes, GSAP, smooth scroll, chrome, footer. */
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../styles/base.css';
import { env, syncEnvClasses } from './env';
import { ScrollTrigger } from './gsap';
import { initScroll, whenScrollQuiet } from './scroll';
import { initChrome, type PageName } from '../chrome';
import { initFooter } from '../components/footer';

export function bootPage(page: PageName) {
  const html = document.documentElement;
  html.classList.add('js');
  html.dataset.page = page;
  syncEnvClasses();
  initScroll();
  initChrome({ page });
  initFooter();
  // re-measure pinned sections once webfonts and lazy images settle.
  // Touch screens: a refresh re-measures every trigger (≈ 170 ms at 4× CPU on the home page) — never mid-swipe.
  // ScrollTrigger refreshes on 'load' by itself and already waits for the end of a running scroll there;
  // the extra forced refresh below is for desktop only (on phones it doubled the work and ignored the swipe).
  document.fonts?.ready.then(() => (env.isTouch ? whenScrollQuiet(() => ScrollTrigger.refresh()) : ScrollTrigger.refresh()));
  if (!env.isTouch) window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}
