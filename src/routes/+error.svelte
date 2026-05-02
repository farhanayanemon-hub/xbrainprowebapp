<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import Button from "$lib/components/ui/button/button.svelte";

  function reload() {
    location.reload();
  }
  function goHome() {
    goto("/");
  }
</script>

<svelte:head>
  <title>{page.status} — Something went wrong</title>
</svelte:head>

<div class="ezbo-error-overlay">
  <div class="ezbo-error-card" role="alertdialog" aria-labelledby="ezbo-err-title">
    <div class="ezbo-error-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>

    <div class="ezbo-error-status">{page.status}</div>
    <h1 id="ezbo-err-title" class="ezbo-error-title">
      {#if page.status === 404}
        Page not found
      {:else if page.status === 403}
        Access denied
      {:else if page.status >= 500}
        Something went wrong on our side
      {:else}
        Something went wrong
      {/if}
    </h1>

    <p class="ezbo-error-message">
      {page.error?.message || "An unexpected error occurred. Please try again."}
    </p>

    <div class="ezbo-error-actions">
      <Button variant="outline" onclick={goHome}>Go home</Button>
      <Button onclick={reload}>Try again</Button>
    </div>
  </div>
</div>

<style>
  .ezbo-error-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background:
      radial-gradient(ellipse at top, hsl(var(--destructive) / 0.08), transparent 60%),
      hsl(var(--background));
    backdrop-filter: blur(8px);
    animation: ezbo-fade 200ms ease-out;
  }

  .ezbo-error-card {
    width: 100%;
    max-width: 420px;
    padding: 2rem 1.75rem;
    border-radius: 1rem;
    background: hsl(var(--popover));
    color: hsl(var(--popover-foreground));
    border: 1px solid hsl(var(--border));
    box-shadow:
      0 30px 80px -20px hsl(var(--destructive) / 0.25),
      0 12px 24px -8px rgb(0 0 0 / 0.25);
    text-align: center;
    animation: ezbo-pop 240ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ezbo-error-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 9999px;
    margin-bottom: 1rem;
    background: hsl(var(--destructive) / 0.1);
    color: hsl(var(--destructive));
  }

  .ezbo-error-status {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: hsl(var(--destructive));
    margin-bottom: 0.5rem;
  }

  .ezbo-error-title {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
    margin: 0 0 0.5rem;
    letter-spacing: -0.01em;
  }

  .ezbo-error-message {
    font-size: 0.95rem;
    line-height: 1.5;
    color: hsl(var(--muted-foreground));
    margin: 0 0 1.5rem;
    word-break: break-word;
  }

  .ezbo-error-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  @keyframes ezbo-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes ezbo-pop {
    from { opacity: 0; transform: translateY(8px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }
</style>
