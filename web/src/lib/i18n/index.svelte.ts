import { dateOf, type Day } from '../domain/occasions';
import { cs } from './cs';
import { en, ERROR_CODES, type Dict, type ErrorCode } from './en';

export type Locale = 'cs' | 'en';
export const LOCALES: readonly Locale[] = ['cs', 'en'];
const DICTS: Record<Locale, Dict> = { cs, en };
const KEY = 'bauble-locale';

function initial(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'cs' || saved === 'en') return saved;
  } catch { /* storage blocked */ }
  return (navigator.languages ?? [navigator.language]).some(l => l.toLowerCase().startsWith('cs')) ? 'cs' : 'en';
}

let locale = $state<Locale>(initial());
const listeners = new Set<(l: Locale) => void>();

export const i18n = {
  get locale() { return locale; },
  get t(): Dict { return DICTS[locale]; },
  set(l: Locale) {
    if (l === locale) return;
    locale = l;
    try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
    document.documentElement.lang = l;
    listeners.forEach(f => f(l));
  },
  onChange(f: (l: Locale) => void) { listeners.add(f); return () => listeners.delete(f); },
};
document.documentElement.lang = locale;

const fmt = (o: Intl.DateTimeFormatOptions) => (d: Day) => new Intl.DateTimeFormat(locale, o).format(dateOf(d));
// Czech reads "14. 3."; English numeric dates are ambiguous (3/14 or 14/3), so spell the month.
const shortMonth = (): Intl.DateTimeFormatOptions['month'] => (locale === 'cs' ? 'numeric' : 'short');
export const shortDate = (d: Day) => fmt({ day: 'numeric', month: shortMonth() })(d);
export const longDate = (d: Day) => fmt({ day: 'numeric', month: 'long' })(d);
export const fullDate = (d: Day) => fmt({ day: 'numeric', month: 'long', year: 'numeric' })(d);
export const monthShort = (d: Day) => fmt({ month: 'short' })(d);
export const dayMonth = (d: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: shortMonth() }).format(d);

/** Month names as they read after a day number ("24. prosince", "December"). */
export function monthNames(): string[] {
  const f = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  return Array.from({ length: 12 }, (_, i) => f.formatToParts(new Date(2024, i, 1)).find(p => p.type === 'month')?.value ?? String(i + 1));
}

export const price = (n: number) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n);

/** An error from the server or the network, in words the person can read. */
export type Failure = { status: number; code: ErrorCode | null };
const isCode = (c: unknown): c is ErrorCode => typeof c === 'string' && (ERROR_CODES as readonly string[]).includes(c);

export function failureOf(err: unknown): Failure {
  const e = err as { status?: unknown; response?: { code?: unknown }; data?: { code?: unknown } } | null;
  const status = typeof e?.status === 'number' ? e.status : -1;
  const code = e?.response?.code ?? e?.data?.code;
  return { status, code: isCode(code) ? code : null };
}

export function errorText(err: unknown): string {
  const f = failureOf(err), t = DICTS[locale].error;
  if (f.code) return t[f.code];
  return f.status === 0 ? t.offline : t.generic;
}
