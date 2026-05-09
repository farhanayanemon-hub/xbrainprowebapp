<script lang="ts">
  import { onMount } from 'svelte';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';

  interface Model { name: string; displayName: string; provider: string; }
  let { selected = $bindable<string[]>([]) }: { selected?: string[] } = $props();

  let grouped = $state<Record<string, Model[]>>({});
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let collapsedProviders = $state<Record<string, boolean>>({});

  onMount(async () => {
    try {
      const r = await fetch('/admin/api/available-models');
      if (!r.ok) throw new Error('Failed to load models (HTTP ' + r.status + ')');
      const data = await r.json();
      grouped = data.grouped || {};
    } catch (e: any) {
      error = e?.message || 'Failed to load models';
    } finally {
      loading = false;
    }
  });

  function toggle(name: string) {
    if (selected.includes(name)) selected = selected.filter(n => n !== name);
    else selected = [...selected, name];
  }
  function selectProvider(provider: string, on: boolean) {
    const names = (grouped[provider] || []).map(m => m.name);
    if (on) selected = Array.from(new Set([...selected, ...names]));
    else selected = selected.filter(n => !names.includes(n));
  }
  function selectAll() { selected = Object.values(grouped).flat().map(m => m.name); }
  function clearAll() { selected = []; }

  const filteredProviders = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return Object.entries(grouped);
    return Object.entries(grouped)
      .map(([prov, models]) => [prov, models.filter(m =>
        m.displayName.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        prov.toLowerCase().includes(q)
      )] as [string, Model[]])
      .filter(([, models]) => models.length > 0);
  });
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between">
    <Label class="text-base">Allowed AI Models for this Plan</Label>
    <span class="text-xs text-muted-foreground">{selected.length} selected</span>
  </div>
  <p class="text-xs text-muted-foreground">
    Choose which AI models users on this plan can access. Leave empty to allow ALL models (default behavior).
  </p>

  {#if loading}
    <p class="text-sm text-muted-foreground">Loading models...</p>
  {:else if error}
    <p class="text-sm text-destructive">{error}</p>
  {:else}
    <div class="flex gap-2 items-center">
      <Input bind:value={search} placeholder="Search models..." class="flex-1" />
      <Button type="button" variant="outline" size="sm" onclick={selectAll}>Select All</Button>
      <Button type="button" variant="outline" size="sm" onclick={clearAll}>Clear</Button>
    </div>

    <div class="border rounded-md max-h-96 overflow-y-auto divide-y">
      {#each filteredProviders as [provider, models]}
        {@const allSelected = models.every(m => selected.includes(m.name))}
        {@const someSelected = models.some(m => selected.includes(m.name))}
        <div>
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50"
            onclick={() => collapsedProviders[provider] = !collapsedProviders[provider]}
          >
            <span class="font-semibold text-sm flex items-center gap-2">
              <span>{collapsedProviders[provider] ? '▶' : '▼'}</span>
              {provider}
              <span class="text-xs text-muted-foreground font-normal">({models.filter(m => selected.includes(m.name)).length}/{models.length})</span>
            </span>
            <label class="flex items-center gap-2 text-xs" onclick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onchange={(e) => selectProvider(provider, (e.target as HTMLInputElement).checked)}
              />
              <span>All</span>
            </label>
          </button>
          {#if !collapsedProviders[provider]}
            <div class="grid md:grid-cols-2 gap-1 px-3 pb-2">
              {#each models as model}
                <label class="flex items-center gap-2 px-2 py-1 hover:bg-muted/30 rounded text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    name="allowedModels"
                    value={model.name}
                    checked={selected.includes(model.name)}
                    onchange={() => toggle(model.name)}
                  />
                  <span class="truncate" title={model.name}>
                    {model.displayName}
                    <span class="text-xs text-muted-foreground">({model.name})</span>
                  </span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
      {#if filteredProviders.length === 0}
        <p class="px-3 py-4 text-sm text-muted-foreground">No models match search.</p>
      {/if}
    </div>
  {/if}
</div>
