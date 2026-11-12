//! Painter abstraction shared by every 2D surface of the client (layout scenes, footer, EAC
//! window, match HUD).
//!
//! The drawing code is written once against [`Painter`]. [`RasterPainter`] writes RGBA8 pixels
//! on the CPU (golden tests, headless captures); [`QuadRecorder`] records the very same calls as
//! textured quads in a [`DrawList`] that a GPU backend draws in one instanced pass, so the
//! per-frame cost is an instance buffer, never a full-screen pixel buffer.

use aphrody_nie_formats::font::GlyphMetric;

use crate::compositor::{
    AtlasRegion, DecodedAtlas, blit_region_transformed, blit_scaled_glyph, fill_rect_alpha,
    fill_solid,
};
use crate::gamepad_glyphs::draw_filled_disc;

/// Drawing target for the 2D compositor.
pub trait Painter {
    /// Target size in pixels.
    fn size(&self) -> (u32, u32);
    /// Replaces every pixel with `color`.
    fn clear(&mut self, color: [u8; 4]);
    /// Alpha-blends a solid rectangle.
    fn fill_rect(&mut self, x: i32, y: i32, w: i32, h: i32, color: [u8; 4]);
    /// Alpha-blends an anti-aliased disc.
    fn fill_disc(&mut self, cx: f32, cy: f32, radius: f32, color: [u8; 4]);
    /// Blits `region` of the atlas `key` (optionally masked and rotated) into a destination box.
    #[allow(clippy::too_many_arguments)]
    fn blit(
        &mut self,
        key: &str,
        atlas: &DecodedAtlas,
        region: AtlasRegion,
        mask: Option<AtlasRegion>,
        mask_luminance: bool,
        rotation_deg: f32,
        opacity: u8,
        dst: [i32; 4],
    );
    /// Draws one `font_def` glyph (coverage stored in channel `metric.page` of the font atlas).
    #[allow(clippy::too_many_arguments)]
    fn glyph(
        &mut self,
        font_rgba: &[u8],
        font_w: u32,
        metric: &GlyphMetric,
        cell_h: u16,
        x: i32,
        y: i32,
        scale: f32,
        color: [u8; 4],
    );

    /// Draws a `thickness`-pixel rectangular border.
    #[allow(clippy::too_many_arguments)]
    fn stroke_rect(&mut self, x: i32, y: i32, w: i32, h: i32, thickness: i32, color: [u8; 4]) {
        let t = thickness.max(1);
        self.fill_rect(x, y, w, t, color);
        self.fill_rect(x, y + h - t, w, t, color);
        self.fill_rect(x, y + t, t, h - 2 * t, color);
        self.fill_rect(x + w - t, y + t, t, h - 2 * t, color);
    }
}

/// CPU painter over an RGBA8 buffer of `width * height * 4` bytes.
pub struct RasterPainter<'a> {
    canvas: &'a mut [u8],
    width: u32,
    height: u32,
}

impl<'a> RasterPainter<'a> {
    /// Wraps `canvas`. Returns `None` when the buffer is smaller than `width * height * 4`.
    #[must_use]
    pub fn new(canvas: &'a mut [u8], width: u32, height: u32) -> Option<Self> {
        let needed = (width as usize) * (height as usize) * 4;
        (width > 0 && height > 0 && canvas.len() >= needed).then_some(Self {
            canvas,
            width,
            height,
        })
    }
}

