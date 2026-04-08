import { registerTickable, unregisterTickable, getTime } from './animation-loop.js';
import type { Tickable } from './animation-loop.js';

export interface Transform {
	x: number;
	y: number;
	w: number;
	h: number;
	r: number;
	scale: number;
}

export class Moveable implements Tickable {
	T: Transform;
	VT: Transform;
	velocity: { x: number; y: number; r: number; scale: number };
	pinch: { x: boolean };
	hovering: boolean = $state(false);
	dragging: boolean = $state(false);
	highlighted: boolean = $state(false);
	zoom: boolean;
	ambientTilt: number;
	shadowParallax: { x: number; y: number };
	shadowHeight: number;

	juice: {
		scale: number;
		scaleAmt: number;
		r: number;
		rAmt: number;
		startTime: number;
		endTime: number;
	} | null;

	flipping: 'f2b' | 'b2f' | null;
	facing: 'front' | 'back';
	spriteFacing: 'front' | 'back';
	onFlipMidpoint?: () => void;

	tiltVar: { mx: number; my: number; dx: number; dy: number; amt: number };

	/** Generic data attached to this moveable (e.g. card rank/suit/edition) */
	data: Record<string, any>;

	roomW: number;
	roomH: number;
	coordinateScale: number;

	constructor(x: number, y: number, w: number, h: number) {
		this.T = { x, y, w, h, r: 0, scale: 0.95 };
		this.VT = { x, y, w, h, r: 0, scale: 0.95 };
		this.velocity = { x: 0, y: 0, r: 0, scale: 0 };
		this.pinch = { x: false };
		this.zoom = true;
		this.ambientTilt = 0.2;
		this.shadowParallax = { x: 0, y: -1.5 };
		this.shadowHeight = 0.2;
		this.juice = null;
		this.flipping = null;
		this.facing = 'front';
		this.spriteFacing = 'front';
		this.tiltVar = { mx: 0, my: 0, dx: 0, dy: 0, amt: 0 };
		this.data = {};
		this.roomW = 800;
		this.roomH = 600;
		this.coordinateScale = 1;

		registerTickable(this);
	}

	tick(dt: number) {
		const T = this.T;
		const VT = this.VT;
		const vel = this.velocity;
		const pinch = this.pinch;

		// Exponential damping factors (game.lua:2618-2624)
		const exp_xy = Math.exp(-50 * dt);
		const exp_scale = Math.exp(-60 * dt);
		const exp_r = Math.exp(-190 * dt);
		const max_vel = 70 * dt * this.coordinateScale;

		// Move juice (if active)
		if (this.juice !== null) {
			this.moveJuice(dt);
		}

		// --- XY movement (moveable.lua:405-421) ---
		if (T.x !== VT.x || Math.abs(vel.x) > 0.01 || T.y !== VT.y || Math.abs(vel.y) > 0.01) {
			vel.x = exp_xy * vel.x + (1 - exp_xy) * (T.x - VT.x) * 35 * dt;
			vel.y = exp_xy * vel.y + (1 - exp_xy) * (T.y - VT.y) * 35 * dt;
			const mag = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
			if (mag > max_vel) {
				vel.x = (max_vel * vel.x) / mag;
				vel.y = (max_vel * vel.y) / mag;
			}
			VT.x += vel.x;
			VT.y += vel.y;
			if (Math.abs(VT.x - T.x) < 0.01 && Math.abs(vel.x) < 0.01) {
				VT.x = T.x;
				vel.x = 0;
			}
			if (Math.abs(VT.y - T.y) < 0.01 && Math.abs(vel.y) < 0.01) {
				VT.y = T.y;
				vel.y = 0;
			}
		}

		// --- Rotation (moveable.lua:447-457) ---
		// Normalize vel.x back to game-unit scale for rotation wobble (0.015 coefficient tuned for ~2-unit card widths)
		const des_r = T.r + 0.015 * (vel.x / this.coordinateScale) / dt + (this.juice ? this.juice.r * 2 : 0);
		if (des_r !== VT.r || Math.abs(vel.r) > 0.001) {
			vel.r = exp_r * vel.r + (1 - exp_r) * (des_r - VT.r);
			VT.r += vel.r;
		}
		if (Math.abs(VT.r - T.r) < 0.001 && Math.abs(vel.r) < 0.001) {
			VT.r = T.r;
			vel.r = 0;
		}

		// --- Scale (moveable.lua:423-432) ---
		const des_scale =
			T.scale +
			(this.zoom ? (this.dragging ? 0.1 : 0) + (this.hovering ? 0.05 : 0) : 0) +
			(this.juice ? this.juice.scale : 0);
		if (des_scale !== VT.scale || Math.abs(vel.scale) > 0.001) {
			vel.scale = exp_scale * vel.scale + (1 - exp_scale) * (des_scale - VT.scale);
			VT.scale += vel.scale;
		}

		// --- Width/Height pinch (moveable.lua:434-445) ---
		if ((T.w !== VT.w && !pinch.x) || (VT.w > 0 && pinch.x)) {
			VT.w += 8 * dt * (pinch.x ? -1 : 1) * T.w;
			VT.w = Math.max(Math.min(VT.w, T.w), 0);
		}

		// --- Flip check (card.lua:4126-4142) ---
		if (this.flipping && VT.w <= 0) {
			this.spriteFacing = this.flipping === 'f2b' ? 'back' : 'front';
			pinch.x = false;
			this.onFlipMidpoint?.();
		}

		// --- Shadow parallax (moveable.lua:459-462) ---
		this.shadowParallax.x =
			((T.x + T.w / 2 - this.roomW / 2) / (this.roomW / 2)) * 1.5;
		this.shadowHeight = this.highlighted || this.dragging ? 0.35 : 0.1;
	}

