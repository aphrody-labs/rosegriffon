// Instanced 2D quad pipeline of the NIE web client (aphrody-nie-ui::paint::GpuQuad).
//
// One instance per quad, six vertices per instance, no vertex buffer for the corners. Colours
// are straight alpha in, premultiplied out (the canvas is configured premultiplied so a video
// element can show through transparent pixels). Every texture is sampled unconditionally at the
// top of the fragment stage: implicit derivatives require uniform control flow.

struct Screen {
    // Logical UI size in pixels (the painter coordinate space), padding.
    size: vec4<f32>,
};

@group(0) @binding(0) var<uniform> screen: Screen;
@group(1) @binding(0) var tex: texture_2d<f32>;
@group(1) @binding(1) var samp_linear: sampler;
@group(1) @binding(2) var samp_nearest: sampler;

struct Inst {
    @location(0) dst: vec4<f32>,
    @location(1) uv: vec4<f32>,
    @location(2) aux: vec4<f32>,
    @location(3) color: vec4<f32>,
    @location(4) params: vec4<f32>,
    @location(5) extra: vec4<f32>,
};

struct VOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) local: vec2<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) muv: vec2<f32>,
    @location(3) color: vec4<f32>,
    @location(4) @interpolate(flat) params: vec4<f32>,
    @location(5) @interpolate(flat) aux: vec4<f32>,
    @location(6) @interpolate(flat) extra: vec4<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, inst: Inst) -> VOut {
    var corners = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
        vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    );
    let c = corners[vi];
    let center = inst.dst.xy + inst.dst.zw * 0.5;
    let off = (c - vec2<f32>(0.5, 0.5)) * inst.dst.zw;
    // Clockwise on screen (y down), the inverse of the CPU blitter's sampling rotation.
    let a = inst.params.y;
    let ca = cos(a);
    let sa = sin(a);
    let p = center + vec2<f32>(off.x * ca - off.y * sa, off.x * sa + off.y * ca);
    var out: VOut;
    out.pos = vec4<f32>(p.x / screen.size.x * 2.0 - 1.0, 1.0 - p.y / screen.size.y * 2.0, 0.0, 1.0);
    out.local = c;
    out.uv = mix(inst.uv.xy, inst.uv.zw, c);
    out.muv = mix(inst.aux.xy, inst.aux.zw, c);
    out.color = inst.color;
    out.params = inst.params;
    out.aux = inst.aux;
    out.extra = inst.extra;
    return out;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4<f32> {
    let lin = textureSample(tex, samp_linear, in.uv);
    let mask = textureSample(tex, samp_linear, in.muv);
    let near = textureSample(tex, samp_nearest, in.uv);
    let kind = u32(in.params.x + 0.5);
    var c = in.color;
    switch kind {
        case 1u: {
            c = lin * in.color;
        }
        case 2u: {
            c = lin * in.color;
            c.a = c.a * mask.a;
        }
        case 3u: {
            let lum = dot(mask.rgb, vec3<f32>(77.0, 150.0, 29.0) / 256.0);
            c = lin * in.color;
            c.a = c.a * lum * mask.a;
        }
        case 4u: {
            let ch = min(u32(in.params.z + 0.5), 3u);
            c.a = in.color.a * near[ch];
        }
        case 5u: {
            let r = in.extra.x;
            let size = 2.0 * (r + 1.0);
            let d = length((in.local - vec2<f32>(0.5, 0.5)) * size);
            c.a = in.color.a * clamp(r + 0.6 - d, 0.0, 1.0);
        }
        case 6u: {
            c = mix(in.color, in.aux, in.local.y);
        }
        default: {}
    }
    return vec4<f32>(c.rgb * c.a, c.a);
}
