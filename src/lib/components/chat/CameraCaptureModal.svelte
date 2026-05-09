<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { CameraIcon, RefreshCwIcon, XIcon } from '$lib/icons/index.js';

  interface Props {
    open: boolean;
    onCapture: (file: File) => void;
    onClose: () => void;
  }
  let { open = $bindable(), onCapture, onClose }: Props = $props();

  let videoEl = $state<HTMLVideoElement | null>(null);
  let stream = $state<MediaStream | null>(null);
  let error = $state<string | null>(null);
  let starting = $state(false);
  let facingMode = $state<'user' | 'environment'>('environment');

  async function start() {
    error = null;
    starting = true;
    stop();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        error = 'Camera API not supported in this browser. Please use a modern browser (Chrome, Edge, Firefox, Safari) and check that you are on HTTPS.';
        return;
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      // Wait one tick so videoEl exists, then bind
      await new Promise(r => setTimeout(r, 30));
      if (videoEl && stream) {
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});
      }
    } catch (e: any) {
      const name = e?.name || 'Error';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        error = 'Camera permission denied. Please allow camera access in your browser settings (lock icon in address bar) and reload the page.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        error = 'No camera found on this device.';
      } else if (name === 'NotReadableError') {
        error = 'Camera is being used by another application. Close other apps and try again.';
      } else if (name === 'OverconstrainedError') {
        // retry with no facingMode constraint
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (videoEl) { videoEl.srcObject = stream; await videoEl.play().catch(() => {}); }
        } catch (e2: any) {
          error = 'Could not start camera: ' + (e2?.message || name);
        }
      } else {
        error = 'Camera error: ' + (e?.message || name);
      }
    } finally {
      starting = false;
    }
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
  }

  function flip() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    start();
  }

  async function capture() {
    if (!videoEl || !stream) return;
    const w = videoEl.videoWidth, h = videoEl.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      handleClose();
    }, 'image/jpeg', 0.92);
  }

  function handleClose() {
    stop();
    onClose();
  }

  // React only to `open` flag changes (untrack so writes inside start()/stop() don't re-trigger us).
  $effect(() => {
    const isOpen = open;
    untrack(() => {
      if (isOpen) start();
      else stop();
    });
  });

  onDestroy(() => stop());
</script>

{#if open}
  <div class="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="bg-background rounded-lg max-w-2xl w-full overflow-hidden flex flex-col max-h-[95vh]">
      <div class="flex items-center justify-between p-3 border-b">
        <h2 class="font-semibold flex items-center gap-2"><CameraIcon class="size-5" /> Take a Photo</h2>
        <button type="button" class="p-1 rounded hover:bg-muted" onclick={handleClose} aria-label="Close camera">
          <XIcon class="size-5" />
        </button>
      </div>
      <div class="relative bg-black flex items-center justify-center min-h-[300px]">
        {#if error}
          <div class="p-6 text-center text-red-300 text-sm space-y-3">
            <p>{error}</p>
            <Button onclick={start} variant="outline" size="sm">Try Again</Button>
          </div>
        {:else}
          <video bind:this={videoEl} autoplay playsinline muted class="w-full max-h-[70vh] object-contain"></video>
          {#if starting}
            <div class="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">Starting camera...</div>
          {/if}
        {/if}
      </div>
      <div class="p-3 flex items-center justify-between gap-2 border-t">
        <Button variant="outline" size="sm" onclick={flip} disabled={!stream || !!error}>
          <RefreshCwIcon class="size-4 mr-1" /> Flip
        </Button>
        <Button onclick={capture} disabled={!stream || !!error} class="px-6">
          <CameraIcon class="size-4 mr-1" /> Capture
        </Button>
        <Button variant="ghost" size="sm" onclick={handleClose}>Cancel</Button>
      </div>
    </div>
  </div>
{/if}
