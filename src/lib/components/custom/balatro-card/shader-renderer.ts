/**
 * Shared WebGL shader renderer.
 * Renders card shaders to an offscreen canvas, returns ImageData or data URLs.
 * One WebGL context shared across all cards.
 */

import vertexSrc from './shaders/vertex.glsl?raw';
import foilFrag from './shaders/foil.frag.glsl?raw';
import polychromeFrag from './shaders/polychrome.frag.glsl?raw';
import negativeFrag from './shaders/negative.frag.glsl?raw';
import holoFrag from './shaders/holo.frag.glsl?raw';
import negativeShineFrag from './shaders/negative_shine.frag.glsl?raw';
import foilOverlayFrag from './shaders/foil.overlay.frag.glsl?raw';
import polychromeOverlayFrag from './shaders/polychrome.overlay.frag.glsl?raw';
import holoOverlayFrag from './shaders/holo.overlay.frag.glsl?raw';
import dissolveVertSrc from './shaders/dissolve.vert.glsl?raw';
import dissolveFragSrc from './shaders/dissolve.frag.glsl?raw';
import type { CardEdition } from './types.js';

// WebGL2 vertex shader (simpler, no Three.js uniforms)
const VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// All Balatro uniforms declared for fragment shaders
const BALATRO_UNIFORMS = `
uniform float time;
uniform vec2 mouse;
uniform vec2 edition_params;
uniform float hovering;
uniform float screen_scale;
uniform float dissolve;
uniform vec4 texture_details;
uniform vec2 image_details;
uniform bool shadow;
uniform vec4 burn_colour_1;
uniform vec4 burn_colour_2;
`;

// Adapt fragment shaders to WebGL2 (no Three.js uniforms)
function adaptFragment(src: string): string {
	return `#version 300 es
precision highp float;
${BALATRO_UNIFORMS}
uniform sampler2D cardTexture;
in vec2 vUv;
out vec4 fragColor;

${src
	.replace(/uniform float time;/, '')
	.replace(/uniform vec2 mouse;/, '')
	.replace(/uniform sampler2D cardTexture;/, '')
	.replace(/uniform float hovering;/, '')
	.replace(/uniform float screen_scale;/, '')
	.replace(/uniform float dissolve;/, '')
	.replace(/uniform vec4 texture_details;/, '')
	.replace(/uniform vec2 image_details;/, '')
	.replace(/uniform bool shadow;/, '')
	.replace(/uniform vec4 burn_colour_1;/, '')
	.replace(/uniform vec4 burn_colour_2;/, '')
	.replace(/varying vec2 vUv;/, '')
	.replace(/void main\(\)/, 'void mainEffect()')
	.replace(/gl_FragColor\s*=\s*/g, 'fragColor = ')
	.replace(/texture2D\(/g, 'texture(')}

void main() {
  mainEffect();
}`;
}

// Adapt overlay fragment shaders (no cardTexture uniform)
function adaptOverlayFragment(src: string): string {
	return `#version 300 es
precision highp float;
${BALATRO_UNIFORMS}
in vec2 vUv;
out vec4 fragColor;

${src
	.replace(/uniform float time;/, '')
	.replace(/uniform vec2 mouse;/, '')
	.replace(/uniform float hovering;/, '')
	.replace(/uniform float screen_scale;/, '')
	.replace(/uniform float dissolve;/, '')
	.replace(/uniform vec4 texture_details;/, '')
	.replace(/uniform vec2 image_details;/, '')
	.replace(/uniform bool shadow;/, '')
	.replace(/uniform vec4 burn_colour_1;/, '')
	.replace(/uniform vec4 burn_colour_2;/, '')
	.replace(/varying vec2 vUv;/, '')
	.replace(/void main\(\)/, 'void mainEffect()')
	.replace(/gl_FragColor\s*=\s*/g, 'fragColor = ')
	.replace(/texture2D\(/g, 'texture(')}

void main() {
  mainEffect();
}`;
}

type OverlayEdition = 'foil' | 'polychrome' | 'holo';

const overlayFragShaders: Record<OverlayEdition, string> = {
	foil: adaptOverlayFragment(foilOverlayFrag),
	polychrome: adaptOverlayFragment(polychromeOverlayFrag),
	holo: adaptOverlayFragment(holoOverlayFrag)
};

