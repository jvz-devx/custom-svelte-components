<script lang="ts">
	import { untrack } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { renderCardFace } from './card-face.js';
	import { renderSpriteCardFace } from './sprite-card-face.js';
	import { renderShaderCard, renderShaderOverlay, invalidateTexture } from './shader-renderer.js';
	import { tilt, TiltState } from './tilt.svelte.js';
	import type { BalatroCardProps } from './types.js';

	let {
		rank = 'A',
		suit = 'spades',
		edition = 'base',
		width = 150,
		selected = false,
		disabled = false,
		played = false,
		useSprites = true,
		cardIndex = 0,
		onclick,
		class: className
	}: BalatroCardProps = $props();

	const height = $derived(Math.round(width * 1.4));
	const tiltState = new TiltState();

	let baseImgEl = $state<HTMLImageElement | null>(null);
	let overlayImgEl = $state<HTMLImageElement | null>(null);
	let showFlash = $state(false);

	function handleClick() {
		onclick?.();
		showFlash = true;
		setTimeout(() => (showFlash = false), 150);
	}
	let animTime = 0;
	let animFrame = 0;

	// Generate card face canvas — only re-runs when rank/suit/width/height/useSprites change
	let cardCanvas = $state<HTMLCanvasElement | null>(null);

	$effect(() => {
		if (typeof document === 'undefined') return;
		const r = rank, s = suit, w = width * 2, h = height * 2, sprites = useSprites;
		if (sprites) {
			renderSpriteCardFace(r, s, w, h).then((c) => {
				cardCanvas = c;
			});
		} else {
			cardCanvas = renderCardFace(r, s, w, h);
		}
	});

	// Is this edition an overlay type (composited via CSS blend) or a replacement type?
	const isOverlayEdition = $derived(edition === 'foil' || edition === 'polychrome');
	const isReplacementEdition = $derived(edition === 'negative');

	function getBlendMode(ed: string): string {
		if (ed === 'foil') return 'screen';
		if (ed === 'polychrome') return 'color';
		return 'normal';
	}

	function getOverlayOpacity(ed: string): number {
		if (ed === 'foil') return 0.7;
		if (ed === 'polychrome') return 0.5;
		return 1;
	}

	// Render base card image
	$effect(() => {
		const canvas = cardCanvas;
		const ed = edition;
		const hovering = tiltState.hovering;

		if (!canvas || !baseImgEl) return;

		untrack(() => {
			invalidateTexture(canvas);
		});

		if (ed === 'base' || ed === 'foil' || ed === 'polychrome') {
			// Base card art shown directly (unmodified)
			baseImgEl.src = canvas.toDataURL();
			return;
		}

		// Negative: full replacement shader
		const staticResult = untrack(() => renderShaderCard(canvas, ed, animTime, 0, 0));
		if (staticResult) baseImgEl.src = staticResult;

		if (!hovering) return;

		let running = true;
		let lastTime = performance.now();

		function frame() {
			if (!running || !canvas || !baseImgEl) return;
			const now = performance.now();
			animTime += (now - lastTime) / 1000;
			lastTime = now;

			const result = renderShaderCard(canvas, ed, animTime, tiltState.x, tiltState.y);
			if (result) baseImgEl.src = result;

			animFrame = requestAnimationFrame(frame);
		}

		animFrame = requestAnimationFrame(frame);

		return () => {
			running = false;
			if (animFrame) {
				cancelAnimationFrame(animFrame);
				animFrame = 0;
			}
		};
	});

	// Render overlay for foil/polychrome
	$effect(() => {
		const canvas = cardCanvas;
		const ed = edition;
		const hovering = tiltState.hovering;

		if (!canvas || !isOverlayEdition) return;

		const w = canvas.width;
		const h = canvas.height;
		const overlayEd = ed as 'foil' | 'polychrome';

		// Static render
		const staticResult = untrack(() => renderShaderOverlay(overlayEd, w, h, animTime, 0, 0));
		if (staticResult && overlayImgEl) overlayImgEl.src = staticResult;

		if (!hovering) return;

		let running = true;
		let lastTime = performance.now();

		function frame() {
			if (!running || !overlayImgEl) return;
			const now = performance.now();
			animTime += (now - lastTime) / 1000;
			lastTime = now;

			const result = renderShaderOverlay(overlayEd, w, h, animTime, tiltState.x, tiltState.y);
			if (result) overlayImgEl.src = result;

			animFrame = requestAnimationFrame(frame);
		}

		animFrame = requestAnimationFrame(frame);

		return () => {
			running = false;
			if (animFrame) {
				cancelAnimationFrame(animFrame);
				animFrame = 0;
			}
		};
	});
