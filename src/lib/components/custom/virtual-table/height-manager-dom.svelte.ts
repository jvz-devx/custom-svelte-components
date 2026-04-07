/**
 * DOM-based height manager for benchmarking comparison.
 * Measures row heights by creating hidden DOM elements and reading offsetHeight.
 * This is the traditional approach that pretext replaces.
 */

const DEFAULT_ROW_HEIGHT = 40;
const CELL_PADDING = 24;

export function createDomHeightManager(opts: { font: string; defaultHeight?: number }) {
	const font = opts.font;
	const defaultHeight = opts.defaultHeight ?? DEFAULT_ROW_HEIGHT;

	const cache = new Map<number, Map<string, string>>();
	const heightCache = new Map<number, number>();
	let currentMaxWidth = 0;
	let measureEl: HTMLDivElement | null = null;

	function getMeasureEl(): HTMLDivElement {
		if (measureEl) return measureEl;
		measureEl = document.createElement('div');
		measureEl.style.cssText = `
			position: absolute;
			visibility: hidden;
			height: auto;
			width: auto;
			white-space: normal;
			word-break: break-word;
			font: ${font};
			padding: 0;
			margin: 0;
			border: 0;
		`;
		document.body.appendChild(measureEl);
		return measureEl;
	}

	function prepareRow(rowIndex: number, cells: Record<string, string>) {
		let rowCache = cache.get(rowIndex);
		if (!rowCache) {
			rowCache = new Map();
			cache.set(rowIndex, rowCache);
		}

		let changed = false;
		for (const [key, text] of Object.entries(cells)) {
			const existing = rowCache.get(key);
			if (existing === text) continue;
			rowCache.set(key, text);
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

		const el = getMeasureEl();
		const cellWidth = Math.max(width - CELL_PADDING, 10);
		el.style.width = `${cellWidth}px`;

		let maxCellHeight = 0;
		for (const text of rowCache.values()) {
			el.textContent = text;
			// Force synchronous layout reflow
			const height = el.offsetHeight;
			maxCellHeight = Math.max(maxCellHeight, height);
		}

		const rowHeight = Math.max(maxCellHeight + 16, defaultHeight);
		heightCache.set(rowIndex, rowHeight);
		return rowHeight;
	}

	function onResize(newMaxWidth: number) {
		if (newMaxWidth === currentMaxWidth) return;
		currentMaxWidth = newMaxWidth;
		heightCache.clear();
	}

	function clearRow(rowIndex: number) {
		cache.delete(rowIndex);
		heightCache.delete(rowIndex);
	}

	function clear() {
		cache.clear();
		heightCache.clear();
	}

	function destroy() {
		if (measureEl) {
			measureEl.remove();
			measureEl = null;
		}
	}

	return {
		prepareRow,
		getRowHeight,
		onResize,
		clearRow,
		clear,
		destroy,
		get defaultHeight() {
			return defaultHeight;
		}
	};
}
