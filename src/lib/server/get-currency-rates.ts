import { adminSettingsService } from "./admin-settings.js";
import { isCurrencyCode, getEffectiveRates, type CurrencyRates, type CurrencyCode } from "$lib/utils/currencies.js";

export async function getCurrencyRatesFromSettings(): Promise<Record<CurrencyCode, number>> {
  try {
    const general = await adminSettingsService.getSettingsByCategory("general");
    const overrides: CurrencyRates = {};
    if (general?.currency_rates) {
      try {
        const parsed = JSON.parse(general.currency_rates);
        if (parsed && typeof parsed === "object") {
          for (const [k, v] of Object.entries(parsed)) {
            if (isCurrencyCode(k) && typeof v === "number" && v > 0) overrides[k] = v;
          }
        }
      } catch { /* ignore */ }
    }
    return getEffectiveRates(overrides);
  } catch {
    return getEffectiveRates({});
  }
}
