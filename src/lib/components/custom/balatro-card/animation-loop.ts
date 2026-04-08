export interface Tickable {
	tick(dt: number): void;
}

const tickables = new Set<Tickable>();
const applyCallbacks = new Set<() => void>();

let running = false;
let lastTime = 0;
let globalTime = 0;
let rafId: number | null = null;

function loop(now: number) {
	if (!running) return;

	const dt = Math.min((now - lastTime) / 1000, 0.05);
	lastTime = now;
	globalTime += dt;

	for (const t of tickables) {
		t.tick(dt);
	}
	for (const cb of applyCallbacks) {
		cb();
	}

	rafId = requestAnimationFrame(loop);
}

function start() {
	if (running) return;
	running = true;
	lastTime = performance.now();
	rafId = requestAnimationFrame(loop);
}

function stop() {
	running = false;
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
}

export function registerTickable(t: Tickable) {
	tickables.add(t);
	if (tickables.size === 1) start();
}

export function unregisterTickable(t: Tickable) {
	tickables.delete(t);
	if (tickables.size === 0) stop();
}

export function addApplyCallback(cb: () => void) {
	applyCallbacks.add(cb);
}

export function removeApplyCallback(cb: () => void) {
	applyCallbacks.delete(cb);
}

export function getTime(): number {
	return globalTime;
}
