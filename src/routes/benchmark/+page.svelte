<script lang="ts">
	import { createHeightManager } from '$lib/components/custom/virtual-table/height-manager.svelte.js';
	import { createDomHeightManager } from '$lib/components/custom/virtual-table/height-manager-dom.svelte.js';
	import { createVirtualScroller } from '$lib/components/custom/virtual-table/virtual-scroller.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	const FONT = '14px Inter';
	const COLUMNS = ['name', 'email', 'role', 'department', 'notes'];
	const COL_WIDTH = 200;

	// --- Generate test data ---
	const shortTexts = [
		'Alice Smith', 'bob@example.com', 'Senior Engineer', 'Engineering',
		'Quick note', 'Jane Doe', 'test@test.com', 'Junior', 'Marketing', 'OK'
	];
	const longTexts = [
		'Dr. Alexander Bartholomew Christopher Davidson III, PhD',
		'a]very-long-email-address-that-might-wrap@extremely-long-domain-name-company.co.uk',
		'Distinguished Senior Principal Staff Software Architect & Technical Fellow',
		'Global Strategic Initiatives & Cross-Functional Innovation Department',
		'This is a much longer note that contains several sentences and should definitely wrap to multiple lines when rendered in a narrow column width.'
	];

	function generateRows(count: number, longTextRatio: number): Record<string, string>[] {
		const rows: Record<string, string>[] = [];
		for (let i = 0; i < count; i++) {
			const cells: Record<string, string> = {};
			for (const col of COLUMNS) {
				const useLong = Math.random() < longTextRatio;
				const source = useLong ? longTexts : shortTexts;
				cells[col] = source[Math.floor(Math.random() * source.length)];
			}
			rows.push(cells);
		}
		return rows;
	}

	// --- Benchmark state ---
	type BenchmarkResult = {
		name: string;
		prepareMs: number;
		layoutMs: number;
		scrollMs: number;
		totalMs: number;
		rowCount: number;
	};

	let results = $state<BenchmarkResult[]>([]);
	let running = $state(false);
	let rowCounts = $state([100, 500, 1000, 5000, 10000]);
	let iterations = $state(3);
	let longTextRatio = $state(0.3);
	let progress = $state('');

	async function runBenchmarks() {
		running = true;
		results = [];

		for (const count of rowCounts) {
			progress = `Generating ${count.toLocaleString()} rows...`;
			await tick();

			const testRows = generateRows(count, longTextRatio);

			// --- Pretext benchmark ---
			progress = `Benchmarking pretext with ${count.toLocaleString()} rows...`;
			await tick();

			const pretextResult = await benchmarkPretext(testRows, count);
			results = [...results, pretextResult];

			// --- DOM benchmark ---
			progress = `Benchmarking DOM with ${count.toLocaleString()} rows...`;
			await tick();

			const domResult = await benchmarkDom(testRows, count);
			results = [...results, domResult];
		}

		progress = 'Done!';
		running = false;
	}

	function tick(): Promise<void> {
		return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	}

	async function benchmarkPretext(
		testRows: Record<string, string>[],
		count: number
	): Promise<BenchmarkResult> {
		let totalPrepare = 0;
		let totalLayout = 0;
		let totalScroll = 0;

		for (let iter = 0; iter < iterations; iter++) {
			const hm = createHeightManager({ font: FONT });
			hm.onResize(COL_WIDTH);

			// Phase 1: prepare
			const prepStart = performance.now();
			for (let i = 0; i < testRows.length; i++) {
				hm.prepareRow(i, testRows[i]);
			}
			totalPrepare += performance.now() - prepStart;

			// Phase 2: layout (get all heights)
			const layoutStart = performance.now();
			for (let i = 0; i < testRows.length; i++) {
				hm.getRowHeight(i);
			}
			totalLayout += performance.now() - layoutStart;

			// Phase 3: simulate scroll — compute visible range at various positions
			const scroller = createVirtualScroller({
				getRowCount: () => count,
				getRowHeight: (i) => hm.getRowHeight(i),
				containerHeight: () => 600,
				scrollTop: () => 0,
				overscan: 10
			});

			const scrollStart = performance.now();
			// Simulate 50 scroll positions across the dataset
			const totalH = count * 40; // approximate
			for (let s = 0; s < 50; s++) {
				const scrollPos = (s / 50) * totalH;
				const localScroller = createVirtualScroller({
					getRowCount: () => count,
					getRowHeight: (i) => hm.getRowHeight(i),
					containerHeight: () => 600,
					scrollTop: () => scrollPos,
					overscan: 10
				});
				localScroller.compute();
			}
			totalScroll += performance.now() - scrollStart;
		}

		return {
			name: 'Pretext',
			prepareMs: totalPrepare / iterations,
			layoutMs: totalLayout / iterations,
			scrollMs: totalScroll / iterations,
			totalMs: (totalPrepare + totalLayout + totalScroll) / iterations,
			rowCount: count
		};
	}

	async function benchmarkDom(
		testRows: Record<string, string>[],
		count: number
	): Promise<BenchmarkResult> {
		let totalPrepare = 0;
		let totalLayout = 0;
		let totalScroll = 0;

		for (let iter = 0; iter < iterations; iter++) {
			const hm = createDomHeightManager({ font: FONT });
			hm.onResize(COL_WIDTH);

			// Phase 1: prepare (just stores text, no DOM work)
			const prepStart = performance.now();
			for (let i = 0; i < testRows.length; i++) {
				hm.prepareRow(i, testRows[i]);
			}
			totalPrepare += performance.now() - prepStart;

			// Phase 2: layout (forces DOM reflow per cell)
			const layoutStart = performance.now();
			for (let i = 0; i < testRows.length; i++) {
				hm.getRowHeight(i);
			}
			totalLayout += performance.now() - layoutStart;

			// Phase 3: simulate resize — clear cache and re-measure all
			// This simulates what happens on window resize
			const scrollStart = performance.now();
			for (let s = 0; s < 5; s++) {
				// Simulate resize by changing width slightly
				hm.onResize(COL_WIDTH + s * 10);
				for (let i = 0; i < Math.min(testRows.length, 200); i++) {
					hm.getRowHeight(i);
				}
			}
			totalScroll += performance.now() - scrollStart;

			hm.destroy();
		}

		return {
			name: 'DOM',
			prepareMs: totalPrepare / iterations,
			layoutMs: totalLayout / iterations,
			scrollMs: totalScroll / iterations,
			totalMs: (totalPrepare + totalLayout + totalScroll) / iterations,
			rowCount: count
		};
	}

	// Group results by row count for comparison
	let grouped = $derived(
		rowCounts
			.map((count) => {
				const pretext = results.find((r) => r.name === 'Pretext' && r.rowCount === count);
				const dom = results.find((r) => r.name === 'DOM' && r.rowCount === count);
				if (!pretext || !dom) return null;
				return {
					count,
					pretext,
					dom,
					speedup: dom.layoutMs / Math.max(pretext.layoutMs, 0.001)
				};
			})
			.filter(Boolean) as Array<{
			count: number;
			pretext: BenchmarkResult;
			dom: BenchmarkResult;
			speedup: number;
		}>
	);

	function fmt(ms: number): string {
		if (ms < 0.01) return '<0.01ms';
		if (ms < 1) return `${ms.toFixed(2)}ms`;
		if (ms < 100) return `${ms.toFixed(1)}ms`;
		return `${Math.round(ms)}ms`;
	}

	function barWidth(ms: number, maxMs: number): number {
		return Math.max(Math.min((ms / maxMs) * 100, 100), 2);
	}
