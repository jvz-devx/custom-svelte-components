uniform float time;
uniform vec2 mouse;
uniform sampler2D cardTexture;
varying vec2 vUv;

void main() {
    vec4 texel = texture2D(cardTexture, vUv);
    vec2 uv = vUv;
    vec2 adjusted_uv = uv - vec2(0.5, 0.5);

    float low = min(texel.r, min(texel.g, texel.b));
    float high = max(texel.r, max(texel.g, texel.b));
    float delta = min(high, max(0.5, 1.0 - low));

    // foil.r = TIME/speed + offset.x, foil.g = offset.y
    // speed = 1.0, offset = mouse
    vec2 foil = vec2(time + mouse.x, mouse.y);

    float fac = max(min(2.0 * sin((length(90.0 * adjusted_uv) + foil.r * 2.0) + 3.0 * (1.0 + 0.8 * cos(length(113.1121 * adjusted_uv) - foil.r * 3.121))) - 1.0 - max(5.0 - length(90.0 * adjusted_uv), 0.0), 1.0), 0.0);

    vec2 rotater = vec2(cos(foil.r * 0.1221), sin(foil.r * 0.3512));
    float angle = dot(rotater, adjusted_uv) / (length(rotater) * length(adjusted_uv));
    float fac2 = max(min(5.0 * cos(foil.g * 0.3 + angle * 3.14 * (2.2 + 0.9 * sin(foil.r * 1.65 + 0.2 * foil.g))) - 4.0 - max(2.0 - length(20.0 * adjusted_uv), 0.0), 1.0), 0.0);

    float fac3 = 0.3 * max(min(2.0 * sin(foil.r * 5.0 + uv.x * 3.0 + 3.0 * (1.0 + 0.5 * cos(foil.r * 7.0))) - 1.0, 1.0), -1.0);
    float fac4 = 0.3 * max(min(2.0 * sin(foil.r * 6.66 + uv.y * 3.8 + 3.0 * (1.0 + 0.5 * cos(foil.r * 3.414))) - 1.0, 1.0), -1.0);

    float maxfac = max(max(fac, max(fac2, max(fac3, max(fac4, 0.0)))) + 2.2 * (fac + fac2 + fac3 + fac4), 0.0);

    texel.r = texel.r - delta + delta * maxfac * 0.3;
    texel.g = texel.g - delta + delta * maxfac * 0.3;
    texel.b = texel.b + delta * maxfac * 1.9;
    texel.a = min(texel.a, 0.3 * texel.a + 0.9 * min(0.5, maxfac * 0.1));

    gl_FragColor = texel;
}
