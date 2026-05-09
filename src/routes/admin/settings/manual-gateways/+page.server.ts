import type { PageServerLoad, Actions } from './$types';
import { fail, error } from '@sveltejs/kit';
import { loadAllGateways, saveGateway, type GatewayId } from '$lib/server/manual-gateways';

export const load: PageServerLoad = async ({ locals }) => {
  const session = await (locals as any).auth?.();
  if (!session?.user?.isAdmin) throw error(403, 'Forbidden');
  const gateways = await loadAllGateways();
  return { gateways };
};

export const actions: Actions = {
  save: async ({ request, locals }) => {
    const session = await (locals as any).auth?.();
    if (!session?.user?.isAdmin) return fail(403, { error: 'Forbidden' });
    const data = await request.formData();
    const id = data.get('id')?.toString() as GatewayId;
    if (!id) return fail(400, { error: 'Missing gateway id' });
    await saveGateway(id, {
      enabled: data.get('enabled') === 'on',
      displayName: data.get('displayName')?.toString() || '',
      accountInfo: data.get('accountInfo')?.toString() || '',
      instructions: data.get('instructions')?.toString() || '',
    });
    return { success: true, savedId: id };
  },
};
