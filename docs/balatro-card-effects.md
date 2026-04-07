# Balatro Card Effects — Technical Reference

Research for reverse-engineering Balatro's card visual effects as Svelte components.

## Overview

Balatro uses Love2D (Lua + GLSL shaders) for rendering. Cards have multiple layered effects: base rendering, edition overlays (foil/polychrome/negative), hover distortion, 3D tilt, and a CRT-style background. All edition effects are shader passes composited on top of the base card sprite.

---

## 1. Base Card Rendering

**Dimensions:** ~5:7 aspect ratio (e.g., 150x210px in CSS recreations)

**Visual style:**
- Pixel art aesthetic enforced via `image-rendering: pixelated`
- Heavily rounded corners (~13% of card width, e.g., `border-radius: 20px` on 150px card)
- Default card back: light blue-white (`rgb(217, 227, 255)`)

**Layering (3D composited):**
- **Card face** — `translateZ(10px)` — the actual card content
- **Edition overlay** — `translateZ(20px)` — 150% of card size, centered over card, allows glow bleed
- **Shadow** — `translateZ(-10px)` — offset below with `rgba(0,0,0,0.308)` fill + `box-shadow: 0 0 10px rgba(0,0,0,0.644)`

**Container:**
- `perspective: 1000px`
- `transform-style: preserve-3d`

---

## 2. Card Tilt / Parallax Effect

Fake 3D perspective applied to a 2D sprite. The GLSL version constructs an inverse rotation matrix from x/y angles and projects UVs through a virtual camera.

**CSS/JS implementation:**

```css
.card {
  --t: 2px;          /* translation amount */
  --k: 0.05turn;     /* rotation amount (~18deg max) */
  transform:
    translate(calc(var(--t) * var(--x)), calc(var(--t) * var(--y)))
    rotateY(calc(var(--k) * var(--x)))
    rotateX(calc(var(--k) * var(--y)));
  transition: transform 500ms ease;
}
```

Where `--x` and `--y` are normalized `-1` to `1` from mouse position using `Math.atan2()`.

**Dynamic shadow:**

```css
box-shadow:
  calc(var(--k1) * var(--size) * var(--x))
  calc(var(--k1) * var(--size) * var(--y))
  calc(var(--k2) * var(--size) * var(--r))
  #0002;
```

Shadow offset follows tilt direction, blur scales with distance from center.

**GLSL uniforms (from Balatro source):**
- `fov`: hint_range(1, 179), default 90
- `y_rot`: hint_range(-180, 180)
- `x_rot`: hint_range(-180, 180)

---

## 3. Card Hover Animation

**Scale:** 30% scale up on hover (`scale3d(1.3, 1.3, 1.3)`)

**Easing:** `cubic-bezier(0.7, -3, 0.3, 3)` — exaggerated bouncy/elastic overshoot

**Z-index:** jumps from 50 to 999 so hovered card overlaps neighbors

**Vertex distortion shader (rubber bulge toward cursor):**

```glsl
float mid_dist = length(VERTEX.xy - 0.5 * screen_size) / length(screen_size);
vec2 mouse_offset = (VERTEX.xy + mouse_screen_pos.xy) / screen_scale;
float scale = 0.2 * (-0.03 - 0.3 * max(0.0, 0.3 - mid_dist))
            * hovering
            * (length(mouse_offset) * length(mouse_offset))
            / (2.0 - mid_dist);
VERTEX += scale;
```

- Creates a subtle gel-like bulge toward cursor position
- Intensity increases near cursor, attenuates at edges
- Only active when `hovering = 1.0`

**Idle animation:** Even without hover, cards have continuous subtle circular motion:
- `NORMAL_SPEED = 0.05`, `SLOW_SPEED = 0.02`
- Angle continuously increments via `requestAnimationFrame`
- On hover: speed increases, responds to mouse
- On mouseout: decelerates back to idle oscillation

---

## 4. Foil Edition

Blue-silver metallic shimmer with overlapping wave patterns. Resembles stamped metallic foil.

**Algorithm (from Balatro source, ported to Godot GLSL):**

