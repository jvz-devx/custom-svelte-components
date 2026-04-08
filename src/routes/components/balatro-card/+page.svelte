<script lang="ts">
	import { BalatroCard, CardArea, CrtOverlay, BalatroBackground } from '$lib/components/custom/balatro-card/index.js';
	import { Moveable } from '$lib/components/custom/balatro-card/moveable.svelte.js';
	import type { CardEdition, CardRank, CardSuit } from '$lib/components/custom/balatro-card/types.js';
	import { Button } from '$lib/components/ui/button/index.js';

	const CARD_W = 110;
	const CARD_H = Math.round(CARD_W * (47 / 35));
	const HAND_AREA_W = 800;
	const HAND_AREA_H = 260;
	const PLAY_AREA_W = 600;
	const PLAY_AREA_H = 200;
	const JOKER_AREA_W = 600;
	const JOKER_AREA_H = 200;

	const RANKS: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
	const SUITS: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
	const EDITIONS: CardEdition[] = ['base', 'base', 'base', 'base', 'foil', 'polychrome', 'negative', 'holo'];

	// Card data is stored ON the Moveable via .data so that when CardArea sorts
	// the Moveables array (for drag reordering), the card data moves with it.
	function makeHandCard(): Moveable {
		const m = new Moveable(0, 0, CARD_W, CARD_H);
		m.data = {
			rank: RANKS[Math.floor(Math.random() * RANKS.length)],
			suit: SUITS[Math.floor(Math.random() * SUITS.length)],
			edition: EDITIONS[Math.floor(Math.random() * EDITIONS.length)],
		};
		return m;
	}

	// Theme & CRT state
	let theme = $state<'balatro' | 'shadcn'>('balatro');
	let crtEnabled = $state(true);
	const isBalatro = $derived(theme === 'balatro');

	// Hand: single array of Moveables (card data lives in .data)
	let hand = $state<Moveable[]>(Array.from({ length: 8 }, makeHandCard));

	// Play area
	let playArea = $state<Moveable[]>([]);

	// Jokers
	const jokerDefs = [
		{ col: 0, row: 0, edition: 'foil' as CardEdition },
		{ col: 1, row: 0, edition: 'holo' as CardEdition },
		{ col: 2, row: 0, edition: 'polychrome' as CardEdition },
		{ col: 3, row: 0, edition: 'base' as CardEdition },
		{ col: 7, row: 0, edition: 'negative' as CardEdition },
	];
	let jokers = $state<Moveable[]>(jokerDefs.map((j) => {
		const m = new Moveable(0, 0, CARD_W, CARD_H);
		m.data = j;
		return m;
	}));

	let selectedCount = $derived(hand.filter((m) => m.highlighted).length);

	function playHand() {
		const selected = hand.filter((m) => m.highlighted);
		if (selected.length === 0) return;
		// Create new Moveables for play area (fresh physics state)
		const played = selected.map((m) => {
			const p = new Moveable(0, 0, CARD_W, CARD_H);
			p.data = { ...m.data };
			return p;
		});
		playArea = [...playArea, ...played];
		hand = hand.filter((m) => !m.highlighted);
	}

	function discardSelected() {
		hand = hand.filter((m) => !m.highlighted);
	}

	function drawCards() {
		const drawCount = Math.min(8 - hand.length, 3);
		if (drawCount <= 0) return;
		const newCards = Array.from({ length: drawCount }, makeHandCard);
		hand = [...hand, ...newCards];
	}

	function clearPlayArea() {
		playArea = [];
	}
</script>

<div
	class="relative min-h-screen transition-colors duration-300"
	class:bg-background={!isBalatro}
