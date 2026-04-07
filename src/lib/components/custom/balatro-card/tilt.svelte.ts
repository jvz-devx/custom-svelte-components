/**
 * Balatro-style continuous tilt animation.
 * Cards always animate (idle: circular motion, hover: mouse-driven tilt).
 */

export class TiltState {
	x = $state(0);
	y = $state(0);
	hovering = $state(false);
	angle = 0;
	mouseVerticalPosition = 0;
}

export function tilt(node: HTMLElement, opts: { state: TiltState }) {
	const NORMAL_SPEED = 0.05;
	const SLOW_SPEED = 0.02;
	const constrain = 0.5;
	let currentSpeed = SLOW_SPEED;
	let animFrame = 0;

	function onPointerMove(e: PointerEvent) {
		const { left, top, width, height } = node.getBoundingClientRect();
		const x = e.clientX - left;
		const y = e.clientY - top;
		opts.state.x = ((x - width / 1.5) / (width / 1.5)) * constrain;
		opts.state.y = ((y - height / 1.5) / (height / 1.5)) * constrain;
		opts.state.mouseVerticalPosition = 1 - y / height;
	}

	function onPointerEnter() {
		opts.state.hovering = true;
		currentSpeed = NORMAL_SPEED;
	}

	function onPointerLeave() {
		opts.state.hovering = false;
		currentSpeed = SLOW_SPEED;
		opts.state.x = 0;
		opts.state.y = 0;
	}

	function animate() {
		const s = opts.state;
		const displX = Math.sin(s.angle) * 0.5;
		const displY = Math.cos(s.angle) * 0.5;
		const rotation = Math.sin(s.angle * 2) * 1;

		if (s.hovering) {
			const elevation = Math.min(Math.max((1 - s.mouseVerticalPosition) * 50, 0), 7);
			node.style.transform = `translateZ(0px) perspective(100px) rotateX(${-s.y * 6}deg) rotateY(${s.x * 6}deg) translateX(${displX}px) translateY(${displY}px) rotate(${rotation}deg)`;
			const shadowX = displX + s.x * 3;
			const shadowY = displY + s.y * 3 - elevation;
			node.style.boxShadow = `${shadowX}px ${shadowY + 8}px 20px rgba(0,0,0,0.4)`;
		} else {
			const simX = Math.cos(s.angle) * constrain;
			const simY = Math.sin(s.angle) * constrain;
			node.style.transform = `translateZ(0px) perspective(100px) rotateX(${-simY * 6}deg) rotateY(${simX * 6}deg) translateX(${displX}px) translateY(${displY}px) rotate(${rotation}deg)`;
			node.style.boxShadow = `${displX + simX * 5}px ${displY + simY * 9}px 15px rgba(0,0,0,0.3)`;
		}

		s.angle += currentSpeed;
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
