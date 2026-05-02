import type { LayoutServerLoad } from './$types'
import { isDemoModeEnabled } from '$lib/constants/demo-mode.js'
import { toPublicSettings } from '$lib/server/settings-store'
import { PaymentRouter } from '$lib/server/payment-router.js'
import { db, users } from '$lib/server/db'
import { eq } from 'drizzle-orm'

export const load: LayoutServerLoad = async ({ locals }) => {
  const session = await locals.auth()

  // Get admin default settings from cached settings (loaded by settingsHandle in hooks)
  // This eliminates the database call on every page load
  const cachedSettings = locals.settings;
  const adminDefaults = {
    theme: cachedSettings?.defaultTheme || 'dark',
    language: cachedSettings?.defaultLanguage || 'en'
  };

  let renewalInfo = null;
  // Onboarding flag: true when the logged-in user has not yet set a display
  // name. Used by the global OnboardingDialog to ask "What is your name?"
  // immediately after sign-up (and once per account thereafter).
  let needsNameOnboarding = false;
  if (session?.user?.id) {
    try {
      const renewal = await PaymentRouter.checkRenewalRequired(session.user.id);
      if (renewal) {
        renewalInfo = {
          needsRenewal: true,
          planTier: renewal.planTier,
          daysRemaining: renewal.daysRemaining,
          expiresAt: renewal.expiresAt
        };
      }
    } catch (error) {
      console.error('Error checking renewal status:', error);
    }

    try {
      const row = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);
      const dbName = row[0]?.name?.trim();
      needsNameOnboarding = !dbName;
    } catch (error) {
      console.error('Error checking onboarding name:', error);
    }
  }

  return {
    session,
    // SECURITY: Only pass client-safe fields to the browser.
    // Server secrets (API keys, OAuth secrets, storage credentials) are filtered out.
    settings: toPublicSettings(locals.settings),
    adminDefaults,
    isDemoMode: isDemoModeEnabled(),
    renewalInfo,
    needsNameOnboarding
  }
}