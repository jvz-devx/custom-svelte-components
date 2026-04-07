<script lang="ts">
	import { BalatroCard } from '$lib/components/custom/balatro-card/index.js';
	import type { CardEdition, CardRank, CardSuit } from '$lib/components/custom/balatro-card/types.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	const editions: CardEdition[] = ['base', 'foil', 'polychrome', 'negative'];
	const suits: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
	const ranks: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

	let selectedEdition = $state<CardEdition>('foil');
	let selectedSuit = $state<CardSuit>('spades');
	let selectedRank = $state<CardRank>('A');
	let cardWidth = $state(150);
	let useSprites = $state(false);
	let selectedCards = $state<Set<number>>(new Set());

	function toggleCard(index: number) {
		const next = new Set(selectedCards);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		selectedCards = next;
	}

	// Sample hand
	const hand: { rank: CardRank; suit: CardSuit; edition: CardEdition }[] = [
		{ rank: 'A', suit: 'spades', edition: 'foil' },
		{ rank: 'K', suit: 'hearts', edition: 'polychrome' },
		{ rank: 'Q', suit: 'diamonds', edition: 'negative' },
		{ rank: 'J', suit: 'clubs', edition: 'base' },
		{ rank: '10', suit: 'spades', edition: 'foil' }
	];
</script>

<div class="p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-bold tracking-tight">Balatro Card</h1>
		<p class="text-sm text-muted-foreground">
			GPU-rendered card effects with Threlte (Three.js). Hover for tilt parallax, shader-based
			editions.
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
				{#each editions as edition}
					<div class="flex flex-col items-center gap-3">
						<BalatroCard rank="A" suit="spades" {edition} width={cardWidth} {useSprites} />
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
						{useSprites}
					/>
				</div>

				<!-- Controls -->
				<div class="flex-1 space-y-4">
					<!-- Edition -->
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

					<!-- Suit -->
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

					<!-- Rank -->
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

					<!-- Sprites -->
					<div>
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" bind:checked={useSprites} />
							Use sprites
						</label>
					</div>

					<!-- Size -->
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

	<!-- Hand demo -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-sm">Hand</Card.Title>
			<Card.Description>Click cards to select. Shows hover tilt + selection state.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="card-hand flex items-end justify-center py-6">
				{#each hand as card, i}
					<div class="card-in-hand">
						<BalatroCard
							rank={card.rank}
							suit={card.suit}
							edition={card.edition}
							width={130}
							{useSprites}
							selected={selectedCards.has(i)}
							onclick={() => toggleCard(i)}
						/>
					</div>
				{/each}
			</div>
			{#if selectedCards.size > 0}
				<div class="mt-4 flex items-center justify-center gap-2">
					<Badge variant="secondary">{selectedCards.size} selected</Badge>
					<Button variant="outline" size="sm" onclick={() => (selectedCards = new Set())}>
						Clear
					</Button>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<style>
	.card-in-hand {
		margin: 0 -12px;
		transition: margin 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.card-hand:hover .card-in-hand {
		margin: 0 4px;
	}

	.card-in-hand:hover {
		margin: 0 16px;
	}
</style>
