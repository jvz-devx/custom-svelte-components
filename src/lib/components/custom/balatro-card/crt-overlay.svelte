<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** CRT intensity 0–100 (default 100) */
		intensity?: number;
		children: Snippet;
	}

	let { intensity = 100, children }: Props = $props();

	// Normalize intensity to 0-1
	const i = $derived(intensity / 100);
</script>

<div class="crt-wrapper">
	<div class="crt-content">
		{@render children()}
	</div>
	<!-- Scanline overlay — pure CSS, no content capture -->
	{#if i > 0}
		<div
			class="crt-scanlines"
			style="opacity: {i * 0.12};"
		></div>
		<!-- Vignette -->
		<div
			class="crt-vignette"
			style="opacity: {i * 0.3};"
		></div>
	{/if}
</div>

<style>
	.crt-wrapper {
		position: relative;
		overflow: hidden;
	}
	.crt-content {
		position: relative;
		z-index: 0;
	}
	.crt-scanlines {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
		background: repeating-linear-gradient(
			to bottom,
			transparent 0px,
			transparent 2px,
			rgba(0, 0, 0, 0.3) 2px,
			rgba(0, 0, 0, 0.3) 4px
		);
		mix-blend-mode: multiply;
	}
	.crt-vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
		background: radial-gradient(
			ellipse at center,
			transparent 50%,
			rgba(0, 0, 0, 0.4) 100%
		);
	}
</style>
