import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllModels } from '$lib/ai';

export const GET: RequestHandler = async ({ locals }) => {
  if (!(locals as any).user?.isAdmin) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }
  const models = getAllModels().map((m: any) => ({
    name: m.name,
    displayName: m.displayName || m.name,
    provider: m.provider || 'Other',
  }));
  const grouped: Record<string, typeof models> = {};
  for (const m of models) (grouped[m.provider] ||= []).push(m);
  return json({ models, grouped });
};