1. Center UVs: `uv - vec2(0.5, 0.5)`
2. Compute luminance delta: `min(high, max(0.5, 1.0 - low))` where low/high = min/max of RGB
3. Generate 4 overlapping wave factors:
   - `fac`: Concentric ripples via `length(90.0 * adjusted_uv)` with time oscillation
   - `fac2`: Angular sweep via `dot(rotater, adjusted_uv)` — directional wipe
   - `fac3`: Horizontal bands from `sin(foil.r * 5.0 + uv.x * 3.0 + ...)`
   - `fac4`: Vertical bands from `sin(foil.r * 6.66 + uv.y * 3.8 + ...)`
4. Combine: `maxfac = max(fac + fac2 + fac3 + fac4, ...)`
5. Final color:
   - Reduce R and G by delta
   - Add back `delta * maxfac * 0.3`
   - Boost blue: `delta * maxfac * 1.9`
6. Alpha: `min(texel.a, 0.3 * texel.a + 0.9 * min(0.5, maxfac * 0.1))`

**Uniforms:**
- `offset` (vec2) — mouse position / card angle
- `speed` (float, 0-1) — animation speed

**Key characteristics:**
- Predominantly blue-silver palette
- Multiple overlapping wave patterns = liquid metal look
- Responds to mouse position
- Subtle alpha modulation

---

## 5. Polychrome Edition

Full-spectrum rainbow / iridescent oil-slick effect. Resembles a soap bubble.

**Algorithm (from Balatro wiki):**
1. Compute distance from each pixel to a reference point (influenced by mouse position)
2. Apply HSV hue rotation proportional to `distance + time`
3. The reference point shifts with cursor position
4. Time variable causes the rainbow to slowly flow/animate

**Key difference from foil:**
- Foil = monochromatic blue-silver with wave modulation
- Polychrome = full-spectrum hue rotation in HSV space
- Foil modifies luminance channels; polychrome rotates hue

**CSS approximation (hard-light blend):**

```css
.rainbow-overlay {
  mix-blend-mode: hard-light;
  background: linear-gradient(
    var(--angle),
    hsl(var(--angle) 100% 80% / 70%),
    hsl(var(--angle) 100% 80% / 10%) calc(100% * var(--r))
  );
}
```

Where `--angle` is derived from mouse position via `Math.atan2()`.

**Shadertoy recreations:**
- Polychrome: shadertoy.com/view/4cKfDc
- Holographic: shadertoy.com/view/XfKfDc

---

## 6. Negative Edition

Dark, ethereal, inverted card effect with luminous glow.

**Algorithm (from Balatro wiki):**
1. Color inversion: `1.0 - originalColor` per RGB channel
2. Additional slight hue rotation (a few degrees clockwise in HSV space)
3. Luminous glow/shine overlay on top (additive or screen blend)

**Key characteristics:**
- Dark/inverted card artwork
- NOT a straight inversion — shifted a few degrees in hue
- Glowing/luminous overlay
- Semi-transparent, ghostly quality

---

## 7. Edition Overlay System

All editions share a common rendering architecture:

**Shader uniforms sent to all card shaders (from sprite.lua):**
- `mouse_screen_pos` — cursor position in canvas coordinates
- `screen_scale` — computed from tilt scale and damping
- `hovering` — tilt intensity (0.0 to 1.0)
- `dissolve` — dissolution animation amount
- `time` — per-object animated time value (based on object ID for desync)
- `texture_details` — sprite atlas position and dimensions
- `image_details` — image pixel dimensions
- `burn_colour_1`, `burn_colour_2` — dissolution/burn effect colors
- `shadow` — boolean for shadow render pass

**Overlay sizing:** 150% of card dimensions, centered, to allow glow bleed beyond card edges.

**Activation:** `opacity: 0` by default, transitions to `opacity: 1` on hover.

---

## 8. Background Shader

The iconic wavy, turbulent, CRT-filtered background. This is the most widely documented Balatro shader.

**Uniforms and defaults:**

```glsl
uniform float spin_rotation_speed = 2.0;
uniform float move_speed = 7.0;
uniform vec2 offset = vec2(0., 0.);
uniform vec4 colour_1 = vec4(0.871, 0.267, 0.231, 1.0);  // #DE4440 warm red
uniform vec4 colour_2 = vec4(0.0, 0.42, 0.706, 1.0);     // #006BB4 blue
uniform vec4 colour_3 = vec4(0.086, 0.137, 0.145, 1.0);   // #162325 dark teal
uniform float contrast = 3.5;
uniform float lighting = 0.4;
uniform float spin_amount = 0.25;
uniform float pixel_filter = 740.;
```

