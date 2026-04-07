import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TiltState, tilt } from './tilt.svelte.js';

describe('TiltState', () => {
	it('initializes with default values', () => {
		const state = new TiltState();
		expect(state.x).toBe(0);
		expect(state.y).toBe(0);
		expect(state.hovering).toBe(false);
		expect(state.angle).toBe(0);
		expect(state.mouseVerticalPosition).toBe(0);
	});

	it('is mutable', () => {
		const state = new TiltState();
		state.x = 0.5;
		state.y = -0.3;
		state.hovering = true;
		state.angle = 1.5;
		state.mouseVerticalPosition = 0.8;
		expect(state.x).toBe(0.5);
		expect(state.y).toBe(-0.3);
		expect(state.hovering).toBe(true);
		expect(state.angle).toBe(1.5);
		expect(state.mouseVerticalPosition).toBe(0.8);
	});
});

describe('tilt action', () => {
	let node: HTMLDivElement;
	let state: TiltState;

	beforeEach(() => {
		node = document.createElement('div');
		Object.defineProperty(node, 'getBoundingClientRect', {
			value: () => ({
				left: 0,
				top: 0,
				width: 150,
				height: 210,
				right: 150,
				bottom: 210,
				x: 0,
				y: 0,
				toJSON: () => {}
			})
		});
		document.body.appendChild(node);
		state = new TiltState();
	});

	afterEach(() => {
		node.remove();
	});

	it('attaches and detaches event listeners without errors', () => {
		const addSpy = vi.spyOn(node, 'addEventListener');
		const removeSpy = vi.spyOn(node, 'removeEventListener');

		const result = tilt(node, { state });
		expect(addSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
		expect(addSpy).toHaveBeenCalledWith('pointerenter', expect.any(Function));
		expect(addSpy).toHaveBeenCalledWith('pointerleave', expect.any(Function));

		result.destroy();
		expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith('pointerenter', expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith('pointerleave', expect.any(Function));
	});

	it('starts animation immediately', () => {
		const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
		tilt(node, { state });
		expect(rafSpy).toHaveBeenCalled();
		rafSpy.mockRestore();
	});

	it('sets hovering to true on pointerenter', () => {
		tilt(node, { state });
		node.dispatchEvent(new PointerEvent('pointerenter'));
		expect(state.hovering).toBe(true);
	});

	it('sets hovering to false and resets x/y on pointerleave', () => {
		tilt(node, { state });
		node.dispatchEvent(new PointerEvent('pointerenter'));
		state.x = 0.3;
		state.y = -0.2;
		node.dispatchEvent(new PointerEvent('pointerleave'));
		expect(state.hovering).toBe(false);
		expect(state.x).toBe(0);
		expect(state.y).toBe(0);
	});

	it('updates x/y on pointermove with correct formula', () => {
		tilt(node, { state });
		// width=150, height=210
		// x = clientX - left = 75, halfW = 150/1.5 = 100
		// state.x = ((75 - 100) / 100) * 0.5 = -0.125
		// y = clientY - top = 105, halfH = 210/1.5 = 140
		// state.y = ((105 - 140) / 140) * 0.5 = -0.125
		node.dispatchEvent(new PointerEvent('pointermove', { clientX: 75, clientY: 105 }));
		expect(state.x).toBeCloseTo(-0.125);
		expect(state.y).toBeCloseTo(-0.125);
		expect(state.mouseVerticalPosition).toBeCloseTo(0.5);
	});

	it('applies transform with perspective and rotateX/rotateY on animate', () => {
		vi.useFakeTimers();
		let rafCallback: FrameRequestCallback | null = null;
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			rafCallback = cb;
			return 1;
		});

		tilt(node, { state });
		(rafCallback as FrameRequestCallback | null)?.(16);

		expect(node.style.transform).toContain('perspective');
		expect(node.style.transform).toContain('rotateX');
		expect(node.style.transform).toContain('rotateY');
		expect(node.style.boxShadow).toContain('rgba');

		vi.useRealTimers();
	});

	it('cleans up animation frame on destroy', () => {
		const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
		vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);

		const result = tilt(node, { state });
		result.destroy();
		expect(cancelSpy).toHaveBeenCalledWith(42);
	});
});
