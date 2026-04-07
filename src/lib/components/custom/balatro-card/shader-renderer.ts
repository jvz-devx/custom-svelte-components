/**
 * Shared WebGL shader renderer.
 * Renders card shaders to an offscreen canvas, returns ImageData or data URLs.
 * One WebGL context shared across all cards.
 */

import vertexSrc from './shaders/vertex.glsl?raw';
import foilFrag from './shaders/foil.frag.glsl?raw';
import polychromeFrag from './shaders/polychrome.frag.glsl?raw';
import negativeFrag from './shaders/negative.frag.glsl?raw';
import foilOverlayFrag from './shaders/foil.overlay.frag.glsl?raw';
import polychromeOverlayFrag from './shaders/polychrome.overlay.frag.glsl?raw';
import type { CardEdition } from './types.js';

// WebGL2 vertex shader (simpler, no Three.js uniforms)
const VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// Adapt fragment shaders to WebGL2 (no Three.js uniforms)
function adaptFragment(src: string): string {
	return `#version 300 es
precision highp float;
uniform float time;
uniform vec2 mouse;
uniform sampler2D cardTexture;
in vec2 vUv;
out vec4 fragColor;

${src
	.replace(/uniform float time;/, '')
	.replace(/uniform vec2 mouse;/, '')
	.replace(/uniform sampler2D cardTexture;/, '')
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
uniform float time;
uniform vec2 mouse;
in vec2 vUv;
out vec4 fragColor;

${src
	.replace(/uniform float time;/, '')
	.replace(/uniform vec2 mouse;/, '')
	.replace(/varying vec2 vUv;/, '')
	.replace(/void main\(\)/, 'void mainEffect()')
	.replace(/gl_FragColor\s*=\s*/g, 'fragColor = ')
	.replace(/texture2D\(/g, 'texture(')}

void main() {
  mainEffect();
}`;
}

type OverlayEdition = 'foil' | 'polychrome';

const overlayFragShaders: Record<OverlayEdition, string> = {
	foil: adaptOverlayFragment(foilOverlayFrag),
	polychrome: adaptOverlayFragment(polychromeOverlayFrag)
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
		uniforms: {
			time: gl.getUniformLocation(program, 'time'),
			mouse: gl.getUniformLocation(program, 'mouse'),
			cardTexture: null
		}
	};

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
	negative: adaptFragment(negativeFrag)
};

type CompiledProgram = {
	program: WebGLProgram;
	uniforms: {
		time: WebGLUniformLocation | null;
		mouse: WebGLUniformLocation | null;
		cardTexture: WebGLUniformLocation | null;
	};
};

let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let gl: WebGL2RenderingContext | null = null;
let programs: Map<CardEdition, CompiledProgram> = new Map();
let quadBuffer: WebGLBuffer | null = null;

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
}

function compileProgram(edition: CardEdition): CompiledProgram | null {
	if (!gl) return null;

	const existing = programs.get(edition);
	if (existing) return existing;

	const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
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

	const compiled: CompiledProgram = {
		program,
		uniforms: {
			time: gl.getUniformLocation(program, 'time'),
			mouse: gl.getUniformLocation(program, 'mouse'),
			cardTexture: gl.getUniformLocation(program, 'cardTexture')
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
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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
	mouseY: number
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

	// Bind quad
	gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

	// Uniforms
	if (prog.uniforms.time) gl.uniform1f(prog.uniforms.time, time);
	if (prog.uniforms.mouse) gl.uniform2f(prog.uniforms.mouse, mouseX, mouseY);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, tex);
	if (prog.uniforms.cardTexture) gl.uniform1i(prog.uniforms.cardTexture, 0);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

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
	edition: 'foil' | 'polychrome',
	width: number,
	height: number,
	time: number,
	mouseX: number,
	mouseY: number
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

/**
 * Invalidate the texture cache for a card canvas (call when card content changes).
 */
export function invalidateTexture(cardCanvas: HTMLCanvasElement) {
	textureCache.delete(cardCanvas);
}