</script>

<div class="min-h-screen bg-background">
	<div class="container mx-auto max-w-[1000px] px-4 py-6">
		<div class="mb-6">
			<h1 class="text-3xl font-bold tracking-tight">Height Measurement Benchmark</h1>
			<p class="mt-1 text-muted-foreground">
				Comparing pretext (canvas measureText) vs traditional DOM measurement (offsetHeight).
			</p>
		</div>

		<!-- Config -->
		<Card.Root class="mb-6">
			<Card.Content class="pt-4">
				<div class="flex flex-wrap items-end gap-6">
					<div class="space-y-1">
						<label for="bench-rows" class="text-xs text-muted-foreground">Row counts</label>
						<input
							id="bench-rows"
							type="text"
							value={rowCounts.join(', ')}
							onchange={(e) => {
								const val = (e.target as HTMLInputElement).value;
								rowCounts = val
									.split(',')
									.map((s) => parseInt(s.trim()))
									.filter((n) => !isNaN(n) && n > 0);
							}}
							class="h-8 w-60 rounded-md border bg-background px-2 text-sm"
						/>
					</div>
					<div class="space-y-1">
						<label for="bench-iter" class="text-xs text-muted-foreground">Iterations (avg)</label>
						<input
							id="bench-iter"
							type="number"
							bind:value={iterations}
							min="1"
							max="20"
							class="h-8 w-20 rounded-md border bg-background px-2 text-sm"
						/>
					</div>
					<div class="space-y-1">
						<label for="bench-ratio" class="text-xs text-muted-foreground">Long text ratio</label>
						<div class="flex items-center gap-2">
							<input
								id="bench-ratio"
								type="range"
								min="0"
								max="1"
								step="0.1"
								bind:value={longTextRatio}
								class="w-28"
							/>
							<span class="text-xs text-muted-foreground">{Math.round(longTextRatio * 100)}%</span>
						</div>
					</div>
					<Button onclick={runBenchmarks} disabled={running}>
						{running ? progress : 'Run Benchmark'}
					</Button>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Results -->
		{#if grouped.length > 0}
			<div class="space-y-6">
				<!-- Summary table -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Results Summary</Card.Title>
						<Card.Description>
							Average over {iterations} iteration{iterations > 1 ? 's' : ''}. {COLUMNS.length} columns
							per row. {Math.round(longTextRatio * 100)}% long text.
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b text-left text-muted-foreground">
										<th class="pb-2 pr-4 font-medium">Rows</th>
										<th class="pb-2 pr-4 font-medium">Method</th>
										<th class="pb-2 pr-4 text-right font-medium">Prepare</th>
										<th class="pb-2 pr-4 text-right font-medium">Layout</th>
										<th class="pb-2 pr-4 text-right font-medium">Resize/Scroll</th>
										<th class="pb-2 pr-4 text-right font-medium">Total</th>
										<th class="pb-2 text-right font-medium">Layout Speedup</th>
									</tr>
								</thead>
								<tbody>
									{#each grouped as g}
										<tr class="border-b">
											<td class="py-2 pr-4 font-mono" rowspan="2">
												{g.count.toLocaleString()}
											</td>
											<td class="py-2 pr-4">
												<Badge variant="default">Pretext</Badge>
											</td>
											<td class="py-2 pr-4 text-right font-mono">{fmt(g.pretext.prepareMs)}</td>
											<td class="py-2 pr-4 text-right font-mono">{fmt(g.pretext.layoutMs)}</td>
											<td class="py-2 pr-4 text-right font-mono">{fmt(g.pretext.scrollMs)}</td>
											<td class="py-2 pr-4 text-right font-mono">{fmt(g.pretext.totalMs)}</td>
											<td class="py-2 text-right" rowspan="2">
												<span class="text-lg font-bold" class:text-green-600={g.speedup > 1} class:text-red-600={g.speedup < 1}>
													{g.speedup.toFixed(1)}x
												</span>
											</td>
										</tr>
										<tr class="border-b">
											<td class="py-2 pr-4">
												<Badge variant="outline">DOM</Badge>
											</td>
											<td class="py-2 pr-4 text-right font-mono">{fmt(g.dom.prepareMs)}</td>
											<td class="py-2 pr-4 text-right font-mono">{fmt(g.dom.layoutMs)}</td>
											<td class="py-2 pr-4 text-right font-mono">{fmt(g.dom.scrollMs)}</td>
											<td class="py-2 pr-4 text-right font-mono">{fmt(g.dom.totalMs)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Visual comparison bars -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Layout Time Comparison</Card.Title>
						<Card.Description>
							This is the hot path — runs on every resize or scroll. Lower is better.
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						{#each grouped as g}
							{@const maxMs = Math.max(g.dom.layoutMs, g.pretext.layoutMs, 0.1)}
							<div>
								<div class="mb-1 flex items-center justify-between text-xs text-muted-foreground">
									<span>{g.count.toLocaleString()} rows</span>
									<span>{g.speedup.toFixed(1)}x faster</span>
								</div>
								<div class="space-y-1">
									<div class="flex items-center gap-2">
										<span class="w-16 text-right text-xs">Pretext</span>
										<div class="flex-1">
											<div
												class="h-5 rounded bg-primary transition-all"
												style="width: {barWidth(g.pretext.layoutMs, maxMs)}%"
											></div>
										</div>
										<span class="w-16 text-xs font-mono">{fmt(g.pretext.layoutMs)}</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="w-16 text-right text-xs">DOM</span>
										<div class="flex-1">
											<div
												class="h-5 rounded bg-muted-foreground/30 transition-all"
												style="width: {barWidth(g.dom.layoutMs, maxMs)}%"
											></div>
										</div>
										<span class="w-16 text-xs font-mono">{fmt(g.dom.layoutMs)}</span>
									</div>
								</div>
							</div>
						{/each}
					</Card.Content>
				</Card.Root>

				<!-- Prepare time comparison -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Prepare Time Comparison</Card.Title>
						<Card.Description>
							One-time cost when text first appears. Pretext uses canvas measureText; DOM just stores
							strings.
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						{#each grouped as g}
							{@const maxMs = Math.max(g.dom.prepareMs, g.pretext.prepareMs, 0.1)}
							<div>
								<div class="mb-1 text-xs text-muted-foreground">
									{g.count.toLocaleString()} rows
								</div>
								<div class="space-y-1">
									<div class="flex items-center gap-2">
										<span class="w-16 text-right text-xs">Pretext</span>
										<div class="flex-1">
											<div
												class="h-5 rounded bg-primary transition-all"
												style="width: {barWidth(g.pretext.prepareMs, maxMs)}%"
											></div>
										</div>
										<span class="w-16 text-xs font-mono">{fmt(g.pretext.prepareMs)}</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="w-16 text-right text-xs">DOM</span>
										<div class="flex-1">
											<div
												class="h-5 rounded bg-muted-foreground/30 transition-all"
												style="width: {barWidth(g.dom.prepareMs, maxMs)}%"
											></div>
										</div>
										<span class="w-16 text-xs font-mono">{fmt(g.dom.prepareMs)}</span>
									</div>
								</div>
							</div>
						{/each}
					</Card.Content>
				</Card.Root>

				<!-- Explanation -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">What's being measured</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-3 text-sm text-muted-foreground">
						<div>
							<p class="font-medium text-foreground">Prepare (one-time)</p>
							<p>
								<strong>Pretext:</strong> Segments text with Intl.Segmenter, measures each segment via
								canvas measureText(), caches widths. More upfront work.
							</p>
							<p>
								<strong>DOM:</strong> Just stores the text strings. No measurement yet — deferred to
								layout phase.
							</p>
						</div>
						<Separator />
						<div>
							<p class="font-medium text-foreground">Layout (hot path — every resize)</p>
							<p>
								<strong>Pretext:</strong> Pure arithmetic over cached widths. No DOM, no canvas, no
								string allocations. Sub-millisecond even for thousands of rows.
							</p>
							<p>
								<strong>DOM:</strong> Sets textContent on a hidden element, reads offsetHeight. Each
								read forces synchronous layout reflow. Cost grows linearly.
							</p>
						</div>
						<Separator />
						<div>
							<p class="font-medium text-foreground">Resize/Scroll simulation</p>
							<p>
								<strong>Pretext:</strong> 50 scroll positions computed via scroller. Pure math.
							</p>
							<p>
								<strong>DOM:</strong> 5 resize widths × 200 rows re-measured. Each triggers reflow.
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{/if}
	</div>
</div>
