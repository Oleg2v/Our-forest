/* FAQ accordion on native <details> (works without JS, find-in-page opens it).
   With motion: the answer opens with a height tween and its words rise; closing folds it away.
   Reduced motion: native instant toggle. */
import { gsap } from '../core/gsap';
import { env } from '../core/env';
import { sound } from '../core/sound';
import { qsa } from '../static/util';

export function initFaq() {
  qsa<HTMLDetailsElement>('.biz-faq__item').forEach((d) => {
    const summary = d.querySelector<HTMLElement>('summary');
    const body = d.querySelector<HTMLElement>('.biz-faq__a');
    const inner = d.querySelector<HTMLElement>('.biz-faq__a-in');
    if (!summary || !body || !inner) return;
    let anim: gsap.core.Timeline | null = null;

    summary.addEventListener('click', (e) => {
      sound.play('click', { volume: 0.6 });
      if (!env.motionAllowed()) return;
      e.preventDefault();
      anim?.kill();
      const opening = !d.open || d.classList.contains('is-closing');
      if (opening) {
        d.classList.remove('is-closing');
        const from = d.open ? body.offsetHeight : 0;
        d.open = true;
        const to = inner.offsetHeight;
        anim = gsap.timeline({ onComplete: () => { gsap.set(body, { clearProps: 'height' }); anim = null; } })
          .fromTo(body, { height: from }, { height: to, duration: 0.7, ease: 'expo.out' }, 0)
          .fromTo(inner.children, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06, clearProps: 'opacity,transform' }, 0.05);
      } else {
        d.classList.add('is-closing');
        anim = gsap.timeline({
          onComplete: () => { d.open = false; d.classList.remove('is-closing'); gsap.set(body, { clearProps: 'height' }); anim = null; },
        }).fromTo(body, { height: body.offsetHeight }, { height: 0, duration: 0.5, ease: 'power3.inOut' });
      }
    });
  });
}