**Algorithm:**
1. **Pixelate** UV coordinates: `floor(screen_coords / pixel_size) * pixel_size`
2. **Polar rotation**: convert to polar coords, rotate angle based on time * `spin_amount`
3. **Scale** UVs by 30x
4. **Domain warping**: 5 iterations of `uv += sin/cos` mixing — creates turbulent flow
5. **3-color gradient**: map resulting distance to colour_1/2/3 using weight functions
6. **Lighting** highlights added

**CRT overlay (separate pass):**

```glsl
// Horizontal wave distortion
float wave = sin((uv.y + time * 2.0) * 30.0) * 0.002;
uv.x += wave;

// Chromatic aberration
float caOffset = 0.002;

// Scanlines
float scanline = sin(uv.y * resolution.y * 1.5) * 0.05;

// Flicker
float flicker = 0.97 + 0.03 * sin(time * 120.0);

// Vignette
vec2 vPos = (uv - 0.5) * 0.6;
float vignette = 1.0 - dot(vPos, vPos);
vignette = pow(vignette, 3.0);

// Film grain
float noise = rand(uv * resolution + time * 60.0) * 0.04 - 0.02;
```

**WebGL implementation:** github.com/Azkun/balatroShader (~6KB, zero dependencies)

---

## 9. Sparkle / Shine Pattern

Used on holographic and polychrome overlays for the glitter/sparkle dot pattern:

```css
.shine {
  mix-blend-mode: hard-light;
  mask-image: linear-gradient(
    var(--angle),
    hsl(0 0% 0% / 70%),
    hsl(0 0% 0% / 0%) calc(100% * var(--r))
  );
  /* Multi-layer radial gradients creating sparkle dot grid */
  background: repeating-conic-gradient(...) /* complex pattern */;
}
```

The sparkle pattern is a masked, hard-light blended overlay that follows the cursor angle.

---

## 10. Fire / Flame Effect

Used on score numbers and chip displays. Separate shader available at godotshaders.com/shader/balatro-fire-shader/.

---

## Implementation Priority for Svelte Components

1. **Card base** — CSS perspective container, rounded corners, shadow, pixel rendering
2. **Tilt/parallax** — Mouse tracking with `rotateX`/`rotateY` + dynamic shadow
3. **Hover animation** — Bouncy scale with `cubic-bezier(0.7, -3, 0.3, 3)`
4. **Foil overlay** — CSS approximation with animated gradient or canvas/WebGL shader
5. **Polychrome overlay** — HSV hue rotation based on distance + time (needs canvas or WebGL)
6. **Negative overlay** — CSS `filter: invert(1) hue-rotate(Xdeg)` + glow
7. **Background shader** — WebGL (use existing balatroShader.js as base)
8. **CRT filter** — CSS filters + pseudo-element scanlines, or WebGL post-process

---

## Key Sources

| Source | URL | What |
|--------|-----|------|
| Godot Shaders - Foil | godotshaders.com/shader/balatro-foil-card-effect/ | Foil GLSL from source |
| Godot Shaders - Background | godotshaders.com/shader/balatro-background-shader/ | Background GLSL |
| Godot Shaders - Card Hover | godotshaders.com/shader/balatro-card-hover/ | Vertex bulge |
| Godot Shaders - Card Tilt | godotshaders.com/shader/balatro-card-tilt/ | 3D perspective |
| SunsetSamu CSS Recreation | github.com/SunsetSamu/balatro-cards-effect-css | CSS/JS card effects |
| wavebeem Holographic | wavebeem.com/toybox/2025/balatro/ | Web component |
| balatroShader.js | github.com/Azkun/balatroShader | WebGL background |
| Balatro Wiki - Polychrome | balatrowiki.org/w/Polychrome | Algorithm description |
| Balatro Wiki - Negative | balatrowiki.org/w/Negative | Inversion + hue shift |
| Shadertoy - Polychrome | shadertoy.com/view/4cKfDc | GLSL recreation |
| Shadertoy - Holographic | shadertoy.com/view/XfKfDc | GLSL recreation |
| Mix and Jam Unity | github.com/mixandjam/Balatro-Feel | Unity shader graphs |
| ReactBits Background | reactbits.dev/backgrounds/balatro | React component |
| Steamodded Modding | github.com/Steamodded/smods/wiki/SMODS.Edition | Edition/shader API |
