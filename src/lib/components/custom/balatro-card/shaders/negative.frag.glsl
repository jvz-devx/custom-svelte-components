uniform float time;
uniform vec2 mouse;
uniform sampler2D cardTexture;
varying vec2 vUv;

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec4 texel = texture2D(cardTexture, vUv);

    // Invert
    vec3 inverted = 1.0 - texel.rgb;

    // HSV hue shift +0.05
    vec3 hsv = rgb2hsv(inverted);
    hsv.x = fract(hsv.x + 0.05);
    vec3 shifted = hsv2rgb(hsv);

    // Gentle pulsing purple glow
    float glowMask = 1.0 - length(vUv - vec2(0.5)) * 1.5;
    glowMask = max(glowMask, 0.0);
    float pulse = sin(time) * 0.1 + 0.15;
    vec3 glow = vec3(0.15, 0.1, 0.3) * glowMask * pulse;

    gl_FragColor = vec4(shifted + glow, texel.a);
}
