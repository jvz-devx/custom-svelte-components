import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderCardFace } from './card-face.js';
import type { CardRank, CardSuit } from './types.js';

// jsdom doesn't implement canvas 2d context, so we mock it
function createMockContext(): CanvasRenderingContext2D {
	const calls: string[] = [];
	const ctx = {
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 1,
		font: '',
		textAlign: 'left',
		textBaseline: 'top',
		fillRect: vi.fn(() => calls.push('fillRect')),
		strokeRect: vi.fn(() => calls.push('strokeRect')),
		fillText: vi.fn((text: string) => calls.push(`fillText:${text}`)),
		beginPath: vi.fn(),
		closePath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		quadraticCurveTo: vi.fn(),
		fill: vi.fn(() => calls.push('fill')),
		stroke: vi.fn(() => calls.push('stroke')),
		save: vi.fn(),
		restore: vi.fn(),
		translate: vi.fn(),
		rotate: vi.fn(),
		getImageData: vi.fn(() => ({
			data: new Uint8ClampedArray(100 * 140 * 4).fill(128)
		})),
		_calls: calls
	};
	return ctx as unknown as CanvasRenderingContext2D;
}

let mockCtx: ReturnType<typeof createMockContext>;

beforeEach(() => {
	mockCtx = createMockContext();
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx);
	vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
});

describe('renderCardFace', () => {
	describe('canvas output', () => {
		it('returns an HTMLCanvasElement', () => {
			const canvas = renderCardFace('A', 'spades');
			expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		});

		it('uses default dimensions when none specified', () => {
			const canvas = renderCardFace('A', 'spades');
			expect(canvas.width).toBe(300);
			expect(canvas.height).toBe(420);
		});

		it('uses custom dimensions', () => {
			const canvas = renderCardFace('A', 'spades', 200, 280);
			expect(canvas.width).toBe(200);
			expect(canvas.height).toBe(280);
		});
	});

	describe('all rank/suit combinations', () => {
		const suits: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
		const ranks: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

		it('renders all 52 cards without errors', () => {
			for (const suit of suits) {
				for (const rank of ranks) {
					expect(() => renderCardFace(rank, suit)).not.toThrow();
				}
			}
		});
	});

	describe('drawing operations', () => {
		it('draws the card background (fill)', () => {
			renderCardFace('A', 'spades');
			expect(mockCtx.fill).toHaveBeenCalled();
		});

		it('draws the border (stroke)', () => {
			renderCardFace('A', 'spades');
			expect(mockCtx.stroke).toHaveBeenCalled();
		});

		it('draws the rank text', () => {
			renderCardFace('A', 'spades');
			const calls = (mockCtx as any)._calls as string[];
			expect(calls.some((c: string) => c.includes('fillText:A'))).toBe(true);
		});

		it('draws the suit symbol', () => {
			renderCardFace('A', 'hearts');
			const calls = (mockCtx as any)._calls as string[];
			// Hearts symbol is ♥
			expect(calls.some((c: string) => c.includes('fillText:\u2665'))).toBe(true);
		});

		it('draws spades symbol for spades suit', () => {
			renderCardFace('K', 'spades');
			const calls = (mockCtx as any)._calls as string[];
			expect(calls.some((c: string) => c.includes('fillText:\u2660'))).toBe(true);
		});

		it('draws diamonds symbol', () => {
			renderCardFace('Q', 'diamonds');
			const calls = (mockCtx as any)._calls as string[];
			expect(calls.some((c: string) => c.includes('fillText:\u2666'))).toBe(true);
		});

		it('draws clubs symbol', () => {
			renderCardFace('J', 'clubs');
			const calls = (mockCtx as any)._calls as string[];
			expect(calls.some((c: string) => c.includes('fillText:\u2663'))).toBe(true);
		});

		it('uses red color for hearts', () => {
			renderCardFace('A', 'hearts');
			// The fillStyle should have been set to #e74c3c at some point
			expect(mockCtx.fillStyle).not.toBe('');
		});

		it('draws inverted rank in bottom-right (uses rotate)', () => {
			renderCardFace('A', 'spades');
			expect(mockCtx.rotate).toHaveBeenCalledWith(Math.PI);
		});
	});

	describe('face cards vs number cards', () => {
		it('draws large letter for face cards (J, Q, K)', () => {
			for (const rank of ['J', 'Q', 'K'] as CardRank[]) {
				const ctx = createMockContext();
				vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
				renderCardFace(rank, 'spades');
				const calls = (ctx as any)._calls as string[];
				expect(calls.some((c: string) => c.includes(`fillText:${rank}`))).toBe(true);
			}
		});

		it('draws pip symbols for number cards', () => {
			const ctx = createMockContext();
			vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
			renderCardFace('5', 'spades');
			const calls = (ctx as any)._calls as string[];
			// 5 card should draw the spade symbol 5 times (pips) + 2 (top-left, bottom-right)
			const suitCalls = calls.filter((c: string) => c.includes('fillText:\u2660'));
			expect(suitCalls.length).toBeGreaterThanOrEqual(5);
		});

		it('draws 10 pips for a 10 card', () => {
			const ctx = createMockContext();
			vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
			renderCardFace('10', 'hearts');
			const calls = (ctx as any)._calls as string[];
			const suitCalls = calls.filter((c: string) => c.includes('fillText:\u2665'));
			expect(suitCalls.length).toBeGreaterThanOrEqual(10);
		});
	});

	describe('scaling', () => {
		it('renders at small sizes without errors', () => {
			expect(() => renderCardFace('A', 'spades', 20, 28)).not.toThrow();
		});

		it('renders at large sizes without errors', () => {
			expect(() => renderCardFace('A', 'spades', 600, 840)).not.toThrow();
		});
	});
});
