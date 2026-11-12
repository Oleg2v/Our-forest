/* Israeli formats: prices "180 ₪" with NBSP, dates d.m.yyyy, Israel local time. */
import { NBSP, ILS } from '../content/he';

const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });

/** "1,080 ₪" — number + NBSP + shekel sign. Wrap in <bdi> when mixing with Hebrew. */
export function ils(n: number): string { return `${nf.format(n)}${NBSP}${ILS}`; }
/** "החל מ־180 ₪" */
export function fromIls(n: number): string { return `החל מ־${ils(n)}`; }
/** HTML-safe version wrapped in <bdi class="price"> */
export function priceHtml(n: number, opts: { from?: boolean; suffix?: string } = {}): string {
  const p = `<bdi class="price">${ils(n)}</bdi>`;
  return `${opts.from ? 'החל מ־' : ''}${p}${opts.suffix ? ` ${opts.suffix}` : ''}`;
}

/** 14.2.2026 */
export function ilDate(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')) : d;
  return `${x.getDate()}.${x.getMonth() + 1}.${x.getFullYear()}`;
}

/** Current date/time parts in Israel (Asia/Jerusalem), regardless of the visitor's TZ. */
export function israelNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const hour = get('hour') % 24;
  return { year: get('year'), month: get('month'), day: get('day'), hour, minute: get('minute'), hours: hour + get('minute') / 60 };
}

export type DayPeriod = 'morning' | 'noon' | 'evening' | 'night';
/** morning 05–11, noon 11–17, evening 17–21, night 21–05 (Israel time) */
export function dayPeriod(hours = israelNow().hours): DayPeriod {
  if (hours >= 5 && hours < 11) return 'morning';
  if (hours >= 11 && hours < 17) return 'noon';
  if (hours >= 17 && hours < 21) return 'evening';
  return 'night';
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** Israeli seasons, roughly: winter Dec–Feb, spring Mar–May, summer Jun–Sep, autumn Oct–Nov */
export function seasonOf(month = israelNow().month): Season {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 9) return 'summer';
  return 'autumn';
}

/** Whole days between two dates */
export function daysBetween(a: Date | string, b: Date | string = new Date()): number {
  const t = (d: Date | string) => (typeof d === 'string' ? new Date(d + 'T12:00:00') : d).getTime();
  return Math.floor((t(b) - t(a)) / 86400000);
}

/** Phone → WhatsApp deep link (demo number) */
export const WHATSAPP_NUMBER = '972500000000'; // placeholder — the forest's real number goes here
export function waLink(text: string, phone = WHATSAPP_NUMBER): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
