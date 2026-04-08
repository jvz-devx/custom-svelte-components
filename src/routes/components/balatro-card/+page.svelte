<script lang="ts">
	import { BalatroCard, CardArea, CrtOverlay } from '$lib/components/custom/balatro-card/index.js';
	import { Moveable } from '$lib/components/custom/balatro-card/moveable.svelte.js';
	import type { CardEdition, CardRank, CardSuit } from '$lib/components/custom/balatro-card/types.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	const editions: CardEdition[] = ['base', 'foil', 'polychrome', 'negative', 'holo'];
	const suits: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
	const ranks: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

	let selectedEdition = $state<CardEdition>('foil');
	let selectedSuit = $state<CardSuit>('spades');
	let selectedRank = $state<CardRank>('A');
	let cardWidth = $state(150);
	let crtEnabled = $state(true);
	let crtIntensity = $state(100);

	// Hand demo — Moveable-based
	const HAND_CARD_W = 130;
	const HAND_CARD_H = Math.round(HAND_CARD_W * (47 / 35));
	const HAND_AREA_W = 800;
	const HAND_AREA_H = 300;

	const handData: { rank: CardRank; suit: CardSuit; edition: CardEdition }[] = [
		{ rank: 'A', suit: 'spades', edition: 'foil' },
		{ rank: 'K', suit: 'hearts', edition: 'polychrome' },
		{ rank: 'Q', suit: 'diamonds', edition: 'negative' },
		{ rank: 'J', suit: 'clubs', edition: 'base' },
		{ rank: '10', suit: 'spades', edition: 'foil' }
	];

	// Create Moveables for each hand card
	const handMoveables = handData.map(
		(_, i) => new Moveable(0, 0, HAND_CARD_W, HAND_CARD_H)
	);

	function toggleCard(index: number) {
		const m = handMoveables[index];
		m.highlighted = !m.highlighted;
	}

	// Count selected for display
	let selectedCount = $derived(handMoveables.filter((m) => m.highlighted).length);
</script>

<div class="p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-bold tracking-tight">Balatro Card</h1>
		<p class="text-sm text-muted-foreground">
			Balatro's exact presentation system: T/VT dual transforms, exponential damping, juice
			animations, hand fan layout with sine bob.
		</p>
	</div>

	<!-- Edition showcase -->
	<Card.Root class="mb-6">
		<Card.Header>
			<Card.Title class="text-sm">Editions</Card.Title>
			<Card.Description>Each edition applies a different GLSL fragment shader.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-wrap items-end justify-center gap-8 py-4">
				{#each editions as edition, i}
					<div class="flex flex-col items-center gap-3">
						<BalatroCard rank="A" suit="spades" {edition} width={cardWidth} cardIndex={i} />
						<Badge variant={edition === 'base' ? 'outline' : 'default'}>
							{edition}
						</Badge>
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Interactive config -->
	<Card.Root class="mb-6">
		<Card.Header>
			<Card.Title class="text-sm">Playground</Card.Title>
			<Card.Description>Configure a single card.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-wrap gap-8">
				<!-- Card preview -->
				<div class="flex items-center justify-center">
					<BalatroCard
						rank={selectedRank}
						suit={selectedSuit}
						edition={selectedEdition}
						width={cardWidth}
						cardIndex={10}
					/>
				</div>

				<!-- Controls -->
				<div class="flex-1 space-y-4">
					<div>
						<p class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Edition
						</p>
						<div class="flex flex-wrap gap-1">
							{#each editions as ed}
								<Button
									variant={selectedEdition === ed ? 'default' : 'outline'}
									size="sm"
									onclick={() => (selectedEdition = ed)}
								>
									{ed}
								</Button>
							{/each}
						</div>
					</div>

					<div>
						<p class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Suit
						</p>
						<div class="flex flex-wrap gap-1">
							{#each suits as s}
								<Button
									variant={selectedSuit === s ? 'default' : 'outline'}
									size="sm"
									onclick={() => (selectedSuit = s)}
								>
									{s}
								</Button>
							{/each}
						</div>
					</div>

					<div>
						<p class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Rank
						</p>
						<div class="flex flex-wrap gap-1">
							{#each ranks as r}
								<Button
									variant={selectedRank === r ? 'default' : 'outline'}
									size="sm"
									onclick={() => (selectedRank = r)}
									class="w-10"
								>
									{r}
								</Button>
							{/each}
						</div>
					</div>

					<div>
						<p class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Card Width
						</p>
						<div class="flex items-center gap-3">
							<input type="range" min="80" max="250" bind:value={cardWidth} class="flex-1" />
							<span class="w-14 text-right text-xs text-muted-foreground">{cardWidth}px</span>
						</div>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Hand demo with CardArea + CRT -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-sm">Hand</Card.Title>
			<Card.Description
				>Balatro's hand layout with exponential-damped movement. Click to select, drag to
				reorder.</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<div class="mb-3 flex items-center gap-4">
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={crtEnabled} />
					CRT Effect
				</label>
				{#if crtEnabled}
					<div class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground">Intensity</span>
						<input type="range" min="0" max="100" bind:value={crtIntensity} class="w-24" />
						<span class="w-8 text-right text-xs text-muted-foreground">{crtIntensity}%</span>
					</div>
				{/if}
			</div>
			{#if crtEnabled}
				<CrtOverlay intensity={crtIntensity}>
					<div class="flex justify-center pb-4 pt-6">
						<CardArea
							type="hand"
							cards={handMoveables}
							areaWidth={HAND_AREA_W}
							areaHeight={HAND_AREA_H}
							cardW={HAND_CARD_W}
							cardH={HAND_CARD_H}
						>
							{#each handData as card, i}
								<BalatroCard
									rank={card.rank}
									suit={card.suit}
									edition={card.edition}
									width={HAND_CARD_W}
									cardIndex={i}
									moveable={handMoveables[i]}
									selected={handMoveables[i].highlighted}
									onclick={() => toggleCard(i)}
								/>
							{/each}
						</CardArea>
					</div>
				</CrtOverlay>
			{:else}
				<div class="flex justify-center pb-4 pt-6">
					<CardArea
						type="hand"
						cards={handMoveables}
						areaWidth={HAND_AREA_W}
						areaHeight={HAND_AREA_H}
						cardW={HAND_CARD_W}
						cardH={HAND_CARD_H}
					>
						{#each handData as card, i}
							<BalatroCard
								rank={card.rank}
								suit={card.suit}
								edition={card.edition}
								width={HAND_CARD_W}
								cardIndex={i}
								moveable={handMoveables[i]}
								selected={handMoveables[i].highlighted}
								onclick={() => toggleCard(i)}
							/>
						{/each}
					</CardArea>
				</div>
			{/if}
			{#if selectedCount > 0}
				<div class="mt-4 flex items-center justify-center gap-2">
					<Badge variant="secondary">{selectedCount} selected</Badge>
					<Button
						variant="outline"
						size="sm"
						onclick={() => handMoveables.forEach((m) => (m.highlighted = false))}
					>
						Clear
					</Button>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