impl Painter for RasterPainter<'_> {
    fn size(&self) -> (u32, u32) {
        (self.width, self.height)
    }
    fn clear(&mut self, color: [u8; 4]) {
        fill_solid(self.canvas, color);
    }
    fn fill_rect(&mut self, x: i32, y: i32, w: i32, h: i32, color: [u8; 4]) {
        fill_rect_alpha(self.canvas, self.width, self.height, x, y, w, h, color);
    }
    fn fill_disc(&mut self, cx: f32, cy: f32, radius: f32, color: [u8; 4]) {
        draw_filled_disc(self.canvas, self.width, self.height, cx, cy, radius, color);
    }
    fn blit(
        &mut self,
        _key: &str,
        atlas: &DecodedAtlas,
        region: AtlasRegion,
        mask: Option<AtlasRegion>,
        mask_luminance: bool,
        rotation_deg: f32,
        opacity: u8,
        dst: [i32; 4],
    ) {
        blit_region_transformed(
            atlas,
            region,
            mask,
            mask_luminance,
            rotation_deg,
            opacity,
            dst[0],
            dst[1],
            dst[2],
            dst[3],
            self.canvas,
            self.width,
            self.height,
        );
    }
    fn glyph(
        &mut self,
        font_rgba: &[u8],
        font_w: u32,
        metric: &GlyphMetric,
        cell_h: u16,
        x: i32,
        y: i32,
        scale: f32,
        color: [u8; 4],
    ) {
        blit_scaled_glyph(
            font_rgba,
            font_w,
            metric,
            cell_h,
            x,
            y,
            scale,
            color,
            self.canvas,
            self.width,
            self.height,
        );
    }
}

/// Texture slot of a [`Quad`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum QuadTexture {
    /// No texture: solid colour, disc or gradient.
    None,
    /// The `font_def` atlas.
    Font,
    /// An atlas named by index into [`DrawList::keys`].
    Atlas(u32),
    /// A texture owned by the GPU backend (for example the 3D match target), by backend slot.
    External(u32),
}

/// How the fragment stage shades a [`Quad`].
#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuadKind {
    /// `color`.
    Solid = 0,
    /// Bilinear texture sample times `color`.
    Texture = 1,
    /// Texture with the alpha of a second region as mask.
    MaskAlpha = 2,
    /// Texture with the luminance times alpha of a second region as mask.
    MaskLuminance = 3,
    /// Nearest-sampled glyph coverage from channel `channel` times `color`.
    Glyph = 4,
    /// Anti-aliased disc inscribed in `dst`.
    Disc = 5,
    /// Vertical gradient from `color` (top) to `color2` (bottom).
    Gradient = 6,
}

/// One instance of the GPU quad pipeline. Plain `f32` data, 96 bytes, `#[repr(C)]` so a GPU
/// backend can upload a `&[GpuQuad]` as raw bytes.
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct GpuQuad {
    /// Destination box in target pixels: x, y, w, h.
    pub dst: [f32; 4],
    /// Normalised texture coordinates u0, v0, u1, v1.
    pub uv: [f32; 4],
    /// Normalised mask coordinates (mask kinds) or the bottom colour (gradient).
    pub aux: [f32; 4],
    /// Straight-alpha colour multiplier, 0..1.
    pub color: [f32; 4],
    /// kind (as f32), rotation in radians (clockwise on screen), glyph channel, unused.
    pub params: [f32; 4],
    /// Disc radius in pixels (disc kind), unused otherwise.
    pub extra: [f32; 4],
}

/// A recorded quad: texture slot plus its GPU instance.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Quad {
    /// Texture to bind while drawing this quad.
    pub texture: QuadTexture,
    /// Instance data.
    pub gpu: GpuQuad,
}

/// Ordered list of quads; reused across frames (`clear` keeps the allocations).
#[derive(Debug, Default, Clone)]
pub struct DrawList {
    /// Quads in painter order.
    pub quads: Vec<Quad>,
    /// Atlas keys referenced by [`QuadTexture::Atlas`].
    pub keys: Vec<String>,
}

impl DrawList {
    /// Empties the list and keeps its capacity.
    pub fn clear(&mut self) {
        self.quads.clear();
        self.keys.clear();
    }

    fn intern(&mut self, key: &str) -> u32 {
        if let Some(i) = self.keys.iter().position(|k| k == key) {
            return i as u32;
        }
        self.keys.push(key.to_owned());
        (self.keys.len() - 1) as u32
    }