	hardSetT(x: number, y: number, w: number, h: number) {
		this.T.x = x;
		this.T.y = y;
		this.T.w = w;
		this.T.h = h;
		this.VT.x = x;
		this.VT.y = y;
		this.VT.w = w;
		this.VT.h = h;
		this.velocity.x = 0;
		this.velocity.y = 0;
		this.velocity.r = 0;
		this.velocity.scale = 0;
	}

	// Card:juice_up (card.lua:4333-4338) + Moveable:juice_up (moveable.lua:250-265)
	juiceUp(scale?: number, rotAmt?: number) {
		// Card wrapper: transform params (card.lua:4333-4338)
		const rot = rotAmt !== undefined
			? 0.4 * (Math.random() > 0.5 ? 1 : -1) * rotAmt
			: (Math.random() > 0.5 ? 1 : -1) * 0.16;
		const amt = scale !== undefined ? scale * 0.4 : 0.11;

		// Moveable:juice_up (moveable.lua:250-265)
		const now = getTime();
		this.juice = {
			scale: 0,
			scaleAmt: amt,
			r: 0,
			rAmt: rot || 0,
			startTime: now,
			endTime: now + 0.4
		};
		this.VT.scale = 1 - 0.6 * amt;
	}

	// Moveable:move_juice (moveable.lua:267-276)
	moveJuice(_dt: number) {
		if (!this.juice) return;
		const now = getTime();
		if (this.juice.endTime < now) {
			this.juice = null;
		} else {
			const elapsed = now - this.juice.startTime;
			const duration = this.juice.endTime - this.juice.startTime;
			const remaining = this.juice.endTime - now;
			this.juice.scale = this.juice.scaleAmt * Math.sin(50.8 * elapsed) * Math.max(0, Math.pow(remaining / duration, 3));
			this.juice.r = this.juice.rAmt * Math.sin(40.8 * elapsed) * Math.max(0, Math.pow(remaining / duration, 2));
		}
	}

	// Card:flip (card.lua:4113-4124)
	flip() {
		if (this.facing === 'front') {
			this.flipping = 'f2b';
			this.facing = 'back';
			this.pinch.x = true;
		} else if (this.facing === 'back') {
			this.flipping = 'b2f';
			this.facing = 'front';
			this.pinch.x = true;
		}
	}

	destroy() {
		unregisterTickable(this);
	}
}
