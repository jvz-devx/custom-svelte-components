<script lang="ts">
	import { untrack } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { renderSpriteCard, renderJokerSprite, getCardSpriteRegion, NATIVE_CARD_W, NATIVE_CARD_H } from './sprite-atlas.js';
	import { renderShaderCard, renderShaderOverlay, renderDissolveCard, invalidateTexture, type ShaderUniforms, type DissolveUniforms } from './shader-renderer.js';
	import { Moveable } from './moveable.svelte.js';
	import { addApplyCallback, removeApplyCallback, getTime } from './animation-loop.js';
	import type { BalatroCardProps } from './types.js';

	let {
		rank = 'A',
		suit = 'spades',
		edition = 'base',
		width = 150,
		selected = false,
		disabled = false,
		played = false,
		cardIndex = 0,
		jokerPos,
		moveable: externalMoveable,
		onclick,
		class: className
	}: BalatroCardProps & { moveable?: Moveable } = $props();

	const height = $derived(Math.round(width * (47 / 35))); // Balatro card ratio 35:47

	// Use external Moveable if provided (from CardArea), otherwise create standalone
	let ownMoveable: Moveable | null = null;
	const mov = $derived.by(() => {
		if (externalMoveable) return externalMoveable;
		if (!ownMoveable) {
			ownMoveable = new Moveable(0, 0, width, height);
		}
		return ownMoveable;
	});

	// Sync highlighted state with selected prop
	$effect(() => {
		mov.highlighted = selected;
	});

	let cardEl = $state<HTMLElement | null>(null);
	let baseImgEl = $state<HTMLImageElement | null>(null);
	let overlayImgEl = $state<HTMLImageElement | null>(null);
	let flashEl = $state<HTMLDivElement | null>(null);
	let flashOpacity = 0;

	// Click/selection is handled by CardArea's unified pointer system.
	// No onclick handler on the card itself — avoids conflict with drag detection.

	// --- Pointer events for hover/tilt ---
	function onPointerEnter() {
		mov.hovering = true;
		mov.juiceUp(0.05, 0.03);
	}
	function onPointerLeave() {
		mov.hovering = false;
		tiltMx = 0;
		tiltMy = 0;
	}

	// Tilt tracking for shader shine
	let tiltMx = 0;
	let tiltMy = 0;
	// Mouse position in card-canvas pixel space for vertex bulge
	let mouseScreenX = 0;
	let mouseScreenY = 0;
	function onPointerMove(e: PointerEvent) {
		if (!cardEl) return;
		const rect = cardEl.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		tiltMx = (e.clientX - cx) / (rect.width / 2);
		tiltMy = (e.clientY - cy) / (rect.height / 2);
		// Map pointer to card-canvas pixel coordinates (2x resolution)
		mouseScreenX = ((e.clientX - rect.left) / rect.width) * width * 2;
		mouseScreenY = ((e.clientY - rect.top) / rect.height) * height * 2;
	}

	let animTime = 0;
	let baseAnimFrame = 0;
	let overlayAnimFrame = 0;

	// Generate card face canvas
	let cardCanvas = $state<HTMLCanvasElement | null>(null);

	$effect(() => {
		if (typeof document === 'undefined') return;
		// Render at native Balatro resolution (71x95) — shaders operate at this size
		// for the characteristic chunky pixel-art look. Displayed upscaled via CSS.
		if (jokerPos) {
			renderJokerSprite(jokerPos.col, jokerPos.row, NATIVE_CARD_W, NATIVE_CARD_H).then((c) => {
				cardCanvas = c;
			});
		} else {
			const r = rank, s = suit;
			renderSpriteCard(r, s, NATIVE_CARD_W, NATIVE_CARD_H).then((c) => {
				cardCanvas = c;
			});
		}
	});

	// Negative: full replacement shader (only edition that completely replaces the card texture)
	const isReplacementEdition = $derived(edition === 'negative');
	// Foil/polychrome/holo: rendered as ADDITIONAL shader pass on top of base card.
	// In Balatro, these are drawn via Love2D's framebuffer compositing — the shader
	// intentionally reduces alpha (tex.a = 0.3*tex.a + ...) because it blends ON TOP
	// of the already-rendered card. We render base card first, then overlay the edition.
	const isOverlayEdition = $derived(edition === 'foil' || edition === 'polychrome' || edition === 'holo');
	// Negative edition gets an additional negative_shine overlay (drawn on top in Balatro)
	const hasNegativeShine = $derived(edition === 'negative');

	let negShineImgEl = $state<HTMLImageElement | null>(null);
	let negShineAnimFrame = 0;

	// Balatro per-card time seed (sprite.lua:100): unique per card, used as the `time` uniform
	const cardTimeSeed = $derived((123.33412 * ((cardIndex + 1) / 1.14212)) % 3000);

	// Balatro send_to_shader (card.lua:4349-4350):
	// [1] = min(VT.r*3, 1) + TIME/28 + juice.r*20 + tilt_var.amt  (animated value)
	// [2] = TIME (raw timer)
	// These are sent as the per-shader vec2 uniform (foil, polychrome, negative, etc.)
	function getEditionParams(): [number, number] {
		const TIME = getTime();
		const vtR = Math.abs(mov.VT.r);
		const juiceR = mov.juice ? mov.juice.r * 20 : 0;
		return [
			Math.min(vtR * 3, 1) + TIME / 28 + juiceR + mov.tiltVar.amt,
			// Balatro's G.TIMERS.REAL is always > 0 after startup.
			// Ensure non-zero so negative shader's inversion check (negative.g != 0) works
			// even on the initial static render before animation frames tick.
			Math.max(TIME, 0.001)
		];
	}

	// Compute Balatro uniforms from current card state
	// IMPORTANT: Our cardCanvas is already a CROPPED card sprite, not the full atlas.
	// So texture_details should map vUv to identity (sprite fills entire texture).
	// In Balatro, texture_details maps from atlas UV to per-sprite UV.
	function getShaderUniforms(): ShaderUniforms {
		const canvasW = NATIVE_CARD_W;
		const canvasH = NATIVE_CARD_H;
		return {
			hovering: mov.hovering ? 1.0 : 0.0,
			// Balatro: G.TILESCALE * G.TILESIZE = 3.65 * 20 = 73
			screenScale: 73,
			textureDetails: [0, 0, canvasW, canvasH], // sprite at (0,0) filling entire texture
			imageDetails: [canvasW, canvasH],          // texture = card size
			dissolve: 0,
			shadow: false,
			burnColour1: [0, 0, 0, 0],
			burnColour2: [0, 0, 0, 0],
			editionParams: getEditionParams(),
		};
	}

	// Build dissolve uniforms with vertex bulge parameters
	function getDissolveUniforms(): DissolveUniforms {
		const base = getShaderUniforms();
		return {
			...base,
			hovering: mov.hovering ? 1.0 : 0.0,
			// Scale mouse position to native resolution (shader operates at 71x95)
			mouseScreenPos: [
				mouseScreenX * NATIVE_CARD_W / (width * 2),
				mouseScreenY * NATIVE_CARD_H / (height * 2)
			],
			resolution: [NATIVE_CARD_W, NATIVE_CARD_H],
			// Balatro: G.TILESCALE * G.TILESIZE ≈ 73. At native 71x95, this is close to the card width.
			screenScale: NATIVE_CARD_W,
		};
	}

	// Render base card image
	// Base/foil/polychrome/holo: render card art unmodified (overlays are separate)
	// Negative: full replacement shader pass
	$effect(() => {
		const canvas = cardCanvas;
		const ed = edition;
		const hovering = mov.hovering;

		if (!canvas || !baseImgEl) return;

		untrack(() => {
			invalidateTexture(canvas);
		});

		if (!isReplacementEdition) {
			// Base card: render through dissolve shader (identity pass, hover bulge active)
			const staticResult = untrack(() => renderDissolveCard(canvas, cardTimeSeed, 0, 0, getDissolveUniforms()));
			if (staticResult) baseImgEl.src = staticResult;
			else baseImgEl.src = canvas.toDataURL();

			if (!hovering) return;

			let running = true;
			let lastTime = performance.now();

			function frame() {
				if (!running || !canvas || !baseImgEl) return;
				const now = performance.now();
				animTime += (now - lastTime) / 1000;
				lastTime = now;
				const result = renderDissolveCard(canvas, cardTimeSeed, tiltMx, tiltMy, getDissolveUniforms());
				if (result) baseImgEl.src = result;
				baseAnimFrame = requestAnimationFrame(frame);
			}

			baseAnimFrame = requestAnimationFrame(frame);
			return () => { running = false; if (baseAnimFrame) { cancelAnimationFrame(baseAnimFrame); baseAnimFrame = 0; } };
		}

		// Edition shader: foil/polychrome/negative/holo — modifies card texture in-place
		// Always animate: edition_params changes every frame from ambient tilt orbit,
		// creating the subtle idle shimmer that Balatro cards have even without hovering.
		let running = true;
		let lastTime = performance.now();

		// Initial render
		const staticResult = untrack(() => renderShaderCard(canvas, ed, cardTimeSeed, 0, 0, cardTimeSeed, getDissolveUniforms()));
		if (staticResult) baseImgEl.src = staticResult;
		else baseImgEl.src = canvas.toDataURL();

		function frame() {
			if (!running || !canvas || !baseImgEl) return;
			const now = performance.now();
			animTime += (now - lastTime) / 1000;
			lastTime = now;
			const result = renderShaderCard(canvas, ed, cardTimeSeed, tiltMx, tiltMy, cardTimeSeed, getDissolveUniforms());
			if (result) baseImgEl.src = result;
			baseAnimFrame = requestAnimationFrame(frame);
		}

		baseAnimFrame = requestAnimationFrame(frame);
		return () => { running = false; if (baseAnimFrame) { cancelAnimationFrame(baseAnimFrame); baseAnimFrame = 0; } };
	});

	// Render edition overlay for foil/polychrome/holo (additive pass on top of base card)
	$effect(() => {
		const canvas = cardCanvas;
		const ed = edition;
		const hovering = mov.hovering;

		if (!canvas || !isOverlayEdition || !overlayImgEl) return;

		// Edition overlay: render the card through the edition shader.
		// The shader reduces alpha intentionally (foil: tex.a = 0.3*tex.a + shimmer),
		// which composites correctly as an overlay on top of the base card art.
		// Always animate for ambient tilt shimmer.
		let running = true;
		let lastTime = performance.now();

		const staticResult = untrack(() => renderShaderCard(canvas, ed, cardTimeSeed, 0, 0, cardTimeSeed, getDissolveUniforms()));
		if (staticResult) overlayImgEl.src = staticResult;

		function frame() {
			if (!running || !canvas || !overlayImgEl) return;
			const now = performance.now();
			animTime += (now - lastTime) / 1000;
			lastTime = now;
			const result = renderShaderCard(canvas, ed, cardTimeSeed, tiltMx, tiltMy, cardTimeSeed, getDissolveUniforms());
			if (result) overlayImgEl.src = result;
			overlayAnimFrame = requestAnimationFrame(frame);
		}

		overlayAnimFrame = requestAnimationFrame(frame);
		return () => { running = false; if (overlayAnimFrame) { cancelAnimationFrame(overlayAnimFrame); overlayAnimFrame = 0; } };
	});

	// Render negative_shine overlay (purple shimmer on top of negative card)
	// In Balatro, this is a second shader pass drawn after the base negative shader
	$effect(() => {
		const canvas = cardCanvas;
		const hovering = mov.hovering;

		if (!canvas || !hasNegativeShine || !negShineImgEl) return;

		const w = canvas.width;
		const h = canvas.height;

		const staticResult = untrack(() => renderShaderCard(canvas, 'negative_shine' as any, cardTimeSeed, 0, 0, cardTimeSeed, getDissolveUniforms()));
		if (staticResult) negShineImgEl.src = staticResult;

		if (!hovering) return;

		let running = true;
		let lastTime = performance.now();

		function frame() {
			if (!running || !canvas || !negShineImgEl) return;
			const now = performance.now();
			animTime += (now - lastTime) / 1000;
			lastTime = now;
			const result = renderShaderCard(canvas, 'negative_shine' as any, cardTimeSeed, tiltMx, tiltMy, cardTimeSeed, getDissolveUniforms());
			if (result) negShineImgEl.src = result;
			negShineAnimFrame = requestAnimationFrame(frame);
		}

		negShineAnimFrame = requestAnimationFrame(frame);
		return () => { running = false; if (negShineAnimFrame) { cancelAnimationFrame(negShineAnimFrame); negShineAnimFrame = 0; } };
	});

	// Apply VT transform every frame
	$effect(() => {
		if (!cardEl) return;
		const isInArea = !!externalMoveable;

		// Set initial position mode
		if (isInArea) {
			cardEl.style.position = 'absolute';
			cardEl.style.transformOrigin = 'center center';
		}

		const cb = () => {
			if (!cardEl) return;
			const VT = mov.VT;

			// Flash decay
			if (flashOpacity > 0.001) {
				flashOpacity *= 0.85;
				if (flashOpacity < 0.001) flashOpacity = 0;
				if (flashEl) flashEl.style.opacity = String(flashOpacity);
			}

			// Ambient tilt (card.lua:4379-4384)
			const TIME = getTime();
			const id = cardIndex;
			let tiltAmt = 0;
			if (mov.hovering) {
				tiltAmt = Math.abs(tiltMy + tiltMx - 1) * 0.3;
			} else if (mov.ambientTilt) {
				const tiltAngle = TIME * (1.56 + (id / 1.14212) % 1) + id / 1.35122;
				tiltAmt = mov.ambientTilt * (0.5 + Math.cos(tiltAngle)) * 0.3;
			}
			mov.tiltVar.amt = tiltAmt;

			// Shadow (card.lua:4360-4363)
			const shadowX = mov.shadowParallax.x * 2;
			const shadowY = mov.shadowHeight * 20;
			const shadowBlur = mov.hovering ? 25 : 12;
			const shadowAlpha = mov.hovering ? 0.4 : 0.25;

			// Build transform
			const transforms: string[] = [];
			if (isInArea) {
				transforms.push(`translate(${VT.x}px, ${VT.y}px)`);
			}
			transforms.push(`rotate(${VT.r}rad)`);
			transforms.push(`scale(${VT.scale})`);

			// Pinch width for flip animation
			if (VT.w < mov.T.w && mov.T.w > 0) {
				transforms.push(`scaleX(${VT.w / mov.T.w})`);
			}

			cardEl.style.transform = transforms.join(' ');
			cardEl.style.boxShadow = `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0,0,0,${shadowAlpha})`;
			cardEl.style.zIndex = mov.dragging ? '100' : mov.hovering ? '50' : mov.highlighted ? '40' : 'auto';
		};
		addApplyCallback(cb);
		return () => removeApplyCallback(cb);
	});

	// Cleanup
	$effect(() => {
		return () => {
			if (ownMoveable) {
				ownMoveable.destroy();
				ownMoveable = null;
			}
		};
	});
