<script lang="ts" generics="T extends Record<string, unknown>">
	import { cn } from '$lib/utils.js';
	import EditableCell from './editable-cell.svelte';
	import { createVirtualScroller } from './virtual-scroller.svelte.js';
	import { createHeightManager } from './height-manager.svelte.js';
	import type { ColumnDef, SortState } from './types.js';

	type Props = {
		columns: ColumnDef<T>[];
		rows: T[];
		totalCount: number;
		sort?: SortState;
		filter?: string;
		height?: string;
		font?: string;
		editable?: boolean;
		onSort?: (sort: SortState) => void;
		onRangeChange?: (offset: number, limit: number) => void;
		onUpdate?: (row: T, key: string, value: unknown) => void;
		onDelete?: (row: T) => void;
		class?: string;
	};

	let {
		columns,
		rows,
		totalCount,
		sort = null,
		filter = '',
		height = '600px',
		font = '14px Inter',
		editable = false,
		onSort,
		onRangeChange,
		onUpdate,
		onDelete,
		class: className
	}: Props = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let scrollTop = $state(0);
	let containerHeight = $state(0);
	let containerWidth = $state(0);

	const heightManager = $derived(createHeightManager({ font }));

	const scroller = createVirtualScroller({
		getRowCount: () => totalCount,
		getRowHeight: (i: number) => heightManager.getRowHeight(i),
		containerHeight: () => containerHeight,
		scrollTop: () => scrollTop,
		overscan: 10
	});

	// Prepare row heights whenever rows change
	$effect(() => {
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const cells: Record<string, string> = {};
			for (const col of columns) {
				const val = row[col.key];
				cells[col.key] = col.render ? col.render(val, row) : String(val ?? '');
			}
			// Use the actual row index in the full dataset
			const globalIndex = virtualRange.start + i;
			heightManager.prepareRow(globalIndex, cells);
		}
	});

	// Handle resize
	$effect(() => {
		if (containerWidth > 0) {
			const colWidth = containerWidth / Math.max(columns.length, 1);
			heightManager.onResize(colWidth);
		}
	});

	// Compute virtual range
	let virtualRange = $derived(scroller.compute());

	// Notify parent when visible range changes
	$effect(() => {
		const { start, end } = virtualRange;
		onRangeChange?.(start, end - start);
	});

	// ResizeObserver for container
	$effect(() => {
		if (!containerEl) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerHeight = entry.contentRect.height;
				containerWidth = entry.contentRect.width;
			}
		});
		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	function handleScroll(e: Event) {
		const target = e.target as HTMLDivElement;
		scrollTop = target.scrollTop;
	}

	function handleSort(col: ColumnDef<T>) {
		if (!col.sortable || !onSort) return;
		if (sort?.key === col.key) {
			onSort(sort.direction === 'asc' ? { key: col.key, direction: 'desc' } : null);
		} else {
			onSort({ key: col.key, direction: 'asc' });
		}
	}

	function handleCellCommit(row: T, col: ColumnDef<T>, value: unknown) {
		onUpdate?.(row, col.key, value);
	}

	function getColumnStyle(col: ColumnDef<T>): string {
		if (col.width) {
			const w = typeof col.width === 'number' ? `${col.width}px` : col.width;
			return `width:${w};min-width:${w};max-width:${w};`;
		}
		return `flex:1;min-width:100px;`;
	}
</script>

<div class={cn('rounded-md border', className)}>
	<!-- Header -->
	<div class="border-b bg-muted/50">
		<div class="flex">
			{#each columns as col}
				{#if col.sortable}
					<button
						class="flex items-center p-2 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground"
						style={getColumnStyle(col)}
						onclick={() => handleSort(col)}
					>
						{col.header}
						{#if sort?.key === col.key}
							<span class="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>
						{/if}
					</button>
				{:else}
					<div
						class="flex items-center p-2 text-sm font-medium text-muted-foreground"
						style={getColumnStyle(col)}
					>
						{col.header}
					</div>
				{/if}
			{/each}
			{#if editable && onDelete}
				<div class="w-20 p-2 text-sm font-medium text-muted-foreground">Actions</div>
			{/if}
		</div>
	</div>

	<!-- Virtual scroll container -->
	<div
		bind:this={containerEl}
		class="overflow-y-auto"
		style="height:{height};"
		onscroll={handleScroll}
	>
		<!-- Spacer for total height -->
		<div style="height:{virtualRange.totalHeight}px;position:relative;">
			<!-- Visible rows -->
			<div style="position:absolute;top:0;left:0;right:0;transform:translateY({virtualRange.offsetY}px);">
				{#each rows as row, i (row.id ?? i)}
					<div class="flex border-b transition-colors hover:bg-muted/50">
						{#each columns as col}
							<div class="flex items-center p-2 text-sm" style={getColumnStyle(col)}>
								<EditableCell
									value={col.render ? col.render(row[col.key], row) : row[col.key]}
									type={col.type}
									options={col.options}
									editable={editable && (col.editable !== false)}
									oncommit={(value) => handleCellCommit(row, col, value)}
								/>
							</div>
						{/each}
						{#if editable && onDelete}
							<div class="flex w-20 items-center p-2">
								<button
									class="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
									onclick={() => onDelete(row)}
								>
									Delete
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
