uniform float time;
uniform vec2 mouse;
varying vec2 vUv;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 center = vec2(0.5 + mouse.x * 0.2, 0.5 + mouse.y * 0.2);
    float dist = length(vUv - center);

    float hue = fract(dist * 1.5 + time * 0.08);
    vec3 rainbow = hsv2rgb(vec3(hue, 0.6, 0.9));

    float alpha = 0.7;
    gl_FragColor = vec4(rainbow, alpha);
}
