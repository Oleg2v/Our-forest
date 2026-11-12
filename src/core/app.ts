/* Shared page boot: styles, env classes, GSAP, smooth scroll, chrome, footer. */
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../styles/base.css';
import { syncEnvClasses } from './env';
import { ScrollTrigger } from './gsap';
import { initScroll } from './scroll';
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
  // re-measure pinned sections once webfonts and lazy images settle
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}
