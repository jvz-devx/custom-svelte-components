#version 300 es
// Dissolve vertex shader — ported from Balatro dissolve.fs #ifdef VERTEX
// Implements hover bulge: card geometry pushes toward cursor on hover.
// Requires subdivided quad mesh for visible displacement.

uniform vec2 mouse_screen_pos;
uniform float hovering;
uniform float screen_scale;
uniform vec2 resolution; // replaces love_ScreenSize

in vec2 position; // 0-1 grid coordinates

out vec2 vUv;

void main() {
    vUv = position;
    vec2 clip = position * 2.0 - 1.0;

    if (hovering <= 0.) {
        gl_Position = vec4(clip, 0.0, 1.0);
        return;
    }

    // Port of Balatro dissolve.fs vertex hover bulge (lines 79-84)
    // Convert from 0-1 grid to screen-pixel space for the math
    vec2 screen_pos = position * resolution;

    float mid_dist = length(screen_pos - 0.5 * resolution) / length(resolution);
    vec2 mouse_offset = (screen_pos - mouse_screen_pos) / screen_scale;
    float scale = 0.2 * (-0.03 - 0.3 * max(0., 0.3 - mid_dist))
                * hovering * (length(mouse_offset) * length(mouse_offset)) / (2. - mid_dist);

    // Balatro: transform_projection * vertex_position + vec4(0,0,0,scale)
    // The w-component offset creates perspective-divide displacement
    gl_Position = vec4(clip, 0.0, 1.0 + scale);
}
