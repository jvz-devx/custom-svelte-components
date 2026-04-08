<script lang="ts">
	import { onMount } from 'svelte';
	import backgroundFragSrc from './shaders/background.frag.glsl?raw';

	interface Props {
		/** Override colour_1 (center/primary). Default: Balatro's G.C.BLACK * 0.9 */
		colour1?: [number, number, number, number];
		/** Override colour_2 (light accent). Default: G.C.BLACK * 1.3 */
		colour2?: [number, number, number, number];
		/** Override colour_3 (dark). Default: G.C.BLACK * 0.7 */
		colour3?: [number, number, number, number];
		/** Contrast modifier. Default: 1 */
		contrast?: number;
		/** Spin amount (0 = no spin, 1 = full). Default: 0.3 */
		spinAmount?: number;
	}

	let {
		colour1 = [49.5/255, 59.4/255, 61.2/255, 1],
		colour2 = [71.5/255, 85.8/255, 88.4/255, 1],
		colour3 = [38.5/255, 46.2/255, 47.6/255, 1],
		contrast = 1,
		spinAmount = 0.3,
	}: Props = $props();

	let canvasEl: HTMLCanvasElement;
	let gl: WebGL2RenderingContext | null = null;
	let program: WebGLProgram | null = null;
	let startTime = 0;
	let active = true;
	let rafId: number | null = null;

	const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

	function adaptFrag(): string {
		return `#version 300 es
precision highp float;
uniform float time;
uniform float spin_time;
uniform vec4 colour_1;
uniform vec4 colour_2;
uniform vec4 colour_3;
uniform float contrast;
uniform float spin_amount;
uniform vec2 screen_size;
out vec4 fragColor;

#define PIXEL_SIZE_FAC 700.
#define SPIN_EASE 0.5

void main() {
    float pixel_size = length(screen_size) / PIXEL_SIZE_FAC;
    vec2 uv = (floor(gl_FragCoord.xy * (1. / pixel_size)) * pixel_size - 0.5 * screen_size) / length(screen_size) - vec2(0.12, 0.);
    float uv_len = length(uv);

    float speed = (spin_time * SPIN_EASE * 0.2) + 302.2;
    float new_pixel_angle = (atan(uv.y, uv.x)) + speed - SPIN_EASE * 20. * (1. * spin_amount * uv_len + (1. - 1. * spin_amount));
    vec2 mid = (screen_size / length(screen_size)) / 2.;
    uv = (vec2((uv_len * cos(new_pixel_angle) + mid.x), (uv_len * sin(new_pixel_angle) + mid.y)) - mid);

    uv *= 30.;
    speed = time * 2.;
    vec2 uv2 = vec2(uv.x + uv.y);

    for (int i = 0; i < 5; i++) {
        uv2 += sin(max(uv.x, uv.y)) + uv;
        uv  += 0.5 * vec2(cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121), sin(uv2.x - 0.113 * speed));
        uv  -= 1.0 * cos(uv.x + uv.y) - 1.0 * sin(uv.x * 0.711 - uv.y);
    }

    float contrast_mod = (0.25 * contrast + 0.5 * spin_amount + 1.2);
    float paint_res = min(2., max(0., length(uv) * 0.035 * contrast_mod));
    float c1p = max(0., 1. - contrast_mod * abs(1. - paint_res));
    float c2p = max(0., 1. - contrast_mod * abs(paint_res));
    float c3p = 1. - min(1., c1p + c2p);

    vec4 ret_col = (0.3 / contrast) * colour_1 + (1. - 0.3 / contrast) * (colour_1 * c1p + colour_2 * c2p + vec4(c3p * colour_3.rgb, c3p * colour_1.a));

    fragColor = ret_col;
}`;
	}

	onMount(() => {
		gl = canvasEl.getContext('webgl2', { alpha: false, premultipliedAlpha: false });
		if (!gl) return;

		// Compile shaders
		const vs = gl.createShader(gl.VERTEX_SHADER)!;
		gl.shaderSource(vs, VERT);
		gl.compileShader(vs);

		const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
		gl.shaderSource(fs, adaptFrag());
		gl.compileShader(fs);
		if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
			console.error('Background shader error:', gl.getShaderInfoLog(fs));
			return;
		}

		program = gl.createProgram()!;
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.bindAttribLocation(program, 0, 'position');
		gl.linkProgram(program);

		// Fullscreen quad
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

		startTime = performance.now() / 1000;

		function render() {
			if (!active || !gl || !program) return;

			const dpr = window.devicePixelRatio || 1;
			const rect = canvasEl.getBoundingClientRect();
			const w = Math.round(rect.width * dpr);
			const h = Math.round(rect.height * dpr);

			if (canvasEl.width !== w || canvasEl.height !== h) {
				canvasEl.width = w;
				canvasEl.height = h;
			}

			gl.viewport(0, 0, w, h);
			gl.useProgram(program);

			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

			const t = performance.now() / 1000 - startTime;

			const loc = (name: string) => gl!.getUniformLocation(program!, name);
			gl.uniform1f(loc('time'), t);
			gl.uniform1f(loc('spin_time'), t * spinAmount);
			gl.uniform4f(loc('colour_1'), ...colour1 as [number, number, number, number]);
			gl.uniform4f(loc('colour_2'), ...colour2 as [number, number, number, number]);
			gl.uniform4f(loc('colour_3'), ...colour3 as [number, number, number, number]);
			gl.uniform1f(loc('contrast'), contrast);
			gl.uniform1f(loc('spin_amount'), spinAmount);
			gl.uniform2f(loc('screen_size'), w, h);

			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

			rafId = requestAnimationFrame(render);
		}

		rafId = requestAnimationFrame(render);

		return () => {
			active = false;
			if (rafId !== null) cancelAnimationFrame(rafId);
		};
	});
</script>

<canvas
	bind:this={canvasEl}
	class="balatro-bg"
></canvas>

<style>
	.balatro-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}
</style>