let overlayPrograms: Map<OverlayEdition, CompiledProgram> = new Map();

function compileOverlayProgram(edition: OverlayEdition): CompiledProgram | null {
	if (!gl) return null;

	const existing = overlayPrograms.get(edition);
	if (existing) return existing;

	const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, overlayFragShaders[edition]);
	if (!vs || !fs) return null;

	const program = gl.createProgram()!;
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.bindAttribLocation(program, 0, 'position');
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error('Overlay shader link error:', gl.getProgramInfoLog(program));
		return null;
	}

	const compiled: CompiledProgram = {
		program,
		uniforms: getUniformLocations(gl, program)
	};
	compiled.uniforms.cardTexture = null;

	overlayPrograms.set(edition, compiled);
	return compiled;
}

const FRAG_BASE = `#version 300 es
precision highp float;
uniform sampler2D cardTexture;
in vec2 vUv;
out vec4 fragColor;
void main() {
  fragColor = texture(cardTexture, vUv);
}`;

const fragShaders: Record<CardEdition, string> = {
	base: FRAG_BASE,
	foil: adaptFragment(foilFrag),
	polychrome: adaptFragment(polychromeFrag),
	negative: adaptFragment(negativeFrag),
	holo: adaptFragment(holoFrag),
	negative_shine: adaptFragment(negativeShineFrag)
};

type CompiledProgram = {
	program: WebGLProgram;
	uniforms: {
		time: WebGLUniformLocation | null;
		mouse: WebGLUniformLocation | null;
		cardTexture: WebGLUniformLocation | null;
		hovering: WebGLUniformLocation | null;
		screen_scale: WebGLUniformLocation | null;
		dissolve: WebGLUniformLocation | null;
		texture_details: WebGLUniformLocation | null;
		image_details: WebGLUniformLocation | null;
		shadow: WebGLUniformLocation | null;
		burn_colour_1: WebGLUniformLocation | null;
		burn_colour_2: WebGLUniformLocation | null;
		edition_params: WebGLUniformLocation | null;
	};
};

function getUniformLocations(ctx: WebGL2RenderingContext, program: WebGLProgram): CompiledProgram['uniforms'] {
	return {
		time: ctx.getUniformLocation(program, 'time'),
		mouse: ctx.getUniformLocation(program, 'mouse'),
		cardTexture: ctx.getUniformLocation(program, 'cardTexture'),
		hovering: ctx.getUniformLocation(program, 'hovering'),
		screen_scale: ctx.getUniformLocation(program, 'screen_scale'),
		dissolve: ctx.getUniformLocation(program, 'dissolve'),
		texture_details: ctx.getUniformLocation(program, 'texture_details'),
		image_details: ctx.getUniformLocation(program, 'image_details'),
		shadow: ctx.getUniformLocation(program, 'shadow'),
		burn_colour_1: ctx.getUniformLocation(program, 'burn_colour_1'),
		burn_colour_2: ctx.getUniformLocation(program, 'burn_colour_2'),
		edition_params: ctx.getUniformLocation(program, 'edition_params'),
	};
}

export type ShaderUniforms = {
	hovering?: number;
	screenScale?: number;
	textureDetails?: [number, number, number, number];
	imageDetails?: [number, number];
	dissolve?: number;
	burnColour1?: [number, number, number, number];
	burnColour2?: [number, number, number, number];
	shadow?: boolean;
	editionParams?: [number, number]; // Per-shader vec2: [send_to_shader[1], send_to_shader[2]]
};

function sendBalatroUniforms(ctx: WebGL2RenderingContext, u: CompiledProgram['uniforms'], opts: ShaderUniforms) {
	if (u.hovering) ctx.uniform1f(u.hovering, opts.hovering ?? 0);
	if (u.screen_scale) ctx.uniform1f(u.screen_scale, opts.screenScale ?? 1);
	if (u.dissolve) ctx.uniform1f(u.dissolve, opts.dissolve ?? 0);
	if (u.texture_details) ctx.uniform4f(u.texture_details, ...(opts.textureDetails ?? [0, 0, 142, 190]));
	if (u.image_details) ctx.uniform2f(u.image_details, ...(opts.imageDetails ?? [1846, 760]));
	if (u.shadow) ctx.uniform1i(u.shadow, opts.shadow ? 1 : 0);
	if (u.burn_colour_1) ctx.uniform4f(u.burn_colour_1, ...(opts.burnColour1 ?? [0, 0, 0, 0]));
	if (u.burn_colour_2) ctx.uniform4f(u.burn_colour_2, ...(opts.burnColour2 ?? [0, 0, 0, 0]));
	if (u.edition_params) ctx.uniform2f(u.edition_params, ...(opts.editionParams ?? [0, 0]));
}

