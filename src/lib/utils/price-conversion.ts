import {
  CURRENCIES,
  type CurrencyCode,
  type CurrencyRates,
  getEffectiveRates,
  isCurrencyCode,
} from "./currencies.js";

/**
 * Convert a whole-unit amount (e.g. 1100 BDT, 9.99 USD) entered by the admin
 * in `currency` into USD cents for storage.
 */
export function wholeUnitsToUsdCents(
  amount: number,
  currency: CurrencyCode,
  rates?: Record<CurrencyCode, number> | CurrencyRates | null,
): number {
  if (!isFinite(amount) || amount < 0) return 0;
  const effective = rates && Object.keys(rates).length > 0 ? rates : getEffectiveRates({});
  const rate = (effective as Record<CurrencyCode, number>)[currency] ?? CURRENCIES[currency].rateFromUsd;
  if (!rate || rate <= 0) return 0;
  const usd = currency === "USD" ? amount : amount / rate;
  return Math.round(usd * 100);
}

/**
 * Convert USD cents back to whole units in `currency` for display in admin forms.
 */
export function usdCentsToWholeUnits(
  usdCents: number,
  currency: CurrencyCode,
  rates?: Record<CurrencyCode, number> | CurrencyRates | null,
): number {
  if (!isFinite(usdCents) || usdCents < 0) return 0;
  const effective = rates && Object.keys(rates).length > 0 ? rates : getEffectiveRates({});
  const rate = (effective as Record<CurrencyCode, number>)[currency] ?? CURRENCIES[currency].rateFromUsd;
  const usd = usdCents / 100;
  const out = currency === "USD" ? usd : usd * rate;
  // Round to currency's decimals
  const dec = CURRENCIES[currency].decimals;
  return Math.round(out * Math.pow(10, dec)) / Math.pow(10, dec);
}