    /// Appends a quad drawing the whole external texture `slot` into `dst`.
    pub fn push_external(&mut self, slot: u32, dst: [f32; 4]) {
        self.quads.push(Quad {
            texture: QuadTexture::External(slot),
            gpu: GpuQuad {
                dst,
                uv: [0.0, 0.0, 1.0, 1.0],
                color: [1.0; 4],
                params: [QuadKind::Texture as u32 as f32, 0.0, 0.0, 0.0],
                ..GpuQuad::default()
            },
        });
    }

    /// Appends a vertical gradient covering `dst`.
    pub fn push_gradient(&mut self, dst: [f32; 4], top: [u8; 4], bottom: [u8; 4]) {
        self.quads.push(Quad {
            texture: QuadTexture::None,
            gpu: GpuQuad {
                dst,
                aux: unit(bottom),
                color: unit(top),
                params: [QuadKind::Gradient as u32 as f32, 0.0, 0.0, 0.0],
                ..GpuQuad::default()
            },
        });
    }
}

fn unit(c: [u8; 4]) -> [f32; 4] {
    c.map(|v| f32::from(v) / 255.0)
}

/// Normalised texel-centre coordinates of `r` inside a `w x h` texture, matching the CPU
/// bilinear sampler (`u = 0` on the first texel centre, `u = 1` on the last).
fn region_uv(r: AtlasRegion, w: u32, h: u32) -> [f32; 4] {
    let (w, h) = (w.max(1) as f32, h.max(1) as f32);
    let x0 = r.x as f32 + 0.5;
    let y0 = r.y as f32 + 0.5;
    let x1 = (r.x + r.width.max(1)) as f32 - 0.5;
    let y1 = (r.y + r.height.max(1)) as f32 - 0.5;
    [x0 / w, y0 / h, x1 / w, y1 / h]
}

/// GPU painter: records quads into a [`DrawList`] instead of touching pixels.
pub struct QuadRecorder<'a> {
    list: &'a mut DrawList,
    width: u32,
    height: u32,
}

impl<'a> QuadRecorder<'a> {
    /// Records into `list` for a `width x height` target.
    pub fn new(list: &'a mut DrawList, width: u32, height: u32) -> Self {
        Self {
            list,
            width,
            height,
        }
    }

    /// The list being recorded (to append external quads between painter calls).
    pub fn list(&mut self) -> &mut DrawList {
        self.list
    }

    fn solid(&mut self, kind: QuadKind, dst: [f32; 4], color: [u8; 4], extra: [f32; 4]) {
        if color[3] == 0 || dst[2] <= 0.0 || dst[3] <= 0.0 {
            return;
        }
        self.list.quads.push(Quad {
            texture: QuadTexture::None,
            gpu: GpuQuad {
                dst,
                color: unit(color),
                params: [kind as u32 as f32, 0.0, 0.0, 0.0],
                extra,
                ..GpuQuad::default()
            },
        });
    }
}

