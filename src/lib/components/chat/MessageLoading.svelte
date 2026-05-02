<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: className = "" }: Props = $props();
</script>

<div class="flex items-center gap-1.5 px-1 py-2 {className}" aria-label="AI is typing" role="status">
	<span class="ezbo-typing-dot block w-2 h-2 rounded-full bg-muted-foreground/70"></span>
	<span class="ezbo-typing-dot block w-2 h-2 rounded-full bg-muted-foreground/70"></span>
	<span class="ezbo-typing-dot block w-2 h-2 rounded-full bg-muted-foreground/70"></span>
</div>

<style>
	.ezbo-typing-dot {
		animation: ezbo-bounce 1.2s infinite ease-in-out both;
	}
	.ezbo-typing-dot:nth-child(1) { animation-delay: -0.32s; }
	.ezbo-typing-dot:nth-child(2) { animation-delay: -0.16s; }
	.ezbo-typing-dot:nth-child(3) { animation-delay: 0s; }

	@keyframes ezbo-bounce {
		0%, 80%, 100% {
			transform: scale(0.6);
			opacity: 0.45;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
