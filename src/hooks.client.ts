import type { HandleClientError } from '@sveltejs/kit';
import { toast } from 'svelte-sonner';

/**
 * Extract a clean, user-friendly message from any error-like value.
 * Strips noisy stack frames, "Error:" prefixes, and overly long text.
 */
function formatErrorMessage(err: unknown): string {
	let raw: string;
	if (err instanceof Error) raw = err.message || err.name || 'Unknown error';
	else if (typeof err === 'string') raw = err;
	else if (err && typeof err === 'object') {
		const anyErr = err as { message?: unknown; reason?: unknown };
		raw = String(anyErr.message ?? anyErr.reason ?? JSON.stringify(err));
	} else {
		raw = 'An unexpected error occurred.';
	}
	// Strip leading "Error:" so it doesn't read "Error: Error: ..."
	raw = raw.replace(/^Error:\s*/i, '').trim();
	// Cap very long messages so they fit in a toast
	if (raw.length > 240) raw = raw.slice(0, 237) + '…';
	return raw || 'An unexpected error occurred.';
}

// SvelteKit's official client error hook — fires for any thrown error
// during navigation, load functions, or component init on the client.
export const handleError: HandleClientError = ({ error }) => {
	const message = formatErrorMessage(error);
	// Defer to next tick so the toaster is mounted before we call it.
	queueMicrotask(() => {
		try {
			toast.error(message);
		} catch {
			/* noop — toaster not yet mounted */
		}
	});
	return { message };
};

// Catch errors from anywhere else (event handlers, async code without await,
// third-party scripts, etc.) and surface them as toasts too.
if (typeof window !== 'undefined') {
	window.addEventListener('error', (e) => {
		// Ignore ResizeObserver loop noise and benign cross-origin script errors
		if (e.message && /ResizeObserver|Script error/.test(e.message)) return;
		toast.error(formatErrorMessage(e.error || e.message));
	});
	window.addEventListener('unhandledrejection', (e) => {
		toast.error(formatErrorMessage(e.reason));
	});
}
