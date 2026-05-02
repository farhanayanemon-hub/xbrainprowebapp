import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (isDemoModeEnabled()) {
    return json({ error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED }, { status: 403 });
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!raw) {
    return json({ error: 'Name is required' }, { status: 400 });
  }
  if (raw.length > 80) {
    return json({ error: 'Name must be 80 characters or less' }, { status: 400 });
  }

  try {
    await db.update(users).set({ name: raw }).where(eq(users.id, session.user.id));
    return json({ success: true, name: raw });
  } catch (e) {
    console.error('Error updating user name:', e);
    return json({ error: 'Failed to save name' }, { status: 500 });
  }
};
