// Easing functions ported from Balatro engine/event.lua:69-79

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** Elastic ease-out (event.lua) */
export function elastic(t: number): number {
	if (t === 0 || t === 1) return t;
	return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3));
}

/** Quadratic ease */
export function quad(t: number): number {
	return t * t;
}

const EASE_FNS = {
	lerp: (t: number) => t,
	elastic,
	quad
} as const;

export class EaseEvent {
	private startVal: number;
	private endVal: number;
	private duration: number;
	private elapsed: number = 0;
	private easeFn: (t: number) => number;
	private setter: (v: number) => void;
	done = false;

	constructor(opts: {
		from: number;
		to: number;
		duration: number;
		ease?: 'lerp' | 'elastic' | 'quad';
		setter: (v: number) => void;
	}) {
		this.startVal = opts.from;
		this.endVal = opts.to;
		this.duration = opts.duration;
		this.easeFn = EASE_FNS[opts.ease ?? 'lerp'];
		this.setter = opts.setter;
	}

	update(dt: number): void {
		if (this.done) return;
		this.elapsed += dt;
		const t = Math.min(this.elapsed / this.duration, 1);
		const eased = this.easeFn(t);
		this.setter(lerp(this.startVal, this.endVal, eased));
		if (t >= 1) this.done = true;
	}
}

export class EaseManager {
	private events: EaseEvent[] = [];

	add(event: EaseEvent): void {
		this.events.push(event);
	}

	update(dt: number): void {
		for (let i = this.events.length - 1; i >= 0; i--) {
			this.events[i].update(dt);
			if (this.events[i].done) {
				this.events.splice(i, 1);
			}
		}
	}
}
