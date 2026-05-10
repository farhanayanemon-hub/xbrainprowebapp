import type { Actions, PageServerLoad } from './$types'
import { db, creditPlans } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'
import { fail, redirect, error } from '@sveltejs/kit'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'
import { wholeUnitsToUsdCents } from '$lib/utils/price-conversion.js'
import { getCurrencyRatesFromSettings } from '$lib/server/get-currency-rates.js'
import { isCurrencyCode, type CurrencyCode } from '$lib/utils/currencies.js'

const ALLOWED_CREDIT_TYPES = ['text', 'image', 'video', 'audio'] as const
type CreditTypeValue = typeof ALLOWED_CREDIT_TYPES[number]

function parseCreditTypes(data: FormData): CreditTypeValue[] {
  const raw = data.getAll('creditTypes').map((v) => v.toString())
  const filtered = Array.from(new Set(raw)).filter((v): v is CreditTypeValue =>
    (ALLOWED_CREDIT_TYPES as readonly string[]).includes(v)
  )
  return filtered
}


function parseCreditAmounts(data: FormData, types: CreditTypeValue[]): { amounts: Record<string, number>; max: number; error?: string } {
  const amounts: Record<string, number> = {};
  let max = 0;
  for (const t of types) {
    const raw = data.get(`creditAmount_${t}`)?.toString();
    if (!raw) return { amounts, max, error: `Credit amount for "${t}" is required` };
    const n = parseInt(raw);
    if (isNaN(n) || n <= 0) return { amounts, max, error: `Credit amount for "${t}" must be a positive number` };
    amounts[t] = n;
    if (n > max) max = n;
  }
  return { amounts, max };
}

export const load: PageServerLoad = async ({ params }) => {
  const planId = params.id

  if (!planId) {
    throw error(404, 'Credit plan not found')
  }

  const plan = await db
    .select()
    .from(creditPlans)
    .where(eq(creditPlans.id, planId))
    .limit(1)

  if (plan.length === 0) {
    throw error(404, 'Credit plan not found')
  }

  return {
    plan: plan[0],
    isDemoMode: isDemoModeEnabled()
  }
}

export const actions: Actions = {
  update: async ({ request, params }) => {
    if (isDemoModeEnabled()) {
      return fail(403, { error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED });
    }

    const planId = params.id

    if (!planId) {
      throw error(404, 'Credit plan not found')
    }

    const data = await request.formData()

    const name = data.get('name')?.toString()
    const description = data.get('description')?.toString() || null
    const creditTypesArr = parseCreditTypes(data)
    const priceAmountUsdRaw = data.get('priceAmount')?.toString()
    const priceAmountBdtRaw = data.get('priceAmountBdt')?.toString()
    const currencyRaw = (data.get('currency')?.toString() || 'USD').toUpperCase()
    const currencyCode: CurrencyCode = isCurrencyCode(currencyRaw) ? currencyRaw : 'USD'
    const currency = currencyCode.toLowerCase()
    const priceUsdWhole = priceAmountUsdRaw ? parseFloat(priceAmountUsdRaw) : NaN
    const priceBdtWhole = priceAmountBdtRaw ? parseFloat(priceAmountBdtRaw) : NaN
    const priceAmountCents = !isNaN(priceUsdWhole) && priceUsdWhole >= 0 ? Math.round(priceUsdWhole * 100) : NaN
    const priceAmountBdt = !isNaN(priceBdtWhole) && priceBdtWhole >= 0 ? Math.round(priceBdtWhole * 100) : null
    const priceAmount = isNaN(priceAmountCents) ? '' : String(priceAmountCents)
    const priceAmountRaw = priceAmountUsdRaw
    const isActive = data.get('isActive') === 'on'

    const { amounts: creditAmountsMap, max: creditAmountMax, error: amtErr } =
      parseCreditAmounts(data, creditTypesArr)

    const failBack = (status: number, errMsg: string) =>
      fail(status, {
        error: errMsg,
        name,
        description,
        creditTypes: creditTypesArr,
        creditAmounts: creditAmountsMap,
        priceAmount: priceAmountRaw,
        priceAmountBdt: priceAmountBdtRaw,
        currency: currencyCode,
        isActive,
      })

    if (!name || creditTypesArr.length === 0 || !priceAmountRaw) {
      return failBack(400, 'Name, at least one credit type and price are required')
    }
    if (isNaN(priceAmountCents) || priceAmountCents < 0) {
      return failBack(400, 'Price must be a valid positive number')
    }

    if (amtErr) return failBack(400, amtErr)
    const creditAmountNum = creditAmountMax

    const priceAmountNum = priceAmountCents
    const priceAmountBdtNum = priceAmountBdt

    try {
      await db
        .update(creditPlans)
        .set({
          name,
          description,
          // Keep the legacy column populated with the first selected type so
          // any reader still using `creditType` continues to work.
          creditType: creditTypesArr[0],
          creditTypes: creditTypesArr,
          creditAmounts: creditAmountsMap,
          creditAmount: creditAmountNum,
          priceAmount: priceAmountNum,
          priceAmountBdt: priceAmountBdtNum,
          currency,
          isActive,
          updatedAt: new Date()
        })
        .where(eq(creditPlans.id, planId))

      throw redirect(303, '/admin/settings/credit-plans')
    } catch (error) {
      if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && error.status === 303)) {
        throw error
      }

      console.error('Error updating credit plan:', error)
      return failBack(500, 'Failed to update credit plan')
    }
  },

  delete: async ({ params }) => {
    if (isDemoModeEnabled()) {
      return fail(403, { error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED });
    }

    const planId = params.id

    if (!planId) {
      throw error(404, 'Credit plan not found')
    }

    try {
      await db
        .delete(creditPlans)
        .where(eq(creditPlans.id, planId))

      throw redirect(303, '/admin/settings/credit-plans')
    } catch (error) {
      if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && error.status === 303)) {
        throw error
      }

      console.error('Error deleting credit plan:', error)
      return fail(500, { error: 'Failed to delete credit plan' })
    }
  }
}