</script>

<div
	bind:this={cardEl}
	class={cn(
		'relative inline-block cursor-pointer select-none',
		disabled && 'pointer-events-none opacity-50',
		className
	)}
	style="width: {width}px; height: {height}px; border-radius: {width * 0.1}px;"
	style:will-change="transform"
	onpointerenter={onPointerEnter}
	onpointerleave={onPointerLeave}
	onpointermove={onPointerMove}
	role="img"
	tabindex={disabled ? -1 : 0}
>
	<!-- Layer 1: Base card art -->
	<img
		bind:this={baseImgEl}
		alt="{rank} of {suit}"
		class="absolute inset-0 h-full w-full"
		style="border-radius: {width * 0.1}px; image-rendering: pixelated;"
		draggable="false"
	/>

	<!-- Layer 2: Edition overlay (foil/polychrome/holo — shader pass composited on top) -->
	<!-- The shader itself controls alpha (e.g. foil: tex.a = 0.3*tex.a + shimmer). -->
	<!-- Standard alpha compositing, no CSS blend mode needed. -->
	{#if isOverlayEdition}
		<img
			bind:this={overlayImgEl}
			alt=""
			class="pointer-events-none absolute inset-0 h-full w-full"
			style="border-radius: {width * 0.1}px; image-rendering: pixelated;"
			draggable="false"
		/>
	{/if}

	<!-- Layer 2b: Negative shine overlay (purple shimmer for negative edition) -->
	{#if hasNegativeShine}
		<img
			bind:this={negShineImgEl}
			alt=""
			class="pointer-events-none absolute inset-0 h-full w-full"
			style="border-radius: {width * 0.1}px; mix-blend-mode: screen; opacity: 0.5;"
			draggable="false"
		/>
	{/if}

	<!-- Holographic shine overlay (CSS, shader editions on hover) -->
	{#if edition !== 'base' && mov.hovering}
		{@const angle = Math.atan2(tiltMy, tiltMx) * (180 / Math.PI) + 90}
		{@const r = Math.sqrt(tiltMx * tiltMx + tiltMy * tiltMy)}
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
	<div
		bind:this={flashEl}
		class="pointer-events-none absolute inset-0"
		style="border-radius: {width * 0.1}px; background: white; opacity: 0;"
	></div>

	<!-- Selection: Balatro only raises the card (via HIGHLIGHT_H in CardArea layout). No glow. -->
</div>
