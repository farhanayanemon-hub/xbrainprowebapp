<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  let { data } = $props();
  const tabs: Array<{id:string;label:string}> = [
    { id: 'all', label: 'All Orders' },
    { id: 'new', label: 'New Orders' },
    { id: 'pending', label: 'Pending Orders' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];
  function fmtMoney(amt:number, cur:string){ return (amt/100).toFixed(2)+' '+cur.toUpperCase(); }
  function fmtDate(d:any){ return d ? new Date(d).toLocaleString() : '—'; }
  function setTab(id:string){ goto(`/admin/orders?tab=${id}`, { replaceState: false, noScroll: true }); }
  let confirmId = $state<string | null>(null);
  let confirmAction = $state<'complete'|'cancel'|null>(null);
  let adminNotes = $state('');
  function openConfirm(id:string, action:'complete'|'cancel'){ confirmId = id; confirmAction = action; adminNotes=''; }
  function closeConfirm(){ confirmId = null; confirmAction = null; }
</script>

<div class="container mx-auto p-6 space-y-6">
  <div>
    <h1 class="text-3xl font-bold">Orders</h1>
    <p class="text-muted-foreground">Manual payment orders from users (PayPal, Wise, Skrill, Binance, Bybit, etc.)</p>
  </div>

  <!-- Subtabs -->
  <div class="flex flex-wrap gap-2 border-b">
    {#each tabs as t}
      <button
        type="button"
        onclick={() => setTab(t.id)}
        class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors {data.activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
      >
        {t.label}
        <span class="ml-1 text-xs px-1.5 py-0.5 rounded bg-muted">{data.counts[t.id] ?? 0}</span>
      </button>
    {/each}
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title class="capitalize">{data.activeTab} Orders ({data.orders.length})</Card.Title>
    </Card.Header>
    <Card.Content>
      {#if data.orders.length === 0}
        <p class="text-center py-12 text-muted-foreground">No orders in this category yet.</p>
      {:else}
        <div class="overflow-x-auto">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Date</Table.Head>
                <Table.Head>User</Table.Head>
                <Table.Head>Plan</Table.Head>
                <Table.Head>Gateway</Table.Head>
                <Table.Head>Amount</Table.Head>
                <Table.Head>Txn Ref</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head class="text-right">Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each data.orders as o}
                <Table.Row>
                  <Table.Cell class="text-xs">{fmtDate(o.createdAt)}</Table.Cell>
                  <Table.Cell>{o.userEmail || '—'}</Table.Cell>
                  <Table.Cell>{o.planName || '—'} <span class="text-xs text-muted-foreground">({o.planTier || '—'})</span></Table.Cell>
                  <Table.Cell class="capitalize">{o.gateway}</Table.Cell>
                  <Table.Cell>{fmtMoney(o.amount, o.currency)}</Table.Cell>
                  <Table.Cell class="font-mono text-xs">{o.txnReference || '—'}</Table.Cell>
                  <Table.Cell>
                    <span class="inline-block px-2 py-0.5 text-xs rounded {
                      o.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                      o.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                      o.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                    }">{o.status}</span>
                  </Table.Cell>
                  <Table.Cell class="text-right space-x-1">
                    {#if o.status === 'new' || o.status === 'pending'}
                      <Button size="sm" variant="default" onclick={() => openConfirm(o.id, 'complete')}>Complete</Button>
                      <Button size="sm" variant="destructive" onclick={() => openConfirm(o.id, 'cancel')}>Cancel</Button>
                    {/if}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

{#if confirmId}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={closeConfirm} role="presentation">
    <div class="bg-background rounded-lg p-6 max-w-md w-full mx-4 space-y-4" onclick={(e)=>e.stopPropagation()} role="presentation">
      <h2 class="text-lg font-bold capitalize">Confirm: {confirmAction} order</h2>
      <p class="text-sm text-muted-foreground">
        {#if confirmAction === 'complete'}
          The order will be marked as completed AND the user's plan will be upgraded automatically.
        {:else}
          The order will be marked as cancelled. User's plan will not change.
        {/if}
      </p>
      <form method="POST" action="?/{confirmAction}" use:enhance={() => {
        return async ({ update }) => { await update(); closeConfirm(); };
      }} class="space-y-3">
        <input type="hidden" name="id" value={confirmId} />
        <div>
          <label for="adminNotes" class="text-sm font-medium">Admin notes (optional)</label>
          <Input id="adminNotes" name="adminNotes" bind:value={adminNotes} placeholder="Reason or verification details..." />
        </div>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="outline" onclick={closeConfirm}>Cancel</Button>
          <Button type="submit" variant={confirmAction === 'cancel' ? 'destructive' : 'default'}>
            Yes, {confirmAction}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}