let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let gl: WebGL2RenderingContext | null = null;
let programs: Map<CardEdition, DissolveProgram> = new Map();
let quadBuffer: WebGLBuffer | null = null;

// Subdivided grid mesh for dissolve vertex bulge (20x20 grid)
const GRID_SUBDIVISIONS = 20;
let gridBuffer: WebGLBuffer | null = null;
let gridIndexBuffer: WebGLBuffer | null = null;
let gridIndexCount = 0;

function createGridMesh(ctx: WebGL2RenderingContext): void {
	if (gridBuffer) return;

	const n = GRID_SUBDIVISIONS;
	const verts: number[] = [];
	const indices: number[] = [];

	// Generate vertices (0-1 range, vertex shader maps to clip space)
	for (let y = 0; y <= n; y++) {
		for (let x = 0; x <= n; x++) {
			verts.push(x / n, y / n);
		}
	}

	// Generate triangle indices
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < n; x++) {
			const i = y * (n + 1) + x;
			indices.push(i, i + 1, i + n + 1);
			indices.push(i + 1, i + n + 2, i + n + 1);
		}
	}

	gridBuffer = ctx.createBuffer();
	ctx.bindBuffer(ctx.ARRAY_BUFFER, gridBuffer);
	ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(verts), ctx.STATIC_DRAW);

	gridIndexBuffer = ctx.createBuffer();
	ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, gridIndexBuffer);
	ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), ctx.STATIC_DRAW);

	gridIndexCount = indices.length;
}

// Dissolve program (custom vertex + fragment shader)
type DissolveProgram = {
	program: WebGLProgram;
	uniforms: CompiledProgram['uniforms'] & {
		mouse_screen_pos: WebGLUniformLocation | null;
		resolution: WebGLUniformLocation | null;
	};
};

let dissolveProgram: DissolveProgram | null = null;

function compileDissolveProgram(): DissolveProgram | null {
	if (!gl) return null;
	if (dissolveProgram) return dissolveProgram;

	const vs = compileShader(gl, gl.VERTEX_SHADER, dissolveVertSrc);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, dissolveFragSrc);
	if (!vs || !fs) return null;

	const program = gl.createProgram()!;
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.bindAttribLocation(program, 0, 'position');
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error('Dissolve shader link error:', gl.getProgramInfoLog(program));
		return null;
	}

	dissolveProgram = {
		program,
		uniforms: {
			...getUniformLocations(gl, program),
			mouse_screen_pos: gl.getUniformLocation(program, 'mouse_screen_pos'),
			resolution: gl.getUniformLocation(program, 'resolution'),
		}
	};

	return dissolveProgram;
}

function init(width: number, height: number) {
	if (gl) {
		// Resize if needed
		if (canvas!.width !== width || canvas!.height !== height) {
			canvas!.width = width;
			canvas!.height = height;
			gl.viewport(0, 0, width, height);
		}
		return;
	}

	if (typeof OffscreenCanvas !== 'undefined') {
		canvas = new OffscreenCanvas(width, height);
	} else {
		canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
	}

	gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: false,
		preserveDrawingBuffer: true
	}) as WebGL2RenderingContext;

	if (!gl) {
		console.error('WebGL2 not available');
		return;
	}

	// Fullscreen quad
	quadBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);

	// Subdivided grid mesh for dissolve vertex bulge
	createGridMesh(gl);
}

function compileProgram(edition: CardEdition): DissolveProgram | null {
	if (!gl) return null;

	const existing = programs.get(edition);
	if (existing) return existing as DissolveProgram;

	// Use dissolve vertex shader for ALL editions (provides hover bulge effect)
	// In Balatro, every shader includes the vertex hover bulge code
	const vs = compileShader(gl, gl.VERTEX_SHADER, dissolveVertSrc);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragShaders[edition]);
	if (!vs || !fs) return null;

	const program = gl.createProgram()!;
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.bindAttribLocation(program, 0, 'position');
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error('Shader link error:', gl.getProgramInfoLog(program));
		return null;
	}

	const compiled: DissolveProgram = {
		program,
		uniforms: {
			...getUniformLocations(gl, program),
			mouse_screen_pos: gl.getUniformLocation(program, 'mouse_screen_pos'),
			resolution: gl.getUniformLocation(program, 'resolution'),
		}
	};

	programs.set(edition, compiled);
	return compiled;
}

