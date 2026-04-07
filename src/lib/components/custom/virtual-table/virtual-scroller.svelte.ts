export type VirtualRange = {
	start: number;
	end: number;
	offsetY: number;
	totalHeight: number;
};

export function createVirtualScroller(opts: {
	getRowCount: () => number;
	getRowHeight: (index: number) => number;
	containerHeight: () => number;
	scrollTop: () => number;
	overscan?: number;
}) {
	const overscan = opts.overscan ?? 5;

	function compute(): VirtualRange {
		const count = opts.getRowCount();
		const height = opts.containerHeight();
		const scroll = opts.scrollTop();

		if (count === 0 || height === 0) {
			return { start: 0, end: 0, offsetY: 0, totalHeight: 0 };
		}

		// Build cumulative offsets and find visible range
		let totalHeight = 0;
		let start = -1;
		let startOffset = 0;

		for (let i = 0; i < count; i++) {
			const rh = opts.getRowHeight(i);
			if (start === -1 && totalHeight + rh > scroll) {
				start = i;
				startOffset = totalHeight;
			}
			totalHeight += rh;
			if (start !== -1 && totalHeight >= scroll + height) {
				// Apply overscan
				const end = Math.min(i + 1 + overscan, count);
				const adjustedStart = Math.max(start - overscan, 0);

				// Recalculate offset for adjusted start
				let adjustedOffset = 0;
				for (let j = 0; j < adjustedStart; j++) {
					adjustedOffset += opts.getRowHeight(j);
				}

				// Finish computing total height
				for (let j = i + 1; j < count; j++) {
					totalHeight += opts.getRowHeight(j);
				}

				return { start: adjustedStart, end, offsetY: adjustedOffset, totalHeight };
			}
		}

		// All rows fit or scroll is past end
		if (start === -1) start = 0;
		const adjustedStart = Math.max(start - overscan, 0);
		let adjustedOffset = 0;
		for (let j = 0; j < adjustedStart; j++) {
			adjustedOffset += opts.getRowHeight(j);
		}

		return { start: adjustedStart, end: count, offsetY: adjustedOffset, totalHeight };
	}

	return { compute };
}
