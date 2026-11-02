import type { Brand } from './types';

/** An ISO 4217 code, like CZK. */
export type Currency = Brand<string, 'currency'>;
export type Money = { amount: number; currency: Currency };
/** Units of each currency for one unit of a common base. */
export type Rates = Readonly<Partial<Record<Currency, number>>>;

export const isCurrency = (s: unknown): s is Currency => typeof s === 'string' && /^[A-Z]{3}$/.test(s);

/** `m` in `to`, or null when a rate is missing. */
export function convert(m: Money, to: Currency, rates: Rates): number | null {
  if (m.currency === to) return m.amount;
  const from = rates[m.currency], into = rates[to];
  return from && into ? (m.amount / from) * into : null;
}

/** Decimal places the currency uses: 2 for CZK, 0 for JPY. */
export const fractionDigits = (c: Currency) =>
  new Intl.NumberFormat('en', { style: 'currency', currency: c }).resolvedOptions().maximumFractionDigits ?? 2;

/**
 * A price as a person types it: "38.95", "38,95", "1 299 Kč", "1.299" or "1,299.50".
 * Separators that split off groups of exactly three digits group thousands; any other is the decimal point.
 */
export function parseAmount(raw: string, currency: Currency): number | null {
  let s = raw.replace(/[^\d.,]/g, '');
  const dot = s.lastIndexOf('.'), comma = s.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) s = dot > comma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  else if (/^[1-9]\d{0,2}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  if (!s || !Number.isFinite(n) || n <= 0) return null;
  const k = 10 ** fractionDigits(currency);
  return Math.round(n * k) / k;
}

/** Most currency codes start with their country code: CZ has CZK, US has USD, GB has GBP. */
export const currencyOfRegion = (region: string, known: readonly Currency[]) =>
  known.find(c => c.startsWith(region.toUpperCase())) ?? null;
