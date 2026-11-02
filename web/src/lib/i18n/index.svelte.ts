import { convert, currencyOfRegion, fractionDigits, type Currency, type Money, type Rates } from '../domain/money';
import { dateOf, type Day } from '../domain/occasions';
import { isLocale, type Locale } from '../domain/types';
import { cs } from './cs';
import { en, ERROR_CODES, type Dict, type ErrorCode } from './en';

const DICTS: Record<Locale, Dict> = { cs, en };
const KEY = 'bauble-locale';

/** The last language used on this device, else the browser's. An account's choice overrides it. */
function deviceLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
  } catch { /* storage blocked */ }
  return (navigator.languages ?? [navigator.language]).some(l => l.toLowerCase().startsWith('cs')) ? 'cs' : 'en';
}

const initial = deviceLocale();
document.documentElement.lang = initial;
let locale = $state<Locale>(initial);
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

export const langName = (l: Locale) => DICTS[l].langName;

const fmt = (o: Intl.DateTimeFormatOptions) => (d: Day) => new Intl.DateTimeFormat(locale, o).format(dateOf(d));
export const shortDate = (d: Day) => fmt(DICTS[locale].shortDate)(d);
export const longDate = (d: Day) => fmt({ day: 'numeric', month: 'long' })(d);
export const fullDate = (d: Day) => fmt({ day: 'numeric', month: 'long', year: 'numeric' })(d);
export const monthShort = (d: Day) => fmt({ month: 'short' })(d);
export const dayMonth = (d: Date) => new Intl.DateTimeFormat(locale, DICTS[locale].shortDate).format(d);

/** Month names as they read after a day number ("24. prosince", "December"). */
export function monthNames(): string[] {
  const f = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  return Array.from({ length: 12 }, (_, i) => f.formatToParts(new Date(2024, i, 1)).find(p => p.type === 'month')?.value ?? String(i + 1));
}

const moneyText = (m: Money, whole = Number.isInteger(m.amount)) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency, ...(whole && { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }).format(m.amount);

/** A price in the reader's currency, with the original beside it when it was converted. */
export function priceText(m: Money, to: Currency, rates: Rates): { text: string; original: string | null } {
  const v = convert(m, to, rates);
  if (v === null || m.currency === to) return { text: moneyText(m), original: null };
  return { text: '≈ ' + moneyText({ amount: v, currency: to }, v >= 100), original: moneyText(m) };
}

/** The amount as the price field shows it: "38,95" in Czech, "38.95" in English. */
export const amountText = (m: Money) =>
  new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: fractionDigits(m.currency) }).format(m.amount);

export const currencySymbol = (c: Currency) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: c }).formatToParts(0).find(p => p.type === 'currency')?.value ?? c;
export const currencyName = (c: Currency) => new Intl.DisplayNames(locale, { type: 'currency' }).of(c) ?? c;

/** A first guess from the browser's country: cs gives CZ and CZK, en-GB gives GBP, de gives nothing and EUR. */
export function browserCurrency(known: readonly Currency[]): Currency {
  const region = new Intl.Locale(navigator.language).maximize().region;
  return (region && currencyOfRegion(region, known)) || ('EUR' as Currency);
}

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
