import { prepare, layout, type PreparedText } from '@chenglou/pretext';

type CellCache = {
	prepared: PreparedText;
	text: string;
};

const DEFAULT_ROW_HEIGHT = 40;
const CELL_PADDING = 24; // 12px padding on each side
const LINE_HEIGHT = 20;

export function createHeightManager(opts: { font: string; defaultHeight?: number }) {
	const font = opts.font;
	const defaultHeight = opts.defaultHeight ?? DEFAULT_ROW_HEIGHT;

	// Map<rowIndex, Map<columnKey, CellCache>>
	const cache = new Map<number, Map<string, CellCache>>();
	let currentMaxWidth = 0;
	// Map<rowIndex, number> — cached computed heights
	const heightCache = new Map<number, number>();

	function prepareRow(rowIndex: number, cells: Record<string, string>) {
		let rowCache = cache.get(rowIndex);
		if (!rowCache) {
			rowCache = new Map();
			cache.set(rowIndex, rowCache);
		}

		let changed = false;
		for (const [key, text] of Object.entries(cells)) {
			const existing = rowCache.get(key);
			if (existing && existing.text === text) continue;
			rowCache.set(key, { prepared: prepare(text, font), text });
			changed = true;
		}

		if (changed) {
			heightCache.delete(rowIndex);
		}
	}

	function getRowHeight(rowIndex: number, maxWidth?: number): number {
		const width = maxWidth ?? currentMaxWidth;
		if (width <= 0) return defaultHeight;

		const cached = heightCache.get(rowIndex);
		if (cached !== undefined) return cached;

		const rowCache = cache.get(rowIndex);
		if (!rowCache || rowCache.size === 0) return defaultHeight;

		// Height is the max cell height across columns + row padding
		let maxCellHeight = 0;
		for (const cell of rowCache.values()) {
			const cellWidth = Math.max(width - CELL_PADDING, 10);
			const result = layout(cell.prepared, cellWidth, LINE_HEIGHT);
			maxCellHeight = Math.max(maxCellHeight, result.height);
		}

		const rowHeight = Math.max(maxCellHeight + 16, defaultHeight); // 16px vertical padding
		heightCache.set(rowIndex, rowHeight);
		return rowHeight;
	}

	function onResize(newMaxWidth: number) {
		if (newMaxWidth === currentMaxWidth) return;
		currentMaxWidth = newMaxWidth;
		heightCache.clear(); // Invalidate all cached heights, layout() will recompute
	}

	function clearRow(rowIndex: number) {
		cache.delete(rowIndex);
		heightCache.delete(rowIndex);
	}

	function clear() {
		cache.clear();
		heightCache.clear();
	}

	return {
		prepareRow,
		getRowHeight,
		onResize,
		clearRow,
		clear,
		get defaultHeight() {
			return defaultHeight;
		}
	};
}
