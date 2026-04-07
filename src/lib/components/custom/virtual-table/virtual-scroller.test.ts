import { describe, it, expect } from 'vitest';
import { createVirtualScroller } from './virtual-scroller.svelte.js';

function makeScroller(opts: {
	rowCount: number;
	rowHeight: number | ((i: number) => number);
	containerHeight: number;
	scrollTop?: number;
	overscan?: number;
}) {
	const heightFn = typeof opts.rowHeight === 'number' ? () => opts.rowHeight as number : opts.rowHeight;
	let scrollTop = opts.scrollTop ?? 0;

	const scroller = createVirtualScroller({
		getRowCount: () => opts.rowCount,
		getRowHeight: heightFn,
		containerHeight: () => opts.containerHeight,
		scrollTop: () => scrollTop,
		overscan: opts.overscan ?? 0
	});

	return {
		compute: () => scroller.compute(),
		setScroll: (v: number) => { scrollTop = v; }
	};
}

describe('createVirtualScroller', () => {
	describe('empty state', () => {
		it('returns zeros when row count is 0', () => {
			const s = makeScroller({ rowCount: 0, rowHeight: 40, containerHeight: 400 });
			expect(s.compute()).toEqual({ start: 0, end: 0, offsetY: 0, totalHeight: 0 });
		});

		it('returns zeros when container height is 0', () => {
			const s = makeScroller({ rowCount: 100, rowHeight: 40, containerHeight: 0 });
			expect(s.compute()).toEqual({ start: 0, end: 0, offsetY: 0, totalHeight: 0 });
		});
	});

	describe('uniform row heights', () => {
		it('renders all rows when they fit in the container', () => {
			const s = makeScroller({ rowCount: 5, rowHeight: 40, containerHeight: 400 });
			const r = s.compute();
			expect(r.start).toBe(0);
			expect(r.end).toBe(5);
			expect(r.totalHeight).toBe(200);
		});

		it('computes correct visible range at scroll=0', () => {
			const s = makeScroller({ rowCount: 100, rowHeight: 40, containerHeight: 400 });
			const r = s.compute();
			// 400/40 = 10 rows visible
			expect(r.start).toBe(0);
			expect(r.end).toBe(10);
			expect(r.offsetY).toBe(0);
			expect(r.totalHeight).toBe(4000);
		});

		it('computes correct visible range scrolled to middle', () => {
			const s = makeScroller({ rowCount: 100, rowHeight: 40, containerHeight: 400 });
			s.setScroll(2000); // row 50
			const r = s.compute();
			expect(r.start).toBe(50);
			expect(r.end).toBe(60);
			expect(r.offsetY).toBe(2000);
			expect(r.totalHeight).toBe(4000);
		});

		it('computes correct visible range scrolled to end', () => {
			const s = makeScroller({ rowCount: 100, rowHeight: 40, containerHeight: 400 });
			s.setScroll(3600); // row 90, last 10 rows visible
			const r = s.compute();
			expect(r.start).toBe(90);
			expect(r.end).toBe(100);
			expect(r.totalHeight).toBe(4000);
		});

		it('clamps to end when scrolled past total height', () => {
			const s = makeScroller({ rowCount: 100, rowHeight: 40, containerHeight: 400 });
			s.setScroll(5000);
			const r = s.compute();
			expect(r.end).toBe(100);
			expect(r.totalHeight).toBe(4000);
		});
	});

	describe('variable row heights', () => {
		it('handles variable heights correctly', () => {
			// Alternating 20px and 60px rows: avg 40px
			const s = makeScroller({
				rowCount: 20,
				rowHeight: (i) => (i % 2 === 0 ? 20 : 60),
				containerHeight: 200
			});
			const r = s.compute();
			expect(r.start).toBe(0);
			// Total heights: 20,60,20,60,20,60,20,60,20,60 = 400 for 10 rows
			// First 200px: row0(20)+row1(60)+row2(20)+row3(60)+row4(20) = 180, need row5(60)=240 > 200
			expect(r.end).toBe(6); // 0-5 covers 240px which > 200
			expect(r.totalHeight).toBe(800); // 20*20 + 20*60 / 2... = 10*20 + 10*60 = 800
		});

		it('computes correct totalHeight with variable heights', () => {
			const heights = [10, 20, 30, 40, 50];
			const s = makeScroller({
				rowCount: 5,
				rowHeight: (i) => heights[i],
				containerHeight: 1000
			});
			const r = s.compute();
			expect(r.totalHeight).toBe(150);
			expect(r.start).toBe(0);
			expect(r.end).toBe(5);
		});
	});

	describe('overscan', () => {
		it('adds overscan rows before and after visible range', () => {
			const s = makeScroller({
				rowCount: 100,
				rowHeight: 40,
				containerHeight: 400,
				scrollTop: 2000, // row 50
				overscan: 5
			});
			const r = s.compute();
			expect(r.start).toBe(45); // 50 - 5
			expect(r.end).toBe(65); // 60 + 5
		});

		it('clamps overscan at start', () => {
			const s = makeScroller({
				rowCount: 100,
				rowHeight: 40,
				containerHeight: 400,
				scrollTop: 80, // row 2
				overscan: 5
			});
			const r = s.compute();
			expect(r.start).toBe(0); // max(2-5, 0)
		});

		it('clamps overscan at end', () => {
			const s = makeScroller({
				rowCount: 100,
				rowHeight: 40,
				containerHeight: 400,
				scrollTop: 3600, // row 90
				overscan: 15
			});
			const r = s.compute();
			expect(r.end).toBe(100); // min(100+15, 100)
		});
	});

	describe('offsetY calculation', () => {
		it('offsetY is 0 when start is 0', () => {
			const s = makeScroller({ rowCount: 100, rowHeight: 40, containerHeight: 400 });
			expect(s.compute().offsetY).toBe(0);
		});

		it('offsetY equals sum of heights before start', () => {
			const s = makeScroller({
				rowCount: 100,
				rowHeight: 40,
				containerHeight: 400,
				scrollTop: 2000, // row 50
				overscan: 3
			});
			const r = s.compute();
			// start = 47 (50-3), offsetY = 47 * 40 = 1880
			expect(r.start).toBe(47);
			expect(r.offsetY).toBe(47 * 40);
		});

		it('offsetY correct with variable heights and overscan', () => {
			const heights = Array.from({ length: 50 }, (_, i) => 20 + i);
			const s = makeScroller({
				rowCount: 50,
				rowHeight: (i) => heights[i],
				containerHeight: 100,
				scrollTop: 500,
				overscan: 2
			});
			const r = s.compute();
			// Verify offsetY = sum of heights[0..start-1]
			let expectedOffset = 0;
			for (let i = 0; i < r.start; i++) expectedOffset += heights[i];
			expect(r.offsetY).toBe(expectedOffset);
		});
	});

	describe('single row edge case', () => {
		it('handles a single row', () => {
			const s = makeScroller({ rowCount: 1, rowHeight: 40, containerHeight: 400 });
			const r = s.compute();
			expect(r).toEqual({ start: 0, end: 1, offsetY: 0, totalHeight: 40 });
		});
	});

	describe('large dataset', () => {
		it('handles 100k rows efficiently', () => {
			const s = makeScroller({
				rowCount: 100_000,
				rowHeight: 40,
				containerHeight: 800,
				scrollTop: 2_000_000,
				overscan: 10
			});
			const start = performance.now();
			const r = s.compute();
			const elapsed = performance.now() - start;

			expect(r.totalHeight).toBe(4_000_000);
			expect(r.end - r.start).toBeLessThanOrEqual(40); // 20 visible + 2*10 overscan
			expect(elapsed).toBeLessThan(100); // Should be fast
		});
	});
});
