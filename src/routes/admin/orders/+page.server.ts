import type { PageServerLoad, Actions } from './$types';
import { db, manualOrders, users, pricingPlans } from '$lib/server/db';
import { desc, eq, and, count, sql as dsql } from 'drizzle-orm';
import { fail, error } from '@sveltejs/kit';

const VALID_TABS = ['all', 'new', 'pending', 'completed', 'cancelled'] as const;
type Tab = typeof VALID_TABS[number];

export const load: PageServerLoad = async ({ url, locals }) => {
  const session = await (locals as any).auth?.();
  if (!session?.user?.isAdmin) throw error(403, 'Forbidden');

  const tabParam = (url.searchParams.get('tab') || 'all') as Tab;
  const tab: Tab = (VALID_TABS as readonly string[]).includes(tabParam) ? tabParam : 'all';

  const where = tab === 'all' ? undefined : eq(manualOrders.status, tab as any);

  const orders = await db
    .select({
      id: manualOrders.id,
      userEmail: manualOrders.userEmail,
      userId: manualOrders.userId,
      planName: manualOrders.planName,
      planTier: manualOrders.planTier,
      gateway: manualOrders.gateway,
      amount: manualOrders.amount,
      currency: manualOrders.currency,
      status: manualOrders.status,
      txnReference: manualOrders.txnReference,
      createdAt: manualOrders.createdAt,
      completedAt: manualOrders.completedAt,
    })
    .from(manualOrders)
    .where(where as any)
    .orderBy(desc(manualOrders.createdAt))
    .limit(200);

  // Counts per tab
  const countsRaw = await db.select({ status: manualOrders.status, c: count() }).from(manualOrders).groupBy(manualOrders.status);
  const counts: Record<string, number> = { all: 0, new: 0, pending: 0, completed: 0, cancelled: 0 };
  for (const r of countsRaw) { counts[r.status] = Number(r.c); counts.all += Number(r.c); }

  return { orders, counts, activeTab: tab };
};

export const actions: Actions = {
  complete: async ({ request, locals }) => {
    const session = await (locals as any).auth?.();
    if (!session?.user?.isAdmin) return fail(403, { error: 'Forbidden' });
    const data = await request.formData();
    const id = data.get('id')?.toString();
    const adminNotes = data.get('adminNotes')?.toString() || null;
    if (!id) return fail(400, { error: 'Missing order id' });

    const order = (await db.select().from(manualOrders).where(eq(manualOrders.id, id)).limit(1))[0];
    if (!order) return fail(404, { error: 'Order not found' });

    await db.update(manualOrders).set({
      status: 'completed',
      adminNotes,
      completedBy: session.user.email || session.user.id,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(manualOrders.id, id));

    // If order has a planTier and a userId, upgrade the user
    if (order.userId && order.planTier) {
      await db.update(users).set({
        planTier: order.planTier as any,
        subscriptionStatus: 'active',
      }).where(eq(users.id, order.userId));
    }
    return { success: true };
  },

  cancel: async ({ request, locals }) => {
    const session = await (locals as any).auth?.();
    if (!session?.user?.isAdmin) return fail(403, { error: 'Forbidden' });
    const data = await request.formData();
    const id = data.get('id')?.toString();
    const adminNotes = data.get('adminNotes')?.toString() || null;
    if (!id) return fail(400, { error: 'Missing order id' });

    await db.update(manualOrders).set({
      status: 'cancelled',
      adminNotes,
      cancelledBy: session.user.email || session.user.id,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(manualOrders.id, id));
    return { success: true };
  },

  setPending: async ({ request, locals }) => {
    const session = await (locals as any).auth?.();
    if (!session?.user?.isAdmin) return fail(403, { error: 'Forbidden' });
    const data = await request.formData();
    const id = data.get('id')?.toString();
    if (!id) return fail(400, { error: 'Missing order id' });
    await db.update(manualOrders).set({ status: 'pending', updatedAt: new Date() }).where(eq(manualOrders.id, id));
    return { success: true };
  },

  createForUser: async ({ request, locals }) => {
    const session = await (locals as any).auth?.();
    if (!session?.user?.isAdmin) return fail(403, { error: 'Forbidden' });
    const data = await request.formData();
    const userId = data.get('userId')?.toString();
    const planId = data.get('planId')?.toString();
    const gateway = data.get('gateway')?.toString() || 'manual';
    const amount = parseInt(data.get('amount')?.toString() || '0', 10);
    if (!userId || !planId) return fail(400, { error: 'Missing fields' });

    const u = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    const p = (await db.select().from(pricingPlans).where(eq(pricingPlans.id, planId)).limit(1))[0];
    if (!u || !p) return fail(404, { error: 'User or plan not found' });

    await db.insert(manualOrders).values({
      userId, userEmail: u.email,
      planId: p.id, planName: p.name, planTier: p.tier,
      gateway: gateway as any,
      amount: amount || p.priceAmount,
      currency: p.currency,
      status: 'new',
      adminNotes: 'Created by admin',
    });
    return { success: true };
  },
};
