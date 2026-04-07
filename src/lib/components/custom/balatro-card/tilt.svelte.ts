/**
 * Balatro card tilt animation — ported from Mix and Jam's Unity recreation.
 *
 * Key parameters from CardVisual.cs:
 *   autoTiltAmount = 30    — idle sin/cos tilt magnitude
 *   manualTiltAmount = 20  — mouse-driven tilt magnitude
 *   tiltSpeed = 20         — tilt lerp speed
 *   scaleOnHover = 1.15    — scale when hovered
 *   scaleTransition = 0.15 — scale tween duration (seconds)
 *   scaleEase = OutBack    — bouncy overshoot easing
 *   hoverPunchAngle = 5    — Z-rotation punch on hover enter
 *   selectPunchAmount = 20 — Y-position punch on select
 */

export class Punch {
	amplitude = 0;
	duration = 0;
	vibrato = 0;
	elapsed = 0;
	active = false;

	start(amplitude: number, duration: number, vibrato: number) {
		this.amplitude = amplitude;
		this.duration = duration;
		this.vibrato = vibrato;
		this.elapsed = 0;
		this.active = true;
	}

	update(dt: number): number {
		if (!this.active) return 0;
		this.elapsed += dt;
		const t = Math.min(this.elapsed / this.duration, 1);
		if (t >= 1) {
			this.active = false;
			return 0;
		}
		return this.amplitude * Math.sin(t * this.vibrato * Math.PI) * (1 - t);
	}
}

export class TiltState {
	x = $state(0); // mouse offset X (normalized)
	y = $state(0); // mouse offset Y (normalized)
	hovering = $state(false);
	// Internal (not reactive — no need to trigger re-renders)
	tiltX = 0;
	tiltY = 0;
	currentScale = 1;
	cardIndex = 0;
}

