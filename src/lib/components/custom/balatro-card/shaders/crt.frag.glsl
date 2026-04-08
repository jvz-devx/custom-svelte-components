/**
 * Balatro CRT post-processing shader — ported from LÖVE2D to WebGL2 (GLSL ES 300).
 * Original: resources/shaders/CRT.fs
 *
 * All math is kept identical to the original.
 */

precision highp float;

uniform float time;
uniform vec2 distortion_fac;
uniform vec2 scale_fac;
uniform float feather_fac;
uniform float noise_fac;
uniform float bloom_fac;
uniform float crt_intensity;
uniform float glitch_intensity;
uniform float scanlines;
uniform vec2 screen_size;
uniform sampler2D tex;

in vec2 vUv;
out vec4 fragColor;

#define BUFF 0.01
#define BLOOM_AMT 3

void main()
{
    // Keep the original texture coords
    vec2 orig_tc = vUv;

    // Recenter
    vec2 tc = vUv * 2.0 - vec2(1.0);
    tc *= scale_fac;

    // Bulge from middle
    tc += (tc.yx * tc.yx) * tc * (distortion_fac - 1.0);

    // Smoothly transition the edge to black
    // Buffer for the outer edge, this gets wonky if there is no buffer
    float mask = (1.0 - smoothstep(1.0 - feather_fac, 1.0, abs(tc.x) - BUFF))
               * (1.0 - smoothstep(1.0 - feather_fac, 1.0, abs(tc.y) - BUFF));

    // Undo the recenter
    tc = (tc + vec2(1.0)) / 2.0;

    // Create the horizontal glitch offset effects
    float offset_l = 0.0;
    float offset_r = 0.0;
    if (glitch_intensity > 0.01) {
        float timefac = 3.0 * time;
        offset_l = 50.0 * (-3.5 + sin(timefac * 0.512 + tc.y * 40.0)
                + sin(-timefac * 0.8233 + tc.y * 81.532)
                + sin(timefac * 0.333 + tc.y * 30.3)
                + sin(-timefac * 0.1112331 + tc.y * 13.0));
        offset_r = -50.0 * (-3.5 + sin(timefac * 0.6924 + tc.y * 29.0)
                + sin(-timefac * 0.9661 + tc.y * 41.532)
                + sin(timefac * 0.4423 + tc.y * 40.3)
                + sin(-timefac * 0.13321312 + tc.y * 11.0));

        if (glitch_intensity > 1.0) {
            offset_l = 50.0 * (-1.5 + sin(timefac * 0.512 + tc.y * 4.0)
                + sin(-timefac * 0.8233 + tc.y * 1.532)
                + sin(timefac * 0.333 + tc.y * 3.3)
                + sin(-timefac * 0.1112331 + tc.y * 1.0));
            offset_r = -50.0 * (-1.5 + sin(timefac * 0.6924 + tc.y * 19.0)
                + sin(-timefac * 0.9661 + tc.y * 21.532)
                + sin(timefac * 0.4423 + tc.y * 20.3)
                + sin(-timefac * 0.13321312 + tc.y * 5.0));
        }
        tc.x = tc.x + 0.001 * glitch_intensity * clamp(offset_l, clamp(offset_r, -1.0, 0.0), 1.0);
    }

    // Apply mask and bulging effect
    vec4 crt_tex = texture(tex, tc);

    // Intensity multiplier for any visual artifacts
    float artifact_amplifier = (abs(clamp(offset_l, clamp(offset_r, -1.0, 0.0), 1.0)) * glitch_intensity > 0.9 ? 3.0 : 1.0);

    // Horizontal Chromatic Aberration
    float crt_amout_adjusted = (max(0.0, (crt_intensity) / (0.16 * 0.3))) * artifact_amplifier;
    if (crt_amout_adjusted > 0.0000001) {
        crt_tex.r = crt_tex.r * (1.0 - crt_amout_adjusted) + crt_amout_adjusted * texture(tex, tc + vec2(0.0005 * (1.0 + 10.0 * (artifact_amplifier - 1.0)) * 1600.0 / screen_size.x, 0.0)).r;
        crt_tex.g = crt_tex.g * (1.0 - crt_amout_adjusted) + crt_amout_adjusted * texture(tex, tc + vec2(-0.0005 * (1.0 + 10.0 * (artifact_amplifier - 1.0)) * 1600.0 / screen_size.x, 0.0)).g;
    }
    vec3 rgb_result = crt_tex.rgb * (1.0 - (1.0 * crt_intensity * artifact_amplifier));

    // Post processing on the glitch effect to amplify green or red for a few lines of pixels
    if (sin(time + tc.y * 200.0) > 0.85) {
        if (offset_l < 0.99 && offset_l > 0.01) rgb_result.r = rgb_result.g * 1.5;
        if (offset_r > -0.99 && offset_r < -0.01) rgb_result.g = rgb_result.r * 1.5;
    }

    // Add the pixel scanline overlay
    vec3 rgb_scanline = 1.0 * vec3(
        clamp(-0.3 + 2.0 * sin(tc.y * scanlines - 3.14 / 4.0) - 0.8 * clamp(sin(tc.x * scanlines * 4.0), 0.4, 1.0), -1.0, 2.0),
        clamp(-0.3 + 2.0 * cos(tc.y * scanlines) - 0.8 * clamp(cos(tc.x * scanlines * 4.0), 0.0, 1.0), -1.0, 2.0),
        clamp(-0.3 + 2.0 * cos(tc.y * scanlines - 3.14 / 3.0) - 0.8 * clamp(cos(tc.x * scanlines * 4.0 - 3.14 / 4.0), 0.0, 1.0), -1.0, 2.0));

    rgb_result += crt_tex.rgb * rgb_scanline * crt_intensity * artifact_amplifier;

    // Add in some noise
    float x = (tc.x - mod(tc.x, 0.002)) * (tc.y - mod(tc.y, 0.0013)) * time * 1000.0;
    x = mod(x, 13.0) * mod(x, 123.0);
    float dx = mod(x, 0.11) / 0.11;
    rgb_result = (1.0 - clamp(noise_fac * artifact_amplifier, 0.0, 1.0)) * rgb_result + dx * clamp(noise_fac * artifact_amplifier, 0.0, 1.0) * vec3(1.0, 1.0, 1.0);

    // Contrast and brightness correction for the CRT effect, also adjusting brightness for bloom
    rgb_result -= vec3(0.55 - 0.02 * (artifact_amplifier - 1.0 - crt_amout_adjusted * bloom_fac * 0.7));
    rgb_result = rgb_result * (1.0 + 0.14 + crt_amout_adjusted * (0.012 - bloom_fac * 0.12));
    rgb_result += vec3(0.5);

    // Prepare the final colour to return
    vec4 final_col = vec4(rgb_result * 1.0, 1.0);

    // Finally apply bloom
    vec4 col = vec4(0.0);
    float bloom = 0.0;

    if (bloom_fac > 0.00001 && crt_intensity > 0.000001) {
        bloom = 0.03 * (max(0.0, (crt_intensity) / (0.16 * 0.3)));
        float bloom_dist = 0.0015 * float(BLOOM_AMT);
        vec4 samp;
        float cutoff = 0.6;

        for (int i = -BLOOM_AMT; i <= BLOOM_AMT; ++i)
            for (int j = -BLOOM_AMT; j <= BLOOM_AMT; ++j) {
                samp = texture(tex, tc + (bloom_dist / float(BLOOM_AMT)) * vec2(float(i), float(j)));
                samp.r = max(1.0 / (1.0 - cutoff) * samp.r - 1.0 / (1.0 - cutoff) + 1.0, 0.0);
                samp.g = max(1.0 / (1.0 - cutoff) * samp.g - 1.0 / (1.0 - cutoff) + 1.0, 0.0);
                samp.b = max(1.0 / (1.0 - cutoff) * samp.b - 1.0 / (1.0 - cutoff) + 1.0, 0.0);
                col += min(min(samp.r, samp.g), samp.b) * (2.0 - float(abs(float(i + j))) / float(BLOOM_AMT + BLOOM_AMT));
            }

        col /= float(BLOOM_AMT * BLOOM_AMT);
        col.a = final_col.a;
    }

    fragColor = (final_col * (1.0 - 1.0 * bloom) + bloom * col) * mask;
}
