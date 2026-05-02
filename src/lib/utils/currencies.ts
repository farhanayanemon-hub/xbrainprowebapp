export type CurrencyCode = "BDT" | "USD" | "EUR" | "INR" | "GBP" | "AED" | "PKR";

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  label: string;
  flag: string;
  rateFromUsd: number;
  decimals: number;
  locale: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  BDT: { code: "BDT", symbol: "৳", label: "Bangladeshi Taka", flag: "🇧🇩", rateFromUsd: 110, decimals: 0, locale: "en-BD" },
  USD: { code: "USD", symbol: "$", label: "US Dollar",        flag: "🇺🇸", rateFromUsd: 1, decimals: 2, locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", label: "Euro",              flag: "🇪🇺", rateFromUsd: 0.92, decimals: 2, locale: "de-DE" },
  GBP: { code: "GBP", symbol: "£", label: "British Pound",     flag: "🇬🇧", rateFromUsd: 0.79, decimals: 2, locale: "en-GB" },
  INR: { code: "INR", symbol: "₹", label: "Indian Rupee",      flag: "🇮🇳", rateFromUsd: 84,   decimals: 0, locale: "en-IN" },
  AED: { code: "AED", symbol: "د.إ",label: "UAE Dirham",       flag: "🇦🇪", rateFromUsd: 3.67, decimals: 2, locale: "en-AE" },
  PKR: { code: "PKR", symbol: "₨", label: "Pakistani Rupee",   flag: "🇵🇰", rateFromUsd: 278,  decimals: 0, locale: "en-PK" },
};

export const DEFAULT_CURRENCY: CurrencyCode = "BDT";

export type CurrencyRates = Partial<Record<CurrencyCode, number>>;

export function isCurrencyCode(v: string | null | undefined): v is CurrencyCode {
  return !!v && v in CURRENCIES;
}

/**
 * Build the effective rate map by overlaying admin-saved rate overrides on the static defaults.
 * USD is always 1.
 */
export function getEffectiveRates(overrides?: CurrencyRates | null): Record<CurrencyCode, number> {
  const out = {} as Record<CurrencyCode, number>;
  for (const code of Object.keys(CURRENCIES) as CurrencyCode[]) {
    const override = overrides?.[code];
    out[code] =
      code === "USD"
        ? 1
        : typeof override === "number" && override > 0
          ? override
          : CURRENCIES[code].rateFromUsd;
  }
  return out;
}

/**
 * Convert a base USD amount (in cents) into the selected currency.
 * For BDT, prefer the explicit `priceAmountBdt` (paisa) when available — more accurate than FX conversion.
 */
export function convertFromUsdCents(
  usdCents: number,
  target: CurrencyCode,
  bdtPaisa?: number | null,
  rates?: Record<CurrencyCode, number> | CurrencyRates | null
): number {
  if (target === "BDT" && bdtPaisa != null && bdtPaisa > 0) {
    return bdtPaisa / 100;
  }
  const usd = usdCents / 100;
  const rate = rates?.[target] ?? CURRENCIES[target].rateFromUsd;
  return usd * rate;
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const meta = CURRENCIES[currency];
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: meta.decimals,
  };
  return meta.symbol + new Intl.NumberFormat(meta.locale, opts).format(amount);
}

/** Format with currency symbol; rounds to whole numbers for currencies with decimals=0 */
export function formatPriceInCurrency(
  usdCents: number,
  currency: CurrencyCode,
  bdtPaisa?: number | null,
  rates?: Record<CurrencyCode, number> | CurrencyRates | null
): string {
  const value = convertFromUsdCents(usdCents, currency, bdtPaisa, rates);
  return formatCurrency(value, currency);
}