function compileShader(
	ctx: WebGL2RenderingContext,
	type: number,
	source: string
): WebGLShader | null {
	const shader = ctx.createShader(type)!;
	ctx.shaderSource(shader, source);
	ctx.compileShader(shader);
	if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
		console.error('Shader compile error:', ctx.getShaderInfoLog(shader));
		ctx.deleteShader(shader);
		return null;
	}
	return shader;
}

let textureCache = new WeakMap<HTMLCanvasElement, WebGLTexture>();

function getTexture(cardCanvas: HTMLCanvasElement): WebGLTexture | null {
	if (!gl) return null;

	const cached = textureCache.get(cardCanvas);
	if (cached) return cached;

	const tex = gl.createTexture()!;
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cardCanvas);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	textureCache.set(cardCanvas, tex);
	return tex;
}

/**
 * Render a card with the given edition shader.
 * Returns a data URL of the rendered result.
 */
export function renderShaderCard(
	cardCanvas: HTMLCanvasElement,
	edition: CardEdition,
	time: number,
	mouseX: number,
	mouseY: number,
	cardTimeSeed: number = 0,
	uniforms: DissolveUniforms = {}
): string | null {
	const w = cardCanvas.width;
	const h = cardCanvas.height;

	init(w, h);
	if (!gl || !canvas) return null;

	const prog = compileProgram(edition);
	if (!prog) return null;

	const tex = getTexture(cardCanvas);
	if (!tex) return null;

	gl.viewport(0, 0, w, h);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.useProgram(prog.program);

	// Bind grid mesh (for vertex hover bulge — matches Balatro where all shaders have vertex displacement)
	gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gridIndexBuffer);

	// Uniforms
	if (prog.uniforms.time) gl.uniform1f(prog.uniforms.time, time);
	if (prog.uniforms.mouse) gl.uniform2f(prog.uniforms.mouse, mouseX, mouseY);
	sendBalatroUniforms(gl, prog.uniforms, uniforms);

	// Dissolve vertex shader uniforms (hover bulge)
	const msp = uniforms.mouseScreenPos ?? [w / 2, h / 2];
	if (prog.uniforms.mouse_screen_pos) gl.uniform2f(prog.uniforms.mouse_screen_pos, msp[0], msp[1]);
	if (prog.uniforms.resolution) gl.uniform2f(prog.uniforms.resolution, w, h);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, tex);
	if (prog.uniforms.cardTexture) gl.uniform1i(prog.uniforms.cardTexture, 0);

	gl.drawElements(gl.TRIANGLES, gridIndexCount, gl.UNSIGNED_SHORT, 0);

	// Read back as data URL
	if (canvas instanceof HTMLCanvasElement) {
		return canvas.toDataURL();
	} else {
		// OffscreenCanvas — convert to blob then URL
		// For simplicity, fall back to reading pixels
		const pixels = new Uint8Array(w * h * 4);
		gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

		// Flip Y and write to a temp canvas
		const tmp = document.createElement('canvas');
		tmp.width = w;
		tmp.height = h;
		const ctx2d = tmp.getContext('2d')!;
		const imageData = ctx2d.createImageData(w, h);

		for (let y = 0; y < h; y++) {
			const srcRow = (h - 1 - y) * w * 4;
			const dstRow = y * w * 4;
			imageData.data.set(pixels.subarray(srcRow, srcRow + w * 4), dstRow);
		}

		ctx2d.putImageData(imageData, 0, 0);
		return tmp.toDataURL();
	}
}

/**
 * Render an edition overlay (no card texture — just the effect pattern on transparent).
 * Used for foil and polychrome which are composited on top of the base card via CSS blend modes.
 */
