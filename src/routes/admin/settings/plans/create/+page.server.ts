import type { Actions, PageServerLoad } from './$types'
import { db, pricingPlans } from '$lib/server/db'
import { fail, redirect } from '@sveltejs/kit'
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js'
import { wholeUnitsToUsdCents } from '$lib/utils/price-conversion.js'
import { getCurrencyRatesFromSettings } from '$lib/server/get-currency-rates.js'
import { isCurrencyCode, type CurrencyCode } from '$lib/utils/currencies.js'

export const load: PageServerLoad = async () => {
  return {
    isDemoMode: isDemoModeEnabled()
  }
}

export const actions: Actions = {
  create: async ({ request }) => {
    // Check demo mode - block modifications
    if (isDemoModeEnabled()) {
      return fail(403, {
        error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED
      });
    }

    const data = await request.formData()
    
    const name = data.get('name')?.toString()
    const tier = data.get('tier')?.toString()
    const stripePriceId = data.get('stripePriceId')?.toString()
    const priceAmountRaw = data.get('priceAmount')?.toString()
    const currencyRaw = (data.get('currency')?.toString() || 'USD').toUpperCase()
    const currencyCode: CurrencyCode = isCurrencyCode(currencyRaw) ? currencyRaw : 'USD'
    const currency = currencyCode.toLowerCase()
    const priceAmountWhole = priceAmountRaw ? parseFloat(priceAmountRaw) : NaN
    const fxRates = await getCurrencyRatesFromSettings()
    const priceAmountCents = !isNaN(priceAmountWhole) && priceAmountWhole >= 0 ? wholeUnitsToUsdCents(priceAmountWhole, currencyCode, fxRates) : NaN
    const priceAmountBdtPaisa = !isNaN(priceAmountCents) ? Math.round((priceAmountCents / 100) * (fxRates.BDT ?? 110) * 100) : null
    const priceAmount = isNaN(priceAmountCents) ? '' : String(priceAmountCents)
    const billingInterval = data.get('billingInterval')?.toString()
    const textGenerationLimit = data.get('textGenerationLimit')?.toString()
    const imageGenerationLimit = data.get('imageGenerationLimit')?.toString()
    const videoGenerationLimit = data.get('videoGenerationLimit')?.toString()
    const audioGenerationLimit = data.get('audioGenerationLimit')?.toString()
    const voiceGenerationLimit = data.get('voiceGenerationLimit')?.toString()
    const features = data.get('features')?.toString()
    const allowedModels = data.getAll('allowedModels').map(v => v.toString())

    // Validation
    if (!name || !tier || !stripePriceId || !priceAmount || !billingInterval) {
      return fail(400, {
        error: 'Required fields are missing',
        name,
        tier,
        stripePriceId,
        priceAmount: priceAmountRaw,
        currency: currencyCode,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        audioGenerationLimit,
        voiceGenerationLimit,
        features
      })
    }

    if (!['free', 'starter', 'pro', 'advanced'].includes(tier)) {
      return fail(400, {
        error: 'Invalid tier selected',
        name,
        tier,
        stripePriceId,
        priceAmount: priceAmountRaw,
        currency: currencyCode,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        audioGenerationLimit,
        voiceGenerationLimit,
        features
      })
    }

    if (!['month', 'year'].includes(billingInterval)) {
      return fail(400, {
        error: 'Invalid billing interval selected',
        name,
        tier,
        stripePriceId,
        priceAmount: priceAmountRaw,
        currency: currencyCode,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        audioGenerationLimit,
        voiceGenerationLimit,
        features
      })
    }

    const priceAmountNum = priceAmountCents
    if (isNaN(priceAmountNum) || priceAmountNum < 0) {
      return fail(400, {
        error: 'Price amount must be a valid positive number',
        name,
        tier,
        stripePriceId,
        priceAmount: priceAmountRaw,
        currency: currencyCode,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        audioGenerationLimit,
        voiceGenerationLimit,
        features
      })
    }

    try {
      // Parse limits (null for unlimited, 0 for no access)
      const textLimit = textGenerationLimit === '' || textGenerationLimit === undefined || textGenerationLimit === null ? null : parseInt(textGenerationLimit)
      const imageLimit = imageGenerationLimit === '' || imageGenerationLimit === undefined || imageGenerationLimit === null ? null : parseInt(imageGenerationLimit)
      const videoLimit = videoGenerationLimit === '' || videoGenerationLimit === undefined || videoGenerationLimit === null ? null : parseInt(videoGenerationLimit)
      const audioLimit = audioGenerationLimit === '' || audioGenerationLimit === undefined || audioGenerationLimit === null ? null : parseInt(audioGenerationLimit)
      const voiceLimit = voiceGenerationLimit === '' || voiceGenerationLimit === undefined || voiceGenerationLimit === null ? null : parseInt(voiceGenerationLimit)

      // Parse features array
      let featuresArray: string[] = []
      if (features) {
        try {
          featuresArray = features.split('\n').map(f => f.trim()).filter(f => f.length > 0)
        } catch (error) {
          featuresArray = []
        }
      }

      // Create the plan
      await db.insert(pricingPlans).values({
        name,
        tier: tier as 'free' | 'starter' | 'pro' | 'advanced',
        stripePriceId,
        priceAmount: priceAmountNum,
        priceAmountBdt: priceAmountBdtPaisa,
        currency,
        billingInterval: billingInterval as 'month' | 'year',
        textGenerationLimit: textLimit !== null && !isNaN(textLimit) ? textLimit : null,
        imageGenerationLimit: imageLimit !== null && !isNaN(imageLimit) ? imageLimit : null,
        videoGenerationLimit: videoLimit !== null && !isNaN(videoLimit) ? videoLimit : null,
        audioGenerationLimit: audioLimit !== null && !isNaN(audioLimit) ? audioLimit : null,
        voiceGenerationLimit: voiceLimit !== null && !isNaN(voiceLimit) ? voiceLimit : null,
        features: featuresArray,
        allowedModels,
        isActive: true
      })

      throw redirect(303, '/admin/settings/plans')
    } catch (error) {
      // Check if this is a redirect response (SvelteKit redirects are Response objects)
      if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && error.status === 303)) {
        throw error
      }
      
      console.error('Error creating plan:', error)
      return fail(500, {
        error: 'Failed to create plan',
        name,
        tier,
        stripePriceId,
        priceAmount: priceAmountRaw,
        currency: currencyCode,
        billingInterval,
        textGenerationLimit,
        imageGenerationLimit,
        videoGenerationLimit,
        audioGenerationLimit,
        voiceGenerationLimit,
        features
      })
    }
  }
}