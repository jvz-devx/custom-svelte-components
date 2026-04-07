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

export function tilt(node: HTMLElement, opts: { state: TiltState; cardIndex?: number }) {
	const AUTO_TILT_AMOUNT = 30;
	const MANUAL_TILT_AMOUNT = 20;
	const TILT_SPEED = 20;
	const SCALE_ON_HOVER = 1.15;
	const SCALE_TRANSITION = 0.15; // seconds
	const HOVER_PUNCH_ANGLE = 5;
	const SHADOW_OFFSET = 20;

	const s = opts.state;
	s.cardIndex = opts.cardIndex ?? 0;

	let animFrame = 0;
	let lastTime = performance.now();
	let targetScale = 1;
	let scaleProgress = 1; // 0-1 tween progress
	let scaleTweening = false;
	let scaleFrom = 1;
	let punchZ = 0;
	let punchDecay = 0;

	function onPointerMove(e: PointerEvent) {
		const rect = node.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		// Offset from center, normalized to roughly -1..1
		s.x = (e.clientX - centerX) / (rect.width / 2);
		s.y = (e.clientY - centerY) / (rect.height / 2);
	}

	function onPointerEnter() {
		s.hovering = true;
		// Scale tween to hover size
		scaleFrom = s.currentScale;
		targetScale = SCALE_ON_HOVER;
		scaleProgress = 0;
		scaleTweening = true;
		// Punch rotation on hover enter
		punchZ = HOVER_PUNCH_ANGLE;
		punchDecay = 1;
	}

	function onPointerLeave() {
		s.hovering = false;
		s.x = 0;
		s.y = 0;
		// Scale tween back to 1
		scaleFrom = s.currentScale;
		targetScale = 1;
		scaleProgress = 0;
		scaleTweening = true;
	}

	function animate() {
		const now = performance.now();
		const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
		lastTime = now;

		const time = now / 1000;

		// --- Tilt (from CardVisual.CardTilt()) ---
		// Idle sine/cosine oscillation — reduced to 0.2x when hovering
		const idleMultiplier = s.hovering ? 0.2 : 1.0;
		const sine = Math.sin(time + s.cardIndex) * idleMultiplier;
		const cosine = Math.cos(time + s.cardIndex) * idleMultiplier;

		// Manual tilt from mouse offset
		const manualTiltX = s.hovering ? -s.y * MANUAL_TILT_AMOUNT : 0;
		const manualTiltY = s.hovering ? s.x * MANUAL_TILT_AMOUNT : 0;

		// Target tilt = manual + auto idle
		const targetTiltX = manualTiltX + sine * AUTO_TILT_AMOUNT;
		const targetTiltY = manualTiltY + cosine * AUTO_TILT_AMOUNT;

		// Smooth lerp toward target
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

		// --- Punch rotation decay ---
		if (punchDecay > 0) {
			punchDecay -= dt * 8; // decay over ~125ms
			if (punchDecay < 0) punchDecay = 0;
		}
		const currentPunchZ = punchZ * punchDecay * Math.sin(punchDecay * Math.PI * 3);

		// --- Apply transform ---
		node.style.transform = [
			`perspective(600px)`,
			`rotateX(${s.tiltX}deg)`,
			`rotateY(${s.tiltY}deg)`,
			`rotate(${currentPunchZ}deg)`,
			`scale(${s.currentScale})`
		].join(' ');

		// --- Shadow ---
		// Shadow offsets based on tilt direction
		const shadowX = s.tiltY * 0.5;
		const shadowY = s.tiltX * -0.3 + 8;
		const shadowBlur = s.hovering ? 25 : 12;
		const shadowAlpha = s.hovering ? 0.4 : 0.25;
		node.style.boxShadow = `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0,0,0,${shadowAlpha})`;

		animFrame = requestAnimationFrame(animate);
	}

	animFrame = requestAnimationFrame(animate);

	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerenter', onPointerEnter);
	node.addEventListener('pointerleave', onPointerLeave);

	return {
		destroy() {
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerenter', onPointerEnter);
			node.removeEventListener('pointerleave', onPointerLeave);
			if (animFrame) cancelAnimationFrame(animFrame);
		}
	};
}