export function renderShaderOverlay(
	edition: 'foil' | 'polychrome' | 'holo',
	width: number,
	height: number,
	time: number,
	mouseX: number,
	mouseY: number,
	cardTimeSeed: number = 0,
	uniforms: ShaderUniforms = {}
): string | null {
	init(width, height);
	if (!gl || !canvas) return null;

	const prog = compileOverlayProgram(edition);
	if (!prog) return null;

	gl.viewport(0, 0, width, height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	gl.useProgram(prog.program);

	gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

	if (prog.uniforms.time) gl.uniform1f(prog.uniforms.time, time);
	if (prog.uniforms.mouse) gl.uniform2f(prog.uniforms.mouse, mouseX, mouseY);
	sendBalatroUniforms(gl, prog.uniforms, uniforms);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	gl.disable(gl.BLEND);

	if (canvas instanceof HTMLCanvasElement) {
		return canvas.toDataURL();
	} else {
		const pixels = new Uint8Array(width * height * 4);
		gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

		const tmp = document.createElement('canvas');
		tmp.width = width;
		tmp.height = height;
		const ctx2d = tmp.getContext('2d')!;
		const imageData = ctx2d.createImageData(width, height);

		for (let y = 0; y < height; y++) {
			const srcRow = (height - 1 - y) * width * 4;
			const dstRow = y * width * 4;
			imageData.data.set(pixels.subarray(srcRow, srcRow + width * 4), dstRow);
		}

		ctx2d.putImageData(imageData, 0, 0);
		return tmp.toDataURL();
	}
}

export type DissolveUniforms = ShaderUniforms & {
	mouseScreenPos?: [number, number];
	resolution?: [number, number];
};

/**
 * Render a card through the dissolve shader (primary card rendering path).
 * Identity pass when dissolve=0. Supports hover vertex bulge and shadow mode.
 * Uses subdivided grid mesh for vertex displacement.
 */
export function renderDissolveCard(
	cardCanvas: HTMLCanvasElement,
	time: number,
	mouseX: number,
	mouseY: number,
	uniforms: DissolveUniforms = {}
): string | null {
	const w = cardCanvas.width;
	const h = cardCanvas.height;

	init(w, h);
	if (!gl || !canvas) return null;

	const prog = compileDissolveProgram();
	if (!prog) return null;

	const tex = getTexture(cardCanvas);
	if (!tex) return null;

	gl.viewport(0, 0, w, h);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	gl.useProgram(prog.program);

	// Bind subdivided grid mesh
	gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gridIndexBuffer);

	// Fragment uniforms
	if (prog.uniforms.time) gl.uniform1f(prog.uniforms.time, time);
	if (prog.uniforms.mouse) gl.uniform2f(prog.uniforms.mouse, mouseX, mouseY);
	sendBalatroUniforms(gl, prog.uniforms, uniforms);

	// Vertex uniforms for hover bulge
	if (prog.uniforms.mouse_screen_pos) {
		const msp = uniforms.mouseScreenPos ?? [w / 2, h / 2];
		gl.uniform2f(prog.uniforms.mouse_screen_pos, msp[0], msp[1]);
	}
	if (prog.uniforms.resolution) {
		const res = uniforms.resolution ?? [w, h];
		gl.uniform2f(prog.uniforms.resolution, res[0], res[1]);
	}

	// Bind card texture
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, tex);
	if (prog.uniforms.cardTexture) gl.uniform1i(prog.uniforms.cardTexture, 0);

	gl.drawElements(gl.TRIANGLES, gridIndexCount, gl.UNSIGNED_SHORT, 0);

	gl.disable(gl.BLEND);

	// Read back as data URL
	if (canvas instanceof HTMLCanvasElement) {
		return canvas.toDataURL();
	} else {
		const pixels = new Uint8Array(w * h * 4);
		gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

		const tmp = document.createElement('canvas');
		tmp.width = w;
		tmp.height = h;
		const ctx2d = tmp.getContext('2d')!;
		const imageData = ctx2d.createImageData(w, h);

		for (let y = 0; y < h; y++) {
			const srcRow = (h - 1 - y) * w * 4;
			const dstRow = y * w * 4;
			imageData.data.set(pixels.subarray(srcRow, srcRow + w * 4), dstRow);
		}

		ctx2d.putImageData(imageData, 0, 0);
		return tmp.toDataURL();
	}
}

/**
 * Invalidate the texture cache for a card canvas (call when card content changes).
 */
export function invalidateTexture(cardCanvas: HTMLCanvasElement) {
	textureCache.delete(cardCanvas);
}
