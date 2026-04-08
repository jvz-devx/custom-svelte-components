<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Moveable } from './moveable.svelte.js';
	import { addApplyCallback, removeApplyCallback, getTime } from './animation-loop.js';

	type CardAreaProps = {
		type?: 'hand' | 'play' | 'shop' | 'joker';
		cards: Moveable[];
		areaWidth: number;
		areaHeight: number;
		cardW: number;
		cardH: number;
		maxCards?: number;
		rotationFactor?: number;
		children?: Snippet;
	};

	let {
		type = 'hand',
		cards,
		areaWidth,
		areaHeight,
		cardW,
		cardH,
		maxCards,
		rotationFactor,
		children
	}: CardAreaProps = $props();

	// Drag state
	let dragIndex: number | null = $state(null);
	let dragOffset = { x: 0, y: 0 };

	/**
	 * Layout uses pixel coordinates directly.
	 * The Balatro formulas are adapted: instead of game-unit T values,
	 * we compute pixel positions for the card area.
	 *
	 * Key Balatro hand layout (cardarea.lua:450-464):
	 *   rotation: 0.2 * (-count/2 - 0.5 + k) / count  (radians, small values)
	 *   x: spread across area width
	 *   y: centered + arc + sine bob + highlight lift
	 */
	function alignCards() {
		const count = cards.length;
		if (count === 0) return;

		// Scale physics velocity cap from Balatro game units (~2 unit card width) to pixel space
		const coordScale = cardW / 2.0;
		for (const card of cards) {
			card.coordinateScale = coordScale;
		}

		const TIME = getTime();
		const effectiveMax = maxCards ?? count;
		const highlightH = 0.2 * cardH; // HIGHLIGHT_H = 0.2 * CARD_H

		if (type === 'hand') {
			const rFactor = rotationFactor ?? 0.2;
			for (let i = 0; i < count; i++) {
				const card = cards[i];
				if (card.dragging) continue;
				const k = i + 1; // 1-indexed

				// X spread across area (cardarea.lua:456) — compute X first so sine can use it
				const maxC = Math.max(count, effectiveMax);
				card.T.x =
					(areaWidth - cardW) *
						((k - 1) / Math.max(maxC - 1, 1) -
							(0.5 * (count - maxC)) / Math.max(maxC - 1, 1)) +
					0.5 * (cardW - card.T.w);

				// Rotation (cardarea.lua:454) — use card.T.x for position-coupled phase
				card.T.r =
					rFactor * (-count / 2 - 0.5 + k) / count +
					0.02 * Math.sin(2 * TIME + card.T.x);

				// Y position: centered + highlight + sine bob + arc (cardarea.lua:460)
				const hH = card.highlighted ? highlightH : 0;
				const arc = Math.abs(0.5 * (-count / 2 + k - 0.5) / count);
				card.T.y =
					areaHeight / 2 -
					cardH / 2 -
					hH +
					3 * Math.sin(0.666 * TIME + card.T.x) + // sine bob — use card.T.x for position-coupled phase
					arc * cardH * 0.5 -
					cardH * 0.2; // offset: match Balatro's -0.2 (scaled to pixels)

				// Shadow parallax nudge (cardarea.lua:461: card.T.x += parallax.x / 30)
				card.T.x += card.shadowParallax.x / 30;
			}
			cards.sort((a, b) => a.T.x + a.T.w / 2 - (b.T.x + b.T.w / 2));
		} else if (type === 'play' || type === 'shop') {
			for (let i = 0; i < count; i++) {
				const card = cards[i];
				if (card.dragging) continue;
				const k = i + 1;

				card.T.r = 0;
				const maxC = Math.max(count, effectiveMax);
				card.T.x =
					(areaWidth - cardW) *
						((k - 1) / Math.max(maxC - 1, 1) -
							(0.5 * (count - maxC)) / Math.max(maxC - 1, 1)) +
					0.5 * (cardW - card.T.w);

				const hH = card.highlighted ? highlightH : 0;
				card.T.y = areaHeight / 2 - cardH / 2 - hH;
				card.T.x += card.shadowParallax.x / 30;
			}
			cards.sort((a, b) => a.T.x + a.T.w / 2 - (b.T.x + b.T.w / 2));
		} else if (type === 'joker') {
			for (let i = 0; i < count; i++) {
				const card = cards[i];
				if (card.dragging) continue;
				const k = i + 1;

				card.T.x = 0; // compute X first for sine phase
				if (count > 2) {
					card.T.x =
						(areaWidth - cardW) * ((k - 1) / (count - 1)) +
						0.5 * (cardW - card.T.w);
				} else if (count > 1) {
					card.T.x =
						(areaWidth - cardW) * ((k - 0.5) / count) +
						0.5 * (cardW - card.T.w);
				} else {
					card.T.x = areaWidth / 2 - cardW / 2 + 0.5 * (cardW - card.T.w);
				}

				card.T.r =
					0.1 * (-count / 2 - 0.5 + k) / count +
					0.02 * Math.sin(2 * TIME + card.T.x);

				const hH = card.highlighted ? highlightH / 2 : 0;
				card.T.y =
					areaHeight / 2 -
					cardH / 2 -
					hH +
					3 * Math.sin(0.666 * TIME + card.T.x);

				card.T.x += card.shadowParallax.x / 30;
			}
			cards.sort((a, b) => a.T.x + a.T.w / 2 - (b.T.x + b.T.w / 2));
		}
	}

	// Run layout every frame for TIME-dependent sine terms
	$effect(() => {
		// Initial layout
		alignCards();
		const cb = () => alignCards();
		addApplyCallback(cb);
		return () => removeApplyCallback(cb);
	});

	// --- Drag handling ---
	function handlePointerDown(e: PointerEvent) {
		// Find which card was clicked by checking positions
		const areaRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const clickX = e.clientX - areaRect.left;
		const clickY = e.clientY - areaRect.top;

		// Check cards in reverse order (top card first)
		for (let i = cards.length - 1; i >= 0; i--) {
			const card = cards[i];
			const cx = card.VT.x;
			const cy = card.VT.y;
			if (
				clickX >= cx &&
				clickX <= cx + card.VT.w &&
				clickY >= cy &&
				clickY <= cy + card.VT.h
			) {
				card.dragging = true;
				dragIndex = i;
				dragOffset.x = clickX - card.T.x;
				dragOffset.y = clickY - card.T.y;
				(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
				e.preventDefault();
				break;
			}
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (dragIndex === null) return;
		const card = cards[dragIndex];
		const areaRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		card.T.x = e.clientX - areaRect.left - dragOffset.x;
		card.T.y = e.clientY - areaRect.top - dragOffset.y;
	}

	function handlePointerUp() {
		if (dragIndex === null) return;
		cards[dragIndex].dragging = false;
		dragIndex = null;
		alignCards();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="card-area"
	style="width: {areaWidth}px; height: {areaHeight}px; position: relative;"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
>
	{@render children?.()}
</div>

<style>
	.card-area {
		touch-action: none;
		overflow: visible;
	}
</style>