</script>

<div
	class={cn(
		'relative inline-block cursor-pointer select-none',
		disabled && 'pointer-events-none opacity-50',
		played && 'balatro-played',
		selected && '-translate-y-4',
		className
	)}
	style="width: {width}px; height: {height}px; border-radius: {width * 0.1}px; z-index: {tiltState.hovering ? 50 : selected ? 40 : 'auto'};"
	style:will-change="transform"
	use:tilt={{ state: tiltState }}
	onclick={handleClick}
	onkeydown={(e) => e.key === 'Enter' && handleClick()}
	role="button"
	tabindex={disabled ? -1 : 0}
>
	<!-- Layer 1: Base card art (always visible, unmodified for overlay editions) -->
	<img
		bind:this={baseImgEl}
		alt="{rank} of {suit}"
		class="absolute inset-0 h-full w-full"
		style="border-radius: {width * 0.1}px;"
		draggable="false"
	/>

	<!-- Layer 2: Edition shader overlay (foil/polychrome only) -->
	{#if isOverlayEdition}
		<img
			bind:this={overlayImgEl}
			alt=""
			class="pointer-events-none absolute inset-0 h-full w-full"
			style="border-radius: {width * 0.1}px; mix-blend-mode: {getBlendMode(edition)}; opacity: {getOverlayOpacity(edition)};"
			draggable="false"
		/>
	{/if}

	<!-- Holographic shine overlay (CSS, shader editions on hover) -->
	{#if edition !== 'base' && tiltState.hovering}
		{@const angle = Math.atan2(tiltState.y, tiltState.x) * (180 / Math.PI) + 90}
		{@const r = Math.sqrt(tiltState.x * tiltState.x + tiltState.y * tiltState.y)}
		<!-- Spectral rainbow + white shine -->
		<div
			class="pointer-events-none absolute inset-0 transition-opacity duration-300"
			style="
				border-radius: {width * 0.1}px;
				opacity: 0.5;
				background: linear-gradient(
					{angle}deg,
					transparent 15%,
					hsl({angle} 100% 80% / 70%) 35%,
					rgba(255,255,255,0.5) 50%,
					hsl({angle + 180} 100% 80% / 70%) 65%,
					transparent 85%
				);
				mix-blend-mode: overlay;
			"
		></div>
		<!-- Sparkle / glitter dot pattern -->
		<div
			class="pointer-events-none absolute inset-0 transition-opacity duration-300"
			style="
				border-radius: {width * 0.1}px;
				opacity: 0.3;
				background:
					repeating-conic-gradient(
						rgba(255,255,255,0.7) 0% 25%,
						transparent 25% 50%
					) 0 0 / 5px 5px,
					repeating-conic-gradient(
						rgba(255,255,255,0.5) 0% 25%,
						transparent 25% 50%
					) 2.5px 2.5px / 5px 5px;
				mix-blend-mode: hard-light;
				mask-image: linear-gradient(
					{angle}deg,
					rgba(0,0,0,0.7) 0%,
					transparent {50 + 50 * r}%
				);
				-webkit-mask-image: linear-gradient(
					{angle}deg,
					rgba(0,0,0,0.7) 0%,
					transparent {50 + 50 * r}%
				);
			"
		></div>
	{/if}

	<!-- Click flash overlay -->
	{#if showFlash}
		<div
			class="pointer-events-none absolute inset-0 balatro-click-flash"
			style="border-radius: {width * 0.1}px; background: white;"
		></div>
	{/if}

	<!-- Selection glow -->
	{#if selected}
		<div
			class="pointer-events-none absolute -inset-1"
			style="
				box-shadow: 0 0 20px 4px rgba(59, 130, 246, 0.5);
				border-radius: {width * 0.1 + 4}px;
			"
		></div>
	{/if}
</div>

<style>
	@keyframes click-flash {
		from {
			opacity: 0.4;
		}
		to {
			opacity: 0;
		}
	}

	.balatro-click-flash {
		animation: click-flash 150ms ease-out forwards;
	}

	@keyframes played-zoom {
		0% {
			transform: scale(1) translateY(0);
			opacity: 1;
		}
		100% {
			transform: scale(1.5) translateY(-80px);
			opacity: 0;
		}
	}

	:global(.balatro-played) {
		animation: played-zoom 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		pointer-events: none;
	}
</style>
