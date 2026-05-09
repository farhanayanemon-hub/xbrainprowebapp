import type { PageServerLoad, Actions } from './$types';
import { fail, error } from '@sveltejs/kit';
import { loadAllGateways, saveGateway, type GatewayId } from '$lib/server/manual-gateways';
import { uploadBrandingFile, deleteBrandingFile, getCurrentBrandingFile } from '$lib/server/file-upload';

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

    // Optional icon upload
    let iconUrl: string | undefined;
    const iconFile = data.get('iconFile') as File | null;
    if (iconFile && iconFile.size > 0) {
      try {
        const cat = `gateway-${id}`;
        await deleteBrandingFile(cat).catch(() => {});
        const uploaded = await uploadBrandingFile(iconFile, cat);
        iconUrl = uploaded.url;
      } catch (e: any) {
        return fail(400, { error: 'Icon upload failed: ' + (e?.message || 'unknown') });
      }
    }

    // Optional remove icon
    if (data.get('removeIcon') === 'on') {
      try { await deleteBrandingFile(`gateway-${id}`); } catch {}
      iconUrl = '';
    }

    await saveGateway(id, {
      enabled: data.get('enabled') === 'on',
      displayName: data.get('displayName')?.toString() || '',
      accountInfo: data.get('accountInfo')?.toString() || '',
      instructions: data.get('instructions')?.toString() || '',
      ...(iconUrl !== undefined ? { iconUrl } : {}),
    });
    return { success: true, savedId: id };
  },
};
