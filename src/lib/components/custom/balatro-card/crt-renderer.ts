/**
 * CRT post-processing renderer.
 * Applies the Balatro CRT shader as a full-screen post-processing pass
 * over a source canvas. Manages its own WebGL2 context.
 */

import crtFragSrc from './shaders/crt.frag.glsl?raw';

const VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
${crtFragSrc}`;

type CrtUniforms = {
	time: WebGLUniformLocation | null;
	distortion_fac: WebGLUniformLocation | null;
	scale_fac: WebGLUniformLocation | null;
	feather_fac: WebGLUniformLocation | null;
	noise_fac: WebGLUniformLocation | null;
	bloom_fac: WebGLUniformLocation | null;
	crt_intensity: WebGLUniformLocation | null;
	glitch_intensity: WebGLUniformLocation | null;
	scanlines: WebGLUniformLocation | null;
	screen_size: WebGLUniformLocation | null;
	tex: WebGLUniformLocation | null;
};

export interface CrtOptions {
	/** 0-100, maps to crt_intensity 0–0.16 */
	intensity?: number;
	/** Enable bloom */
	bloom?: boolean;
	/** Glitch level 0–2 */
	glitch?: number;
}

export class CrtRenderer {
	private canvas: HTMLCanvasElement;
	private gl: WebGL2RenderingContext | null = null;
	private program: WebGLProgram | null = null;
	private uniforms: CrtUniforms | null = null;
	private quadBuffer: WebGLBuffer | null = null;
	private sourceTexture: WebGLTexture | null = null;
	private startTime = 0;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.init();
	}

	private init() {
		const gl = this.canvas.getContext('webgl2', {
			alpha: true,
			premultipliedAlpha: false,
			preserveDrawingBuffer: false
		});

		if (!gl) {
			console.error('CRT renderer: WebGL2 not available');
			return;
		}

		this.gl = gl;
		this.startTime = performance.now() / 1000;

		// Compile shaders
		const vs = this.compileShader(gl.VERTEX_SHADER, VERT);
		const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAG);
		if (!vs || !fs) return;

		const program = gl.createProgram()!;
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.bindAttribLocation(program, 0, 'position');
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error('CRT shader link error:', gl.getProgramInfoLog(program));
			return;
		}

		this.program = program;

		this.uniforms = {
			time: gl.getUniformLocation(program, 'time'),
			distortion_fac: gl.getUniformLocation(program, 'distortion_fac'),
			scale_fac: gl.getUniformLocation(program, 'scale_fac'),
			feather_fac: gl.getUniformLocation(program, 'feather_fac'),
			noise_fac: gl.getUniformLocation(program, 'noise_fac'),
			bloom_fac: gl.getUniformLocation(program, 'bloom_fac'),
			crt_intensity: gl.getUniformLocation(program, 'crt_intensity'),
			glitch_intensity: gl.getUniformLocation(program, 'glitch_intensity'),
			scanlines: gl.getUniformLocation(program, 'scanlines'),
			screen_size: gl.getUniformLocation(program, 'screen_size'),
			tex: gl.getUniformLocation(program, 'tex')
		};

		// Fullscreen quad
		this.quadBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
			gl.STATIC_DRAW
		);

		// Source texture
		this.sourceTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}

	private compileShader(type: number, source: string): WebGLShader | null {
		const gl = this.gl!;
		const shader = gl.createShader(type)!;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error('CRT shader compile error:', gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	/**
	 * Render a source element through the CRT shader.
	 * Call this each frame in a rAF loop.
	 */
	render(source: TexImageSource, options: CrtOptions = {}) {
		const gl = this.gl;
		if (!gl || !this.program || !this.uniforms) return;

		const w = this.canvas.width;
		const h = this.canvas.height;

		const intensity = (options.intensity ?? 100) / 100;
		const crtIntensity = 0.16 * intensity;
		const bloomFac = options.bloom ? 1 : 0;
		const glitchIntensity = options.glitch ?? 0;

		// Balatro sends time as 400 + realtime
		const time = 400 + (performance.now() / 1000 - this.startTime);

		gl.viewport(0, 0, w, h);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(this.program);

		// Bind quad
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

		// Upload source texture
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

		// Set uniforms — Balatro's default values at CRT=100%
		gl.uniform1f(this.uniforms.time, time);
		gl.uniform2f(this.uniforms.distortion_fac, 1.0 + 0.07 * intensity, 1.0 + 0.1 * intensity);
		gl.uniform2f(this.uniforms.scale_fac, 1.0 - 0.008 * intensity, 1.0 - 0.008 * intensity);
		gl.uniform1f(this.uniforms.feather_fac, 0.01);
		gl.uniform1f(this.uniforms.noise_fac, 0.001 * intensity);
		gl.uniform1f(this.uniforms.bloom_fac, bloomFac);
		gl.uniform1f(this.uniforms.crt_intensity, crtIntensity);
		gl.uniform1f(this.uniforms.glitch_intensity, glitchIntensity);
		gl.uniform1f(this.uniforms.scanlines, h * 0.75);
		gl.uniform2f(this.uniforms.screen_size, w, h);
		gl.uniform1i(this.uniforms.tex, 0);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	resize(width: number, height: number) {
		this.canvas.width = width;
		this.canvas.height = height;
	}

	destroy() {
		const gl = this.gl;
		if (!gl) return;

		if (this.program) gl.deleteProgram(this.program);
		if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
		if (this.sourceTexture) gl.deleteTexture(this.sourceTexture);

		const ext = gl.getExtension('WEBGL_lose_context');
		if (ext) ext.loseContext();

		this.gl = null;
		this.program = null;
		this.uniforms = null;
	}
}