>
	{#if isBalatro}
		<BalatroBackground />
	{/if}
	<!-- Top bar -->
	<div
		class="relative z-10 flex items-center justify-between border-b px-6 py-3 {isBalatro ? 'border-white/10' : 'border-border'}"
	>
		<h1
			class="text-xl font-bold tracking-tight"
			class:text-white={isBalatro}
			class:text-foreground={!isBalatro}
		>
			Balatro Card Demo
		</h1>
		<div class="flex items-center gap-2">
			{#if isBalatro}
				<button
					class="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/20"
					onclick={() => (theme = 'shadcn')}
				>
					Theme: Balatro
				</button>
				<button
					class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {crtEnabled
						? 'bg-amber-600 text-white'
						: 'bg-white/10 text-white/90'} hover:bg-amber-500"
					onclick={() => (crtEnabled = !crtEnabled)}
				>
					CRT {crtEnabled ? 'ON' : 'OFF'}
				</button>
			{:else}
				<Button variant="outline" size="sm" onclick={() => (theme = 'balatro')}>
					Theme: shadcn
				</Button>
				<Button
					variant={crtEnabled ? 'default' : 'outline'}
					size="sm"
					onclick={() => (crtEnabled = !crtEnabled)}
				>
					CRT {crtEnabled ? 'ON' : 'OFF'}
				</Button>
			{/if}
		</div>
	</div>

	<!-- Game area -->
	{#snippet content()}
		<div class="relative z-10 mx-auto flex max-w-[900px] flex-col items-center gap-4 px-6 py-6">
			<!-- Joker bar -->
			<div class="flex flex-col items-center gap-1">
				<span
					class="text-xs font-semibold uppercase tracking-widest {isBalatro ? 'text-white/40' : 'text-muted-foreground'}"
				>
					Jokers
				</span>
				<CardArea
					type="joker"
					cards={jokers}
					areaWidth={JOKER_AREA_W}
					areaHeight={JOKER_AREA_H}
					cardW={CARD_W}
					cardH={CARD_H}
				>
					{#each jokers as j, i}
						<BalatroCard
							jokerPos={{ col: j.data.col, row: j.data.row }}
							edition={j.data.edition}
							width={CARD_W}
							cardIndex={i + 100}
							moveable={j}
						/>
					{/each}
				</CardArea>
			</div>

			<!-- Play area -->
			<div class="flex flex-col items-center gap-1">
				<span
					class="text-xs font-semibold uppercase tracking-widest {isBalatro ? 'text-white/40' : 'text-muted-foreground'}"
				>
					Played
				</span>
				{#if playArea.length > 0}
					<CardArea
						type="play"
						cards={playArea}
						areaWidth={PLAY_AREA_W}
						areaHeight={PLAY_AREA_H}
						cardW={CARD_W}
						cardH={CARD_H}
					>
						{#each playArea as p, i}
							<BalatroCard
								rank={p.data.rank}
								suit={p.data.suit}
								edition={p.data.edition}
								width={CARD_W}
								cardIndex={i + 200}
								moveable={p}
							/>
						{/each}
					</CardArea>
				{:else}
					<div
						class="flex items-center justify-center rounded-xl border-2 border-dashed {isBalatro ? 'border-white/10' : 'border-border'}"
						style="width: {PLAY_AREA_W}px; height: {PLAY_AREA_H}px;"
					>
						<span
							class="text-sm {isBalatro ? 'text-white/20' : 'text-muted-foreground'}"
						>
							Select cards and play
						</span>
					</div>
				{/if}
			</div>

			<!-- Action buttons -->
			<div class="flex items-center gap-3">
				{#if isBalatro}
					<button
						class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:bg-blue-600 active:scale-95 disabled:opacity-40"
						onclick={playHand}
						disabled={selectedCount === 0}
					>
						Play Hand
					</button>
					<button
						class="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:bg-red-600 active:scale-95 disabled:opacity-40"
						onclick={discardSelected}
						disabled={selectedCount === 0}
					>
						Discard
					</button>
					<button
						class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:bg-emerald-600 active:scale-95 disabled:opacity-40"
						onclick={drawCards}
						disabled={hand.length >= 8}
					>
						Draw
					</button>
					{#if playArea.length > 0}
						<button
							class="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-white/80 shadow-lg transition-transform hover:bg-white/20 active:scale-95"
							onclick={clearPlayArea}
						>
							Clear
						</button>
					{/if}
				{:else}
					<Button onclick={playHand} disabled={selectedCount === 0}>Play Hand</Button>
					<Button variant="destructive" onclick={discardSelected} disabled={selectedCount === 0}>Discard</Button>
					<Button variant="secondary" onclick={drawCards} disabled={hand.length >= 8}>Draw</Button>
					{#if playArea.length > 0}
						<Button variant="outline" onclick={clearPlayArea}>Clear</Button>
					{/if}
				{/if}
			</div>

			<!-- Hand -->
			<div class="flex flex-col items-center gap-1">
				<span
					class="text-xs font-semibold uppercase tracking-widest {isBalatro ? 'text-white/40' : 'text-muted-foreground'}"
				>
					Hand ({hand.length}/8)
				</span>
				{#if hand.length > 0}
					<CardArea
						type="hand"
						cards={hand}
						areaWidth={HAND_AREA_W}
						areaHeight={HAND_AREA_H}
						cardW={CARD_W}
						cardH={CARD_H}
						maxCards={8}
					>
						{#each hand as m, i}
							<BalatroCard
								rank={m.data.rank}
								suit={m.data.suit}
								edition={m.data.edition}
								width={CARD_W}
								cardIndex={i}
								moveable={m}
								selected={m.highlighted}
							/>
						{/each}
					</CardArea>
				{:else}
					<div
						class="flex items-center justify-center rounded-xl border-2 border-dashed {isBalatro ? 'border-white/10' : 'border-border'}"
						style="width: {HAND_AREA_W}px; height: {HAND_AREA_H}px;"
					>
						<span
							class="text-sm {isBalatro ? 'text-white/20' : 'text-muted-foreground'}"
						>
							Click Draw to get cards
						</span>
					</div>
				{/if}
			</div>
		</div>
	{/snippet}

	{#if crtEnabled}
		<CrtOverlay>
			{@render content()}
		</CrtOverlay>
	{:else}
		{@render content()}
	{/if}
</div>
