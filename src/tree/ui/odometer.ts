/* Rolling counter: every digit on its own drum (7.5 "השקיות הקהילה" +1). */
const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });

export class Odometer {
  readonly el: HTMLElement;
  private value = 0;
  private sr: HTMLElement;
  private face: HTMLElement;
  constructor(initial: number, cls = '') {
    this.el = document.createElement('span');
    this.el.className = `odo ${cls}`.trim();
    this.face = document.createElement('bdi');
    this.face.className = 'odo__face';
    this.face.setAttribute('aria-hidden', 'true');
    this.face.dir = 'ltr';
    this.sr = document.createElement('span');
    this.sr.className = 'visually-hidden';
    this.el.append(this.face, this.sr);
    this.set(initial, false);
  }
  get(): number { return this.value; }
  /** roll to n; each changed drum turns, carries ripple from the right-most digit */
  set(n: number, animate = true) {
    const prev = nf.format(this.value);
    const next = nf.format(n);
    this.value = n;
    this.sr.textContent = next;
    if (!animate || prev.length !== next.length || !this.face.childElementCount) {
      this.face.innerHTML = [...next].map((ch) => this.cell(ch, prev)).join('');
      if (!animate) return;
    }
    const cells = [...this.face.children] as HTMLElement[];
    const chars = [...next];
    let order = 0;
    for (let i = chars.length - 1; i >= 0; i--) {
      const c = cells[i];
      if (!c || !c.classList.contains('odo__d')) continue;
      const d = Number(chars[i]);
      const cur = Number(c.dataset.d);
      if (cur === d) continue;
      const strip = c.firstElementChild as HTMLElement;
      strip.style.transitionDelay = `${order * 0.09}s`;
      // a full turn past 9 → 0 reads as a drum: go to 10 (a second "0") then snap back
      const target = d === 0 && cur === 9 ? 10 : d;
      strip.style.transform = `translateY(${(-target * 100) / 11}%)`;
      if (target === 10) {
        const onEnd = () => {
          strip.removeEventListener('transitionend', onEnd);
          strip.style.transition = 'none';
          strip.style.transform = 'translateY(0%)';
          void strip.offsetHeight;
          strip.style.transition = '';
        };
        strip.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 1600);
      }
      c.dataset.d = String(d);
      order++;
    }
  }
  private cell(ch: string, _prev: string) {
    if (!/\d/.test(ch)) return `<span class="odo__sep">${ch}</span>`;
    const d = Number(ch);
    const digits = Array.from({ length: 11 }, (_, i) => `<span>${i % 10}</span>`).join('');
    return `<span class="odo__d" data-d="${d}"><span class="odo__strip" style="transform:translateY(${(-d * 100) / 11}%)">${digits}</span></span>`;
  }
}
