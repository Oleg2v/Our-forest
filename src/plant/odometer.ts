/* Rolling price digits: every digit is a vertical 0–9 strip that rolls to its value
   (up when the price grows, down when it falls), staggered from the last digit.
   The visible digits are aria-hidden; a sibling .sr-only text carries the price. */
import { ils } from '../core/format';

export interface Odometer { set(n: number, opts?: { instant?: boolean }): void; el: HTMLElement }

export function createOdometer(host: HTMLElement, initial: number, opts: { motion: () => boolean; speed?: () => number }): Odometer {
  host.classList.add('odo');
  host.setAttribute('dir', 'ltr');
  const vis = document.createElement('span');
  vis.className = 'odo__digits';
  vis.setAttribute('aria-hidden', 'true');
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  host.append(vis, sr);
  let value = NaN;

  const build = (str: string) => {
    vis.innerHTML = '';
    for (const ch of str) {
      if (/\d/.test(ch)) {
        const col = document.createElement('span');
        col.className = 'odo__col';
        const strip = document.createElement('span');
        strip.className = 'odo__strip';
        strip.innerHTML = Array.from({ length: 10 }, (_, i) => `<span>${i}</span>`).join('');
        col.appendChild(strip);
        vis.appendChild(col);
      } else {
        const s = document.createElement('span');
        s.className = ch === '₪' ? 'odo__cur' : 'odo__sep';
        s.textContent = ch === ' ' ? ' ' : ch;
        vis.appendChild(s);
      }
    }
  };
  const apply = (str: string, instant: boolean, up: boolean) => {
    const cols = Array.from(vis.querySelectorAll<HTMLElement>('.odo__strip'));
    const digits = str.replace(/\D/g, '');
    const sp = opts.speed?.() ?? 1;
    cols.forEach((strip, i) => {
      const d = Number(digits[i] ?? 0);
      const from = cols.length - 1 - i;
      strip.style.transitionDuration = instant ? '0s' : `${(0.7 + from * 0.06) * sp}s`;
      strip.style.transitionDelay = instant ? '0s' : `${from * 0.045 * sp}s`;
      strip.dataset.dir = up ? 'up' : 'down';
      strip.style.transform = `translateY(${-d * 10}%)`;
    });
  };

  const api: Odometer = {
    el: host,
    set(n, o = {}) {
      if (n === value) return;
      const str = ils(n);
      const instant = !!o.instant || !opts.motion() || Number.isNaN(value);
      const prevStr = Number.isNaN(value) ? '' : ils(value);
      const up = n > value;
      if (prevStr.length !== str.length || Number.isNaN(value)) {
        build(str);
        // start from the previous magnitude so new columns roll in too
        if (!instant) {
          apply(prevStr.replace(/\d/g, '0').padStart(str.length, '0'), true, up);
          void vis.offsetWidth;
        }
      }
      apply(str, instant, up);
      value = n;
      sr.textContent = str;
    },
  };
  api.set(initial, { instant: true });
  return api;
}
