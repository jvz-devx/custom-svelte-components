import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TiltState, Punch, tilt } from './tilt.svelte.js';

describe('Punch', () => {
	it('returns 0 when inactive', () => {
		const p = new Punch();
		expect(p.update(0.016)).toBe(0);
	});

	it('produces decaying vibrato', () => {
		const p = new Punch();
		p.start(5, 0.3, 10);
		const v1 = Math.abs(p.update(0.05));
		const v2 = Math.abs(p.update(0.05));
		// Should produce non-zero values
		expect(v1).toBeGreaterThan(0);
		expect(v2).toBeGreaterThan(0);
	});

	it('deactivates after duration', () => {
		const p = new Punch();
		p.start(5, 0.1, 10);
		p.update(0.2); // exceeds duration
		expect(p.active).toBe(false);
		expect(p.update(0.016)).toBe(0);
	});
});

describe('TiltState', () => {
	it('initializes with default values', () => {
		const state = new TiltState();
		expect(state.x).toBe(0);
		expect(state.y).toBe(0);
		expect(state.hovering).toBe(false);
		expect(state.tiltX).toBe(0);
		expect(state.tiltY).toBe(0);
		expect(state.currentScale).toBe(1);
		expect(state.cardIndex).toBe(0);
	});

	it('is mutable', () => {
		const state = new TiltState();
		state.x = 0.5;
		state.y = -0.3;
		state.hovering = true;
		state.tiltX = 10;
		state.tiltY = 20;
		state.currentScale = 1.15;
		state.cardIndex = 3;
		expect(state.x).toBe(0.5);
		expect(state.y).toBe(-0.3);
		expect(state.hovering).toBe(true);
		expect(state.tiltX).toBe(10);
		expect(state.tiltY).toBe(20);
		expect(state.currentScale).toBe(1.15);
		expect(state.cardIndex).toBe(3);
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
		expect(addSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
		expect(addSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));

		result.destroy();
		expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith('pointerenter', expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith('pointerleave', expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));
	});

	it('starts animation immediately', () => {
		const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
		tilt(node, { state });
		expect(rafSpy).toHaveBeenCalled();
		rafSpy.mockRestore();
	});

	it('sets cardIndex from opts', () => {
		tilt(node, { state, cardIndex: 5 });
		expect(state.cardIndex).toBe(5);
	});

	it('defaults cardIndex to 0', () => {
		tilt(node, { state });
		expect(state.cardIndex).toBe(0);
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

	it('updates x/y on pointermove normalized to center', () => {
		tilt(node, { state });
		node.dispatchEvent(new PointerEvent('pointermove', { clientX: 75, clientY: 105 }));
		expect(state.x).toBeCloseTo(0);
		expect(state.y).toBeCloseTo(0);

		node.dispatchEvent(new PointerEvent('pointermove', { clientX: 150, clientY: 210 }));
		expect(state.x).toBeCloseTo(1);
		expect(state.y).toBeCloseTo(1);
	});

	it('applies transform with perspective, rotateX, rotateY, rotate, translateY, and scale on animate', () => {
		vi.useFakeTimers();
		let rafCallback: FrameRequestCallback | null = null;
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			rafCallback = cb;
			return 1;
		});

		tilt(node, { state });
		(rafCallback as FrameRequestCallback | null)?.(16);

		expect(node.style.transform).toContain('perspective');
		expect(node.style.transform).toContain('translateY');
		expect(node.style.transform).toContain('rotateX');
		expect(node.style.transform).toContain('rotateY');
		expect(node.style.transform).toContain('rotate(');
		expect(node.style.transform).toContain('scale(');
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

	it('calls onInit callback with the action object', () => {
		const onInit = vi.fn();
		tilt(node, { state, onInit });
		expect(onInit).toHaveBeenCalledWith(
			expect.objectContaining({
				destroy: expect.any(Function),
				triggerSelect: expect.any(Function),
				triggerFlash: expect.any(Function),
				triggerPlayed: expect.any(Function),
				setFlashEl: expect.any(Function)
			})
		);
	});

	it('exposes triggerSelect that activates punches', () => {
		const result = tilt(node, { state });
		// Should not throw
		result.triggerSelect(1);
		result.triggerSelect(-1);
		result.destroy();
	});
});
