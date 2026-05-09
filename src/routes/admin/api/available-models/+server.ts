import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiManager } from '$lib/ai';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user?.isAdmin) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }
  const models = aiManager.getAllModels().map((m: any) => ({
    name: m.name,
    displayName: m.displayName || m.name,
    provider: m.provider || 'Other',
  }));
  // Group by provider
  const grouped: Record<string, typeof models> = {};
  for (const m of models) {
    (grouped[m.provider] ||= []).push(m);
  }
  return json({ models, grouped });
};