impl Painter for QuadRecorder<'_> {
    fn size(&self) -> (u32, u32) {
        (self.width, self.height)
    }
    fn clear(&mut self, color: [u8; 4]) {
        // A clear replaces everything below it: earlier quads can be dropped.
        self.list.quads.clear();
        self.solid(
            QuadKind::Solid,
            [0.0, 0.0, self.width as f32, self.height as f32],
            color,
            [0.0; 4],
        );
    }
    fn fill_rect(&mut self, x: i32, y: i32, w: i32, h: i32, color: [u8; 4]) {
        self.solid(
            QuadKind::Solid,
            [x as f32, y as f32, w as f32, h as f32],
            color,
            [0.0; 4],
        );
    }
    fn fill_disc(&mut self, cx: f32, cy: f32, radius: f32, color: [u8; 4]) {
        let r = radius + 1.0;
        self.solid(
            QuadKind::Disc,
            [cx - r, cy - r, 2.0 * r, 2.0 * r],
            color,
            [radius, 0.0, 0.0, 0.0],
        );
    }
    fn blit(
        &mut self,
        key: &str,
        atlas: &DecodedAtlas,
        region: AtlasRegion,
        mask: Option<AtlasRegion>,
        mask_luminance: bool,
        rotation_deg: f32,
        opacity: u8,
        dst: [i32; 4],
    ) {
        if dst[2] <= 0 || dst[3] <= 0 || region.width == 0 || region.height == 0 || opacity == 0 {
            return;
        }
        let kind = match (mask, mask_luminance) {
            (None, _) => QuadKind::Texture,
            (Some(_), false) => QuadKind::MaskAlpha,
            (Some(_), true) => QuadKind::MaskLuminance,
        };
        let rotation = if rotation_deg.abs() > 0.05 {
            rotation_deg.to_radians()
        } else {
            0.0
        };
        let slot = self.list.intern(key);
        self.list.quads.push(Quad {
            texture: QuadTexture::Atlas(slot),
            gpu: GpuQuad {
                dst: dst.map(|v| v as f32),
                uv: region_uv(region, atlas.width, atlas.height),
                aux: mask.map_or([0.0; 4], |m| region_uv(m, atlas.width, atlas.height)),
                color: [1.0, 1.0, 1.0, f32::from(opacity) / 255.0],
                params: [kind as u32 as f32, rotation, 0.0, 0.0],
                extra: [0.0; 4],
            },
        });
    }
    fn glyph(
        &mut self,
        font_rgba: &[u8],
        font_w: u32,
        metric: &GlyphMetric,
        cell_h: u16,
        x: i32,
        y: i32,
        scale: f32,
        color: [u8; 4],
    ) {
        if metric.page >= 4 || metric.width == 0 || cell_h == 0 || font_w == 0 || color[3] == 0 {
            return;
        }
        let font_h = (font_rgba.len() / (font_w as usize * 4)).max(1) as f32;
        let out_w = ((f32::from(metric.width) * scale).ceil()).max(1.0);
        let out_h = ((f32::from(cell_h) * scale).ceil()).max(1.0);
        let u0 = f32::from(metric.x) / font_w as f32;
        let v0 = f32::from(metric.y) / font_h;
        let u1 = (f32::from(metric.x) + out_w / scale) / font_w as f32;
        let v1 = (f32::from(metric.y) + out_h / scale) / font_h;
        self.list.quads.push(Quad {
            texture: QuadTexture::Font,
            gpu: GpuQuad {
                dst: [x as f32, y as f32, out_w, out_h],
                uv: [u0, v0, u1, v1],
                aux: [0.0; 4],
                color: unit(color),
                params: [QuadKind::Glyph as u32 as f32, 0.0, f32::from(metric.page), 0.0],
                extra: [0.0; 4],
            },
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gpu_quad_is_six_vec4() {
        assert_eq!(core::mem::size_of::<GpuQuad>(), 96);
    }

    #[test]
    fn recorder_clear_drops_hidden_quads_and_interns_keys() {
        let mut list = DrawList::default();
        let atlas = DecodedAtlas {
            width: 4,
            height: 4,
            rgba: vec![255; 64],
            regions: Default::default(),
        };
        let mut p = QuadRecorder::new(&mut list, 100, 50);
        p.fill_rect(0, 0, 10, 10, [255, 0, 0, 255]);
        p.clear([0, 0, 0, 255]);
        let r = AtlasRegion {
            x: 0,
            y: 0,
            width: 4,
            height: 4,
        };
        p.blit("a", &atlas, r, None, false, 0.0, 255, [0, 0, 8, 8]);
        p.blit("a", &atlas, r, Some(r), true, 30.0, 128, [0, 0, 8, 8]);
        assert_eq!(list.quads.len(), 3);
        assert_eq!(list.keys, vec!["a".to_owned()]);
        assert_eq!(list.quads[2].gpu.params[0], QuadKind::MaskLuminance as u32 as f32);
        assert_eq!(list.quads[1].gpu.uv, [0.125, 0.125, 0.875, 0.875]);
    }
}
