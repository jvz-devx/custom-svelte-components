/**
 * Particle system ported from Balatro's engine/particles.lua and card.lua effect functions.
 * All values taken directly from the game source.
 */

interface Particle {
	offset: { x: number; y: number };
	velocity: number;
	dir: number;
	facing: number;
	rVel: number;
	lifespan: number;
	age: number;
	scale: number;
	eCurr: number;
	eVel: number;
	ePrev: number;
	colour: [number, number, number, number];
}

interface SpawnConfig {
	x: number;
	y: number;
	w: number;
	h: number;
	count?: number;
	timer: number;
	scale: number;
	speed: number;
	velVariation: number;
	lifespan: number;
	colours: [number, number, number, number][];
	fill: boolean;
	pulseMax?: number;
}

function pseudorandomElement<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

export class ParticleSystem {
	private particles: Particle[] = [];
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private width: number;
	private height: number;

	// Active effect state
	private activeEffect: {
		type: 'dissolve' | 'shatter' | 'materialize' | 'explode';
		startTime: number;
		elapsed: number;
		dissolve: number;
		phase: number;
		spawnAccum: number;
		config: SpawnConfig;
		config2?: SpawnConfig;
		fadeAlpha: number;
		fadeAlpha2: number;
		pulsed: number;
		pulsed2: number;
		juice: { scale: number; r: number };
	} | null = null;

	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = height;
		this.ctx = this.canvas.getContext('2d')!;
	}

	private spawnParticle(config: SpawnConfig): Particle {
		const offset = config.fill
			? { x: (0.5 - Math.random()) * config.w, y: (0.5 - Math.random()) * config.h }
			: { x: 0, y: 0 };

		return {
			offset,
			velocity: config.speed * (config.velVariation * Math.random() + (1 - config.velVariation)) * 0.7,
			dir: Math.random() * 2 * Math.PI,
			facing: Math.random() * 2 * Math.PI,
			rVel: 0.2 * (0.5 - Math.random()),
			lifespan: config.lifespan,
			age: 0,
			scale: 0,
			eCurr: 0,
			eVel: 0,
			ePrev: 0,
			colour: pseudorandomElement(config.colours)
		};
	}

	/** Port of particles.lua:100-129 */
	update(dt: number): { progress: number; done: boolean; juice?: { scale: number; r: number } } {
		const effect = this.activeEffect;
		if (effect) {
			effect.elapsed += dt;
			effect.spawnAccum += dt;
			this.updateEffect(dt, effect);
		}

		// Update existing particles (iterate backwards for safe removal)
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.eVel = p.eVel || dt * (effect?.config.scale ?? 0);
			p.ePrev = p.eCurr;
			p.age += dt;

			const scaleFactor = effect?.config.scale ?? 1;
			p.eCurr = Math.min(
				2 * Math.min(
					(p.age / p.lifespan) * scaleFactor,
					scaleFactor * ((p.lifespan - p.age) / p.lifespan)
				),
				scaleFactor
			);

			p.eVel = (p.eCurr - p.ePrev) * scaleFactor * dt + (1 - scaleFactor * dt) * p.eVel;
			p.scale = p.scale + p.eVel;
			p.scale = Math.min(
				2 * Math.min(
					(p.age / p.lifespan) * scaleFactor,
					scaleFactor * ((p.lifespan - p.age) / p.lifespan)
				),
				scaleFactor
			);

			if (p.scale < 0) {
				this.particles.splice(i, 1);
			} else {
				p.offset.x += p.velocity * Math.sin(p.dir) * dt;
				p.offset.y += p.velocity * Math.cos(p.dir) * dt;
				p.facing += p.rVel * dt;
				p.velocity = Math.max(0, p.velocity - p.velocity * 0.07 * dt);
			}
		}

		if (!effect) return { progress: 0, done: true };

		return {
			progress: effect.dissolve,
			done: this.isEffectDone(effect),
			juice: effect.juice
		};
	}

	private updateEffect(
		dt: number,
		effect: NonNullable<ParticleSystem['activeEffect']>
	): void {
		const t = effect.elapsed;

		switch (effect.type) {
			case 'dissolve': {
				// dissolve_time = 0.7
				const dissolveTime = 0.7;
				const timer = 0.01 * dissolveTime;

				// Spawn particles on timer
				while (effect.spawnAccum >= timer && effect.fadeAlpha < 1) {
					effect.spawnAccum -= timer;
					this.particles.push(this.spawnParticle(effect.config));
				}

				// Fade particles after 0.7 * dissolve_time
				if (t > 0.7 * dissolveTime) {
					effect.fadeAlpha = Math.min(1, effect.fadeAlpha + dt / (0.3 * dissolveTime));
				}

				// Dissolve eases to 1 over 1 * dissolve_time
				effect.dissolve = Math.min(1, t / (1 * dissolveTime));

				if (t >= 1.05 * dissolveTime) {
					this.activeEffect = null;
				}
				break;
			}

			case 'shatter': {
				// dissolve_time = 0.7
				const dissolveTime = 0.7;
				const timer = 0.007 * dissolveTime;

				while (effect.spawnAccum >= timer && effect.fadeAlpha < 1) {
					effect.spawnAccum -= timer;
					this.particles.push(this.spawnParticle(effect.config));
				}

				// Fade after 0.5 * dissolve_time
				if (t > 0.5 * dissolveTime) {
					effect.fadeAlpha = Math.min(1, effect.fadeAlpha + dt / (0.15 * dissolveTime));
				}

				// Dissolve eases to 1 over 0.5 * dissolve_time
				effect.dissolve = Math.min(1, t / (0.5 * dissolveTime));

				if (t >= 0.55 * dissolveTime) {
					this.activeEffect = null;
				}
				break;
			}

			case 'materialize': {
				// dissolve_time = 0.6
				const dissolveTime = 0.6;
				const timer = 0.025 * dissolveTime;

				// Spawn particles until 0.5 * dissolve_time
				if (t < 0.5 * dissolveTime) {
					while (effect.spawnAccum >= timer) {
						effect.spawnAccum -= timer;
						this.particles.push(this.spawnParticle(effect.config));
					}
				}

				// Dissolve goes from 1 to 0 over 1 * dissolve_time
				effect.dissolve = Math.max(0, 1 - t / (1 * dissolveTime));

				if (t >= 1.05 * dissolveTime) {
					this.activeEffect = null;
				}
				break;
			}

			case 'explode': {
				const explodeTime = 1.3;
				const timer1 = 0.01 * explodeTime;

				// Phase 1: small particles with rotation shake
				if (effect.phase === 0) {
					const percent = t / explodeTime;
					effect.juice.r =
						0.05 *
						(Math.sin(5 * t) +
							Math.cos(0.33 + 41.15332 * t) +
							Math.cos(67.12 * t)) *
						percent;
					effect.juice.scale = percent * 0.15;

					while (effect.spawnAccum >= timer1 && effect.fadeAlpha < 1) {
						effect.spawnAccum -= timer1;
						this.particles.push(this.spawnParticle(effect.config));
					}

					// Dissolve eases to 0.3 over 0.9 * explodeTime
					effect.dissolve = Math.min(0.3, t / (0.9 * explodeTime) * 0.3);

					// Phase 2 trigger at 0.9 * explodeTime
					if (t >= 0.9 * explodeTime) {
						effect.phase = 1;
						effect.pulsed2 = 0;
						effect.spawnAccum = 0;
					}
				}

				// Phase 2: big burst
				if (effect.phase === 1) {
					const t2 = t - 0.9 * explodeTime;

					// Spawn burst particles (pulse_max = 30)
					const timer2 = 0.003;
					while (effect.spawnAccum >= timer2 && effect.pulsed2 < 30) {
						effect.spawnAccum -= timer2;
						this.particles.push(this.spawnParticle(effect.config2!));
						effect.pulsed2++;
					}

					// Dissolve eases from 0.3 to 1 over 0.1 * explodeTime
					effect.dissolve = Math.min(1, 0.3 + t2 / (0.1 * explodeTime) * 0.7);

					// Fade phase 1 particles
					effect.fadeAlpha = Math.min(1, effect.fadeAlpha + dt / (0.3 * explodeTime));

					// Scale down phase 2 after 0.5 * explodeTime from phase 2 start
					if (t2 > 0.5 * explodeTime) {
						effect.fadeAlpha2 = Math.min(
							1,
							effect.fadeAlpha2 + dt / (0.1 * explodeTime)
						);
					}

					effect.juice.r = 0;
					effect.juice.scale = 0;

					if (t >= 1.5 * explodeTime) {
						this.activeEffect = null;
					}
				}
				break;
			}
		}
	}

	private isEffectDone(effect: NonNullable<ParticleSystem['activeEffect']>): boolean {
		return false; // controlled by updateEffect setting activeEffect to null
	}

	/** Port of particles.lua:144-163 */
	draw(): void {
		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);

		const cx = this.width / 2;
		const cy = this.height / 2;

		const fadeAlpha = this.activeEffect?.fadeAlpha ?? 0;

		for (const p of this.particles) {
			ctx.save();
			ctx.translate(cx + p.offset.x, cy + p.offset.y);
			ctx.rotate(p.facing);

			const alpha = p.colour[3] * (1 - fadeAlpha);
			ctx.fillStyle = `rgba(${Math.round(p.colour[0] * 255)}, ${Math.round(p.colour[1] * 255)}, ${Math.round(p.colour[2] * 255)}, ${alpha})`;
			ctx.fillRect(-p.scale / 2, -p.scale / 2, p.scale, p.scale);
			ctx.restore();
		}
	}

	getCanvas(): HTMLCanvasElement {
		return this.canvas;
	}

	resize(width: number, height: number): void {
		this.width = width;
		this.height = height;
		this.canvas.width = width;
		this.canvas.height = height;
	}

	/** card.lua:2130-2181 — start_dissolve */
	dissolve(): void {
		const dissolveTime = 0.7;
		// Default dissolve colours from card.lua:2134
		const colours: [number, number, number, number][] = [
			[0, 0, 0, 1],       // G.C.BLACK
			[1, 0.5, 0, 1],     // G.C.ORANGE
			[1, 0, 0, 1],       // G.C.RED
			[1, 0.8, 0, 1],     // G.C.GOLD
			[0.5, 0.5, 0.5, 1]  // G.C.JOKER_GREY
		];

		this.activeEffect = {
			type: 'dissolve',
			startTime: 0,
			elapsed: 0,
			dissolve: 0,
			phase: 0,
			spawnAccum: 0,
			fadeAlpha: 0,
			fadeAlpha2: 0,
			pulsed: 0,
			pulsed2: 0,
			juice: { scale: 0, r: 0 },
			config: {
				x: 0, y: 0,
				w: this.width, h: this.height,
				timer: 0.01 * dissolveTime,
				scale: 0.1,
				speed: 2,
				velVariation: 1,
				lifespan: 0.7 * dissolveTime,
				colours,
				fill: true
			}
		};
	}

	/** card.lua:2079-2128 — shatter */
	shatter(): void {
		const dissolveTime = 0.7;
		const colours: [number, number, number, number][] = [[1, 1, 1, 0.8]];

		this.activeEffect = {
			type: 'shatter',
			startTime: 0,
			elapsed: 0,
			dissolve: 0,
			phase: 0,
			spawnAccum: 0,
			fadeAlpha: 0,
			fadeAlpha2: 0,
			pulsed: 0,
			pulsed2: 0,
			juice: { scale: 0, r: 0 },
			config: {
				x: 0, y: 0,
				w: this.width, h: this.height,
				timer: 0.007 * dissolveTime,
				scale: 0.3,
				speed: 4,
				velVariation: 1,
				lifespan: 0.5 * dissolveTime,
				colours,
				fill: true
			}
		};
	}

	/** card.lua:2183-2240 — start_materialize */
	materialize(): void {
		const dissolveTime = 0.6;
		const colours: [number, number, number, number][] = [
			[0, 0.5, 0, 1] // G.C.GREEN (default)
		];

		this.activeEffect = {
			type: 'materialize',
			startTime: 0,
			elapsed: 0,
			dissolve: 1, // starts at 1, goes to 0
			phase: 0,
			spawnAccum: 0,
			fadeAlpha: 0,
			fadeAlpha2: 0,
			pulsed: 0,
			pulsed2: 0,
			juice: { scale: 0, r: 0 },
			config: {
				x: 0, y: 0,
				w: this.width, h: this.height,
				timer: 0.025 * dissolveTime,
				scale: 0.25,
				speed: 3,
				velVariation: 1,
				lifespan: 0.7 * dissolveTime,
				colours,
				fill: true
			}
		};
	}

	/** card.lua:1973-2077 — explode */
	explode(colours?: [number, number, number, number][]): void {
		const explodeTime = 1.3;
		const dissolveColours = colours ?? [[1, 1, 1, 1]];

		this.activeEffect = {
			type: 'explode',
			startTime: 0,
			elapsed: 0,
			dissolve: 0,
			phase: 0,
			spawnAccum: 0,
			fadeAlpha: 0,
			fadeAlpha2: 0,
			pulsed: 0,
			pulsed2: 0,
			juice: { scale: 0, r: 0 },
			config: {
				x: 0, y: 0,
				w: this.width, h: this.height,
				timer: 0.01 * explodeTime,
				scale: 0.2,
				speed: 2,
				velVariation: 1,
				lifespan: 0.2 * explodeTime,
				colours: dissolveColours,
				fill: true
			},
			config2: {
				x: 0, y: 0,
				w: this.width, h: this.height,
				timer: 0.003,
				scale: 0.6,
				speed: 15,
				velVariation: 1,
				lifespan: 0.5,
				colours: dissolveColours,
				fill: false,
				pulseMax: 30
			}
		};
	}

	clear(): void {
		this.particles = [];
		this.activeEffect = null;
	}

	isActive(): boolean {
		return this.activeEffect !== null || this.particles.length > 0;
	}
}
