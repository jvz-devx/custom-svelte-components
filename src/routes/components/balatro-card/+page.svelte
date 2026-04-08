<script lang="ts">
	import { BalatroCard, CardArea, CrtOverlay, BalatroBackground } from '$lib/components/custom/balatro-card/index.js';
	import { Moveable } from '$lib/components/custom/balatro-card/moveable.svelte.js';
	import type { CardEdition, CardRank, CardSuit } from '$lib/components/custom/balatro-card/types.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	let docsOpen = $state(false);

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
				<button
					class="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/20"
					onclick={() => (docsOpen = true)}
				>
					Docs
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
				<Button variant="outline" size="sm" onclick={() => (docsOpen = true)}>
					Docs
				</Button>
			{/if}
		</div>
	</div>

	<!-- Game area -->
	{#snippet content()}
		<div class="relative z-10 mx-auto flex max-w-[900px] flex-col items-center gap-4 px-6 py-6">
			<!-- Sprite copyright banner -->
			<div class="mx-auto mb-4 max-w-[900px] rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm {isBalatro ? 'text-amber-200' : 'text-amber-800'}">
				This demo uses Balatro game sprites for illustration. Balatro is &copy; LocalThunk. Provide your own sprite assets for production use.
			</div>
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

<!-- Documentation Dialog -->
<Dialog.Root bind:open={docsOpen}>
	<Dialog.Content class="max-h-[85vh] max-w-3xl overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Balatro Card Components -- API Reference</Dialog.Title>
			<Dialog.Description>
				Component documentation and usage examples for the Balatro card system.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6 py-4">
			<!-- Overview -->
			<section>
				<h3 class="text-lg font-semibold">Overview</h3>
				<p class="mt-1 text-sm text-muted-foreground">
					Balatro-style card presentation system for Svelte 5. Includes T/VT dual-transform physics engine, WebGL2 edition shaders (foil, polychrome, negative, holo), hand fan layout with drag-to-reorder, CRT post-processing, and animated background shader. All physics and shader values ported from the original Balatro source code.
				</p>
			</section>

			<hr class="border-border" />

			<!-- BalatroCard -->
			<section>
				<h3 class="text-lg font-semibold"><code>BalatroCard</code></h3>
				<p class="mt-1 text-sm text-muted-foreground">Single card with edition shader effects.</p>
				<div class="mt-3 overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-border">
								<th class="py-2 pr-4 text-left font-medium">Prop</th>
								<th class="py-2 pr-4 text-left font-medium">Type</th>
								<th class="py-2 pr-4 text-left font-medium">Default</th>
								<th class="py-2 text-left font-medium">Description</th>
							</tr>
						</thead>
						<tbody class="text-muted-foreground">
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">rank</td><td class="py-1.5 pr-4">CardRank</td><td class="py-1.5 pr-4">'A'</td><td class="py-1.5">Card rank (A, 2-10, J, Q, K)</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">suit</td><td class="py-1.5 pr-4">CardSuit</td><td class="py-1.5 pr-4">'spades'</td><td class="py-1.5">Card suit</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">edition</td><td class="py-1.5 pr-4">CardEdition</td><td class="py-1.5 pr-4">'base'</td><td class="py-1.5">Shader edition (base, foil, polychrome, negative, holo)</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">width</td><td class="py-1.5 pr-4">number</td><td class="py-1.5 pr-4">150</td><td class="py-1.5">Card width in pixels (height auto: width * 47/35)</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">jokerPos</td><td class="py-1.5 pr-4">{'{col, row}'}</td><td class="py-1.5 pr-4">--</td><td class="py-1.5">If set, renders a joker sprite instead</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">selected</td><td class="py-1.5 pr-4">boolean</td><td class="py-1.5 pr-4">false</td><td class="py-1.5">Visual selection state</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">moveable</td><td class="py-1.5 pr-4">Moveable</td><td class="py-1.5 pr-4">--</td><td class="py-1.5">External Moveable for CardArea integration</td></tr>
							<tr><td class="py-1.5 pr-4 font-mono text-xs">cardIndex</td><td class="py-1.5 pr-4">number</td><td class="py-1.5 pr-4">0</td><td class="py-1.5">Unique index for per-card shader animation</td></tr>
						</tbody>
					</table>
				</div>
			</section>

			<hr class="border-border" />

			<!-- CardArea -->
			<section>
				<h3 class="text-lg font-semibold"><code>CardArea</code></h3>
				<p class="mt-1 text-sm text-muted-foreground">Layout container with physics and drag-to-reorder.</p>
				<div class="mt-3 overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-border">
								<th class="py-2 pr-4 text-left font-medium">Prop</th>
								<th class="py-2 pr-4 text-left font-medium">Type</th>
								<th class="py-2 pr-4 text-left font-medium">Default</th>
								<th class="py-2 text-left font-medium">Description</th>
							</tr>
						</thead>
						<tbody class="text-muted-foreground">
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">type</td><td class="py-1.5 pr-4">'hand' | 'play' | 'shop' | 'joker'</td><td class="py-1.5 pr-4">'hand'</td><td class="py-1.5">Layout algorithm</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">cards</td><td class="py-1.5 pr-4">Moveable[]</td><td class="py-1.5 pr-4">--</td><td class="py-1.5">Array of Moveables to position</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">areaWidth</td><td class="py-1.5 pr-4">number</td><td class="py-1.5 pr-4">--</td><td class="py-1.5">Container width (px)</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">areaHeight</td><td class="py-1.5 pr-4">number</td><td class="py-1.5 pr-4">--</td><td class="py-1.5">Container height (px)</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">cardW / cardH</td><td class="py-1.5 pr-4">number</td><td class="py-1.5 pr-4">--</td><td class="py-1.5">Card dimensions (px)</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">maxCards</td><td class="py-1.5 pr-4">number</td><td class="py-1.5 pr-4">cards.length</td><td class="py-1.5">Max slots for spread calculation</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">highlightLimit</td><td class="py-1.5 pr-4">number</td><td class="py-1.5 pr-4">5</td><td class="py-1.5">Max selectable cards</td></tr>
							<tr><td class="py-1.5 pr-4 font-mono text-xs">onCardClick</td><td class="py-1.5 pr-4">(index) =&gt; void</td><td class="py-1.5 pr-4">--</td><td class="py-1.5">Click callback</td></tr>
						</tbody>
					</table>
				</div>
			</section>

			<hr class="border-border" />

			<!-- Moveable -->
			<section>
				<h3 class="text-lg font-semibold"><code>Moveable</code></h3>
				<p class="mt-1 text-sm text-muted-foreground">Physics state object with T/VT dual transforms.</p>
				<pre class="mt-3 rounded bg-muted p-3 text-xs"><code>const m = new Moveable(x, y, w, h);
m.data = {'{'} rank: 'A', suit: 'spades', edition: 'foil' {'}'};
m.highlighted = true;  // raises card in hand
m.juiceUp(0.05, 0.03); // pop animation
m.flip();               // card flip</code></pre>
			</section>

			<hr class="border-border" />

			<!-- CrtOverlay -->
			<section>
				<h3 class="text-lg font-semibold"><code>CrtOverlay</code></h3>
				<p class="mt-1 text-sm text-muted-foreground">CSS scanline + vignette overlay.</p>
				<div class="mt-3 overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-border">
								<th class="py-2 pr-4 text-left font-medium">Prop</th>
								<th class="py-2 pr-4 text-left font-medium">Type</th>
								<th class="py-2 text-left font-medium">Default</th>
							</tr>
						</thead>
						<tbody class="text-muted-foreground">
							<tr><td class="py-1.5 pr-4 font-mono text-xs">intensity</td><td class="py-1.5 pr-4">number</td><td class="py-1.5">100 (0-100)</td></tr>
						</tbody>
					</table>
				</div>
			</section>

			<hr class="border-border" />

			<!-- BalatroBackground -->
			<section>
				<h3 class="text-lg font-semibold"><code>BalatroBackground</code></h3>
				<p class="mt-1 text-sm text-muted-foreground">Animated shader background.</p>
				<div class="mt-3 overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-border">
								<th class="py-2 pr-4 text-left font-medium">Prop</th>
								<th class="py-2 pr-4 text-left font-medium">Type</th>
								<th class="py-2 text-left font-medium">Default</th>
							</tr>
						</thead>
						<tbody class="text-muted-foreground">
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">colour1-3</td><td class="py-1.5 pr-4">[r,g,b,a]</td><td class="py-1.5">Balatro dark blue-grey</td></tr>
							<tr class="border-b border-border/50"><td class="py-1.5 pr-4 font-mono text-xs">contrast</td><td class="py-1.5 pr-4">number</td><td class="py-1.5">1</td></tr>
							<tr><td class="py-1.5 pr-4 font-mono text-xs">spinAmount</td><td class="py-1.5 pr-4">number</td><td class="py-1.5">0.3</td></tr>
						</tbody>
					</table>
				</div>
			</section>

			<hr class="border-border" />

			<!-- Editions -->
			<section>
				<h3 class="text-lg font-semibold">Editions</h3>
				<ul class="mt-2 space-y-1 text-sm text-muted-foreground">
					<li><strong>base</strong> -- No shader effect</li>
					<li><strong>foil</strong> -- Blue-silver metallic shimmer</li>
					<li><strong>polychrome</strong> -- Rainbow hue shift with Perlin noise field</li>
					<li><strong>negative</strong> -- HSL lightness inversion with brownish tint</li>
					<li><strong>holo</strong> -- Rainbow grid pattern overlay</li>
				</ul>
			</section>

			<hr class="border-border" />

			<!-- Quick Start -->
			<section>
				<h3 class="text-lg font-semibold">Quick Start</h3>
				<pre class="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs"><code>&lt;script&gt;
  import {'{'} BalatroCard, CardArea, Moveable {'}'} from '$lib/components/custom/balatro-card';

  const cards = Array.from({'{'} length: 5 {'}'}, () =&gt; {'{'}{'\n'}    const m = new Moveable(0, 0, 120, 163);
    m.data = {'{'} rank: 'A', suit: 'spades', edition: 'foil' {'}'};
    return m;
  {'}'});
&lt;/script&gt;

&lt;CardArea type="hand" {'{'}cards{'}'} areaWidth={'{'}700{'}'} areaHeight={'{'}250{'}'} cardW={'{'}120{'}'} cardH={'{'}163{'}'}&gt;
  {'{'}#each cards as card, i{'}'}
    &lt;BalatroCard
      rank={'{'}card.data.rank{'}'}
      suit={'{'}card.data.suit{'}'}
      edition={'{'}card.data.edition{'}'}
      width={'{'}120{'}'}
      cardIndex={'{'}i{'}'}
      moveable={'{'}card{'}'}
      selected={'{'}card.highlighted{'}'}
    /&gt;
  {'{'}\/each{'}'}
&lt;/CardArea&gt;</code></pre>
			</section>

			<hr class="border-border" />

			<!-- Sprites -->
			<section>
				<h3 class="text-lg font-semibold">Sprites</h3>
				<p class="mt-1 text-sm text-muted-foreground">
					The component uses a sprite atlas system. Provide your own sprite sheet at <code class="rounded bg-muted px-1 py-0.5 text-xs">/sprites/cards/playing-cards-sheet.png</code> (13 columns x 4 rows, 142x190px per tile) and joker sprites at <code class="rounded bg-muted px-1 py-0.5 text-xs">/sprites/jokers/joker_{'{col}'}x{'{row}'}.png</code>.
				</p>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