// DOTween Ease.OutBack approximation
function easeOutBack(t: number): number {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function lerpAngle(current: number, target: number, t: number): number {
	let delta = ((target - current + 540) % 360) - 180;
	return current + delta * Math.min(t, 1);
}

export type TiltAction = ReturnType<typeof tilt>;

export function tilt(node: HTMLElement, opts: { state: TiltState; cardIndex?: number; onInit?: (action: TiltAction) => void }) {
	// Unity values scaled for CSS perspective
	const AUTO_TILT_AMOUNT = 3;
	const MANUAL_TILT_AMOUNT = 8;
	const TILT_SPEED = 10;
	const SCALE_ON_HOVER = 1.15;
	const SCALE_TRANSITION = 0.15;
	const SHADOW_OFFSET = 20;

	const s = opts.state;
	s.cardIndex = opts.cardIndex ?? 0;

	let animFrame = 0;
	let lastTime = performance.now();
	let targetScale = 1;
	let scaleProgress = 1;
	let scaleTweening = false;
	let scaleFrom = 1;

	// Task #10: DOPunch vibrato system
	const punchY = new Punch();
	const punchRotZ = new Punch();

	// Task #11: Movement-based Z rotation
	let lastX = 0;
	let movementRotZ = 0;

	// Task #12: Shadow press/release
	let pressed = false;

	// Task #14: Flash and played animation state
	let flashOpacity = 0;
	let playedProgress = -1; // -1 = inactive
	let playedDuration = 0.4;

	function onPointerMove(e: PointerEvent) {
		const rect = node.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		s.x = (e.clientX - centerX) / (rect.width / 2);
		s.y = (e.clientY - centerY) / (rect.height / 2);
	}

	function onPointerEnter() {
		s.hovering = true;
		scaleFrom = s.currentScale;
		targetScale = SCALE_ON_HOVER;
		scaleProgress = 0;
		scaleTweening = true;
		// Punch rotation on hover enter (Unity: 5deg / 3)
		punchRotZ.start(1.7, 0.15, 20);
	}

	function onPointerLeave() {
		s.hovering = false;
		s.x = 0;
		s.y = 0;
		scaleFrom = s.currentScale;
		targetScale = 1;
		scaleProgress = 0;
		scaleTweening = true;
	}

	function onPointerDown() {
		pressed = true;
	}

	function onPointerUp() {
		pressed = false;
	}

	function animate() {
		const now = performance.now();
		const dt = Math.min((now - lastTime) / 1000, 0.05);
		lastTime = now;

		const time = now / 1000;

		// --- Tilt (from CardVisual.CardTilt()) ---
		const idleMultiplier = s.hovering ? 0.2 : 1.0;
		const sine = Math.sin(time + s.cardIndex) * idleMultiplier;
		const cosine = Math.cos(time + s.cardIndex) * idleMultiplier;

		const manualTiltX = s.hovering ? -s.y * MANUAL_TILT_AMOUNT : 0;
		const manualTiltY = s.hovering ? s.x * MANUAL_TILT_AMOUNT : 0;

		const targetTiltX = manualTiltX + sine * AUTO_TILT_AMOUNT;
		const targetTiltY = manualTiltY + cosine * AUTO_TILT_AMOUNT;

		s.tiltX = lerpAngle(s.tiltX, targetTiltX, TILT_SPEED * dt);
		s.tiltY = lerpAngle(s.tiltY, targetTiltY, TILT_SPEED * dt);

		// --- Scale (DOTween OutBack) ---
		if (scaleTweening) {
			scaleProgress += dt / SCALE_TRANSITION;
			if (scaleProgress >= 1) {
				scaleProgress = 1;
				scaleTweening = false;
			}
			s.currentScale = scaleFrom + (targetScale - scaleFrom) * easeOutBack(scaleProgress);
		}

		// --- Punch updates (Task #10) ---
		const punchYValue = punchY.update(dt);
		const punchRotZValue = punchRotZ.update(dt);

		// --- Movement-based Z rotation (Task #11) ---
		const currentX = node.getBoundingClientRect().left;
		const velocity = (currentX - lastX) / Math.max(dt, 0.001);
		lastX = currentX;
		const targetMovementRotZ = Math.max(-15, Math.min(15, velocity * 0.3));
		movementRotZ += (targetMovementRotZ - movementRotZ) * Math.min(10 * dt, 1);

		// --- Flash decay (Task #14) ---
		if (flashOpacity > 0.001) {
			flashOpacity *= Math.pow(0.01, dt / 0.15);
			if (flashOpacity < 0.001) flashOpacity = 0;
		}

		// --- Played animation (Task #14) ---
		let playedScale = 1;
		let playedTranslateY = 0;
		let playedOpacity = 1;
		if (playedProgress >= 0) {
			playedProgress += dt / playedDuration;
			if (playedProgress >= 1) {
				playedProgress = 1;
			}
			// cubic-bezier(0.34, 1.56, 0.64, 1) approximated with easeOutBack
			const t = easeOutBack(Math.min(playedProgress, 1));
			playedScale = 1 + 0.5 * t;
			playedTranslateY = -80 * t;
			playedOpacity = 1 - playedProgress; // linear fade
		}

		// --- Apply transform ---
		const totalRotZ = punchRotZValue + movementRotZ;
		const totalTranslateY = punchYValue + playedTranslateY;

		node.style.transform = [
			`perspective(600px)`,
			`translateY(${totalTranslateY}px)`,
			`rotateX(${s.tiltX}deg)`,
			`rotateY(${s.tiltY}deg)`,
			`rotate(${totalRotZ}deg)`,
			`scale(${s.currentScale * playedScale})`
		].join(' ');

		if (playedProgress >= 0) {
			node.style.opacity = String(playedOpacity);
		}

		// --- Shadow (Task #12: press/release) ---
		const shadowX = s.tiltY * 0.5;
		let shadowY = s.tiltX * -0.3 + 8;
		let shadowBlur = s.hovering ? 25 : 12;
		let shadowAlpha = s.hovering ? 0.4 : 0.25;

		if (pressed) {
			shadowY += 10;
			shadowBlur = 5;
			shadowAlpha = Math.min(shadowAlpha + 0.15, 0.7);
		}

		node.style.boxShadow = `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0,0,0,${shadowAlpha})`;

		// --- Update flash element opacity (Task #14) ---
		if (flashEl) {
			flashEl.style.opacity = String(flashOpacity);
		}

		animFrame = requestAnimationFrame(animate);
	}

	// Flash element reference (set by card component)
	let flashEl: HTMLElement | null = null;

	animFrame = requestAnimationFrame(animate);

	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerenter', onPointerEnter);
	node.addEventListener('pointerleave', onPointerLeave);
	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointerup', onPointerUp);

	const action = {
		destroy() {
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerenter', onPointerEnter);
			node.removeEventListener('pointerleave', onPointerLeave);
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointerup', onPointerUp);
			if (animFrame) cancelAnimationFrame(animFrame);
		},
		triggerSelect(dir: 1 | -1) {
			// Unity: -20/3 (negative = up), scaled
			punchY.start(-7 * dir, 0.15, 10);
			punchRotZ.start(0.8, 0.15, 20);
		},
		triggerFlash() {
			flashOpacity = 0.4;
		},
		triggerPlayed() {
			playedProgress = 0;
		},
		setFlashEl(el: HTMLElement | null) {
			flashEl = el;
		}
	};

	opts.onInit?.(action);

	return action;
}
