// Balatro holo rainbow grid pattern — overlay version (no card texture)
// Produces holographic grid + rainbow on transparent background for CSS compositing

uniform float time;
uniform vec2 mouse;
uniform vec4 texture_details;
uniform vec2 image_details;
varying vec2 vUv;

float hue(float s, float t, float h)
{
    float hs = mod(h, 1.)*6.;
    if (hs < 1.) return (t-s) * hs + s;
    if (hs < 3.) return t;
    if (hs < 4.) return (t-s) * (4.-hs) + s;
    return s;
}

vec4 RGB(vec4 c)
{
    if (c.y < 0.0001)
        return vec4(vec3(c.z), c.a);

    float t = (c.z < .5) ? c.y*c.z + c.z : -c.y*c.z + (c.y+c.z);
    float s = 2.0 * c.z - t;
    return vec4(hue(s,t,c.x + 1./3.), hue(s,t,c.x), hue(s,t,c.x - 1./3.), c.w);
}

void main()
{
    vec2 uv = (((vUv)*(image_details)) - texture_details.xy*texture_details.ba)/texture_details.ba;

    vec2 holo = edition_params;

    float t = holo.y*7.221 + time;
    vec2 floored_uv = (floor((uv*texture_details.ba)))/texture_details.ba;
    vec2 uv_scaled_centered = (floored_uv - 0.5) * 250.;

    vec2 field_part1 = uv_scaled_centered + 50.*vec2(sin(-t / 143.6340), cos(-t / 99.4324));
    vec2 field_part2 = uv_scaled_centered + 50.*vec2(cos( t / 53.1532),  cos( t / 61.4532));
    vec2 field_part3 = uv_scaled_centered + 50.*vec2(sin(-t / 87.53218), sin(-t / 49.0000));

    float field = (1.+ (
        cos(length(field_part1) / 19.483) + sin(length(field_part2) / 33.155) * cos(field_part2.y / 15.73) +
        cos(length(field_part3) / 27.193) * sin(field_part3.x / 21.92) ))/2.;

    float res = (.5 + .5* cos( (holo.x) * 2.612 + ( field + -.5 ) *3.14));

    // Diamond grid pattern (exact Balatro gridsize=0.79)
    float gridsize = 0.79;
    float fac = 0.5*max(max(max(0., 7.*abs(cos(uv.x*gridsize*20.))-6.),max(0., 7.*cos(uv.y*gridsize*45. + uv.x*gridsize*20.)-6.)), max(0., 7.*cos(uv.y*gridsize*45. - uv.x*gridsize*20.)-6.));

    // Generate holographic rainbow from Perlin field + grid
    vec4 hsl = vec4(res + fac, 0.8, 0.55, 1.0);
    vec3 rgb = RGB(hsl).rgb * vec3(0.9, 0.8, 1.2);

    float alpha = 0.5 + 0.2 * fac;

    gl_FragColor = vec4(rgb, alpha);
}
