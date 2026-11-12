/* GSAP 3.13+ — all plugins are free and ship in the `gsap` package. Register once here. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { Flip } from 'gsap/Flip';
import { Observer } from 'gsap/Observer';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MorphSVGPlugin, Flip, Observer, CustomEase);

/** Timings from the brief: micro 0.25s, interface 0.5s, appearances 1.2s, page transitions 0.9s */
export const T = { micro: 0.25, ui: 0.5, appear: 1.2, page: 0.9, image: 1.4, letterStep: 0.04, lineStep: 0.08 } as const;
/** Eases: expo.out for appearances, power3.inOut for transitions, light elastic only for playful details */
export const EASE = {
  appear: 'expo.out',
  page: 'power3.inOut',
  image: 'power4.out',
  game: 'elastic.out(1, 0.55)',
  soft: 'power2.out',
} as const;

gsap.defaults({ ease: EASE.appear, duration: T.ui });
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, MorphSVGPlugin, Flip, Observer, CustomEase };
