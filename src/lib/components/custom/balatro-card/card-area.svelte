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
		highlightLimit?: number;
		onCardClick?: (index: number) => void;
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
		highlightLimit = 5,
		onCardClick,
		children
	}: CardAreaProps = $props();

	// --- Balatro-style unified pointer system ---
	// Distance threshold: < MIN_CLICK_DIST → click, >= → drag
	const MIN_CLICK_DIST_PX = cardW * 0.45;

	let draggedCard: Moveable | null = $state(null);
	let pointerState: {
		card: Moveable;
		startX: number;
		startY: number;
		clickOffsetX: number;
		clickOffsetY: number;
		isDragging: boolean;
		pointerId: number;
	} | null = $state(null);

	// --- Layout ---
	// Balatro frame order: align_cards (position + sort) → then drag() updates cursor position.
	// The sort uses the PREVIOUS frame's drag position, not the current one.
	// This prevents oscillation because there's a 1-frame lag before the sort "sees" the new position.
	function alignCards() {
		const count = cards.length;
		if (count === 0) return;

		const coordScale = cardW / 2.0;
		for (const card of cards) {
			card.coordinateScale = coordScale;
		}

		const TIME = getTime();
		const effectiveMax = maxCards ?? count;
		const highlightH = 0.2 * cardH;

		if (type === 'hand') {
			const rFactor = rotationFactor ?? 0.2;
			for (let i = 0; i < count; i++) {
				const card = cards[i];
				if (card.dragging) continue;
				const k = i + 1;

				const maxC = Math.max(count, effectiveMax);
				card.T.x =
					(areaWidth - cardW) *
						((k - 1) / Math.max(maxC - 1, 1) -
							(0.5 * (count - maxC)) / Math.max(maxC - 1, 1)) +
					0.5 * (cardW - card.T.w);

				card.T.r =
					rFactor * (-count / 2 - 0.5 + k) / count +
					0.02 * Math.sin(2 * TIME + card.T.x);

				const hH = card.highlighted ? highlightH : 0;
				const arc = Math.abs(0.5 * (-count / 2 + k - 0.5) / count);
				card.T.y =
					areaHeight / 2 -
					cardH / 2 -
					hH +
					3 * Math.sin(0.666 * TIME + card.T.x) +
					arc * cardH * 0.5 -
					cardH * 0.2;

				card.T.x += card.shadowParallax.x / 30;
			}
			// Sort by center X every frame (Balatro: cardarea.lua:464)
			// The dragged card's T.x is from LAST frame's pointer position,
			// so this sort is stable (no same-frame feedback loop)
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

				card.T.x = 0;
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

	// alignCards runs in the apply phase (AFTER all Moveables tick).
	// Drag position updates happen in onPointerMove (BETWEEN frames via browser events).
	// This matches Balatro's order: align+sort first, then drag updates position for next frame.
	$effect(() => {
		alignCards();
		const cb = () => alignCards();
		addApplyCallback(cb);
		return () => removeApplyCallback(cb);
	});

	// --- Hit test ---
	function hitTestCard(clientX: number, clientY: number, areaRect: DOMRect): Moveable | null {
		const px = clientX - areaRect.left;
		const py = clientY - areaRect.top;

		for (let i = cards.length - 1; i >= 0; i--) {
			const card = cards[i];
			const cx = card.VT.x;
			const cy = card.VT.y;
			if (px >= cx && px <= cx + cardW && py >= cy && py <= cy + cardH) {
				return card;
			}
		}
		return null;
	}

	// --- Pointer handlers ---
	function onPointerDown(e: PointerEvent) {
		if (pointerState) return;
		const areaEl = e.currentTarget as HTMLElement;
		const areaRect = areaEl.getBoundingClientRect();
		const card = hitTestCard(e.clientX, e.clientY, areaRect);
		if (!card) return;

		const localX = e.clientX - areaRect.left;
		const localY = e.clientY - areaRect.top;

		pointerState = {
			card,
			startX: e.clientX,
			startY: e.clientY,
			clickOffsetX: localX - card.T.x,
			clickOffsetY: localY - card.T.y,
			isDragging: false,
			pointerId: e.pointerId,
		};

		areaEl.setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onPointerMove(e: PointerEvent) {
		if (!pointerState) return;

		const canDrag = type === 'hand' || type === 'joker';

		if (!pointerState.isDragging && canDrag) {
			const dx = e.clientX - pointerState.startX;
			const dy = e.clientY - pointerState.startY;
			if (Math.sqrt(dx * dx + dy * dy) >= MIN_CLICK_DIST_PX) {
				pointerState.isDragging = true;
				pointerState.card.dragging = true;
				pointerState.card.hovering = false; // Clear hover state (pointer capture blocks pointerleave)
				draggedCard = pointerState.card;
			}
		}

		if (pointerState.isDragging) {
			const areaRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			// Update T.x/T.y to follow cursor.
			// alignCards() already ran this frame (via addApplyCallback), so the sort
			// won't see this new position until NEXT frame — preventing oscillation.
			pointerState.card.T.x = e.clientX - areaRect.left - pointerState.clickOffsetX;
			pointerState.card.T.y = e.clientY - areaRect.top - pointerState.clickOffsetY;
		}
	}

	function onPointerUp(e: PointerEvent) {
		if (!pointerState) return;

		const card = pointerState.card;

		if (pointerState.isDragging) {
			card.dragging = false;
			draggedCard = null;
			// Card is already at the right array position (sorted during drag).
			// alignCards() will recalculate its layout position from its new index next frame.
		} else {
			// CLICK: toggle highlight (Balatro: card.lua:4610-4623)
			if (card.highlighted) {
				card.highlighted = false;
			} else {
				const currentHighlighted = cards.filter(c => c.highlighted).length;
				if (currentHighlighted < highlightLimit) {
					card.highlighted = true;
				}
			}
			const idx = cards.indexOf(card);
			if (idx >= 0) onCardClick?.(idx);
		}

		pointerState = null;
	}

	function onPointerCancel() {
		if (!pointerState) return;
		if (pointerState.isDragging) {
			pointerState.card.dragging = false;
			draggedCard = null;
		}
		pointerState = null;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="card-area"
	style="width: {areaWidth}px; height: {areaHeight}px; position: relative;"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerCancel}
>
	{@render children?.()}
</div>

<style>
	.card-area {
		touch-action: none;
		overflow: visible;
	}
</style>
