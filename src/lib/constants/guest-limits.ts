/**
 * Guest user limitation constants
 * Centralized configuration for non-logged in user restrictions
 */

export const GUEST_MESSAGE_LIMIT = 6;
export const GUEST_ALLOWED_MODELS = [
    // EzboAI's own free model — listed first so it becomes the default for guests
    "ezbo/ezbo-1.0",
    "google/gemma-3-27b-it:free",
    "openai/gpt-oss-20b:free",
    "moonshotai/kimi-k2:free"
];

// Helper function to check if a model is allowed for guests
export function isModelAllowedForGuests(modelName: string): boolean {
    return GUEST_ALLOWED_MODELS.includes(modelName);
}