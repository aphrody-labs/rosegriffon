//! GPU presentation of the NIE web client (feature `webgpu`, WebGL2 fallback with `webgl`).
//!
//! [`NieGpuClient`] owns the whole frame in Rust: the `requestAnimationFrame` loop, keyboard and
//! gamepad input, devicePixelRatio-aware sizing up to 4K, and a wgpu surface on the page canvas.
//! Every 2D layer is recorded by [`NieClientRuntime::paint_ui`] into a
//! [`DrawList`] and drawn as instanced textured quads (each atlas uploaded once, only the
//! instance buffer changes per frame). The match is drawn by `aphrody-nie-render3d`'s GPU scene
//! pass and composited as one more quad. No full-screen pixel buffer exists on the CPU.
//!
//! The JavaScript host only loads the module, fetches assets and plays audio/video: it receives
//! asset requests and media commands through the `io` callback.

use aphrody_nie_ui::paint::{DrawList, GpuQuad, Quad, QuadTexture};

/// Upper bound on backing-store pixels: 3840 x 2160.
pub const MAX_PIXELS: u64 = 3840 * 2160;
/// Logical UI height the 2D layouts were authored for; larger outputs scale the quads up.
pub const UI_REFERENCE_HEIGHT: f32 = 1080.0;
/// Frame-time samples kept for the pacing statistics (two seconds at 120 Hz).
pub const FRAME_WINDOW: usize = 240;

/// Backing-store size for a CSS box: `css * dpr`, capped at [`MAX_PIXELS`] and `max_dim`,
/// aspect ratio kept.
#[must_use]
pub fn backing_size(css_w: f64, css_h: f64, dpr: f64, max_dim: u32) -> (u32, u32) {
    let dpr = if dpr.is_finite() && dpr > 0.0 { dpr } else { 1.0 };
    let mut w = (css_w.max(1.0) * dpr).round().max(1.0);
    let mut h = (css_h.max(1.0) * dpr).round().max(1.0);
    let over = ((w * h) / MAX_PIXELS as f64).sqrt();
    if over > 1.0 {
        w = (w / over).floor().max(1.0);
        h = (h / over).floor().max(1.0);
    }
    let max_dim = f64::from(max_dim.max(1));
    let over_dim = (w / max_dim).max(h / max_dim);
    if over_dim > 1.0 {
        w = (w / over_dim).floor().max(1.0);
        h = (h / over_dim).floor().max(1.0);
    }
    (w as u32, h as u32)
}

/// Logical UI size for a physical output: layouts keep their 1080p pixel metrics and the GPU
/// scales the quads, so text and atlases are sampled at the full output resolution.
#[must_use]
pub fn logical_size(width: u32, height: u32) -> (u32, u32) {
    let s = (height as f32 / UI_REFERENCE_HEIGHT).max(1.0);
    (
        ((width as f32 / s).round() as u32).max(1),
        ((height as f32 / s).round() as u32).max(1),
    )
}

/// A run of consecutive quads sharing one texture: one bind-group switch and one draw call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Run {
    /// Texture bound for the run.
    pub texture: QuadTexture,
    /// First instance.
    pub start: u32,
    /// Instance count.
    pub count: u32,
}

/// Splits `list` into texture runs (painter order is kept: blending is order-dependent) and
/// writes the instances into `out`.
pub fn batch(list: &DrawList, out: &mut Vec<GpuQuad>, runs: &mut Vec<Run>) {
    out.clear();
    runs.clear();
    for Quad { texture, gpu } in &list.quads {
        let index = out.len() as u32;
        out.push(*gpu);
        match runs.last_mut() {
            Some(run) if run.texture == *texture => run.count += 1,
            _ => runs.push(Run {
                texture: *texture,
                start: index,
                count: 1,
            }),
        }
    }
}

/// Flattens instances into the `f32` stream uploaded to the instance buffer (24 per quad).
pub fn pack(quads: &[GpuQuad], out: &mut Vec<f32>) {
    out.clear();
    out.reserve(quads.len() * 24);
    for q in quads {
        for v in [q.dst, q.uv, q.aux, q.color, q.params, q.extra] {
            out.extend_from_slice(&v);
        }
    }
}

/// Rolling frame-time statistics measured inside wasm.
#[derive(Debug, Clone)]
pub struct FramePacing {
    intervals: Vec<f32>,
    work: Vec<f32>,
    next: usize,
    /// Frames presented since start.
    pub frames: u64,
}

impl Default for FramePacing {
    fn default() -> Self {
        Self {
            intervals: Vec::with_capacity(FRAME_WINDOW),
            work: Vec::with_capacity(FRAME_WINDOW),
            next: 0,
            frames: 0,
        }
    }
}

/// Summary of [`FramePacing`].
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize)]
pub struct PacingSummary {
    /// Mean presented frames per second over the window.
    pub fps: f32,
    /// Mean interval between frames (ms).
    pub frame_ms: f32,
    /// 99th percentile interval (ms).
    pub p99_ms: f32,
    /// Worst interval (ms).
    pub max_ms: f32,
    /// Mean CPU time spent in the frame callback (ms): simulation, recording, submission.
    pub cpu_ms: f32,
    /// Frames presented since start.
    pub frames: u64,
}

impl FramePacing {
    /// Records one frame: `interval_ms` since the previous rAF timestamp, `work_ms` of CPU time.
    pub fn record(&mut self, interval_ms: f32, work_ms: f32) {
        self.frames += 1;
        if !(interval_ms.is_finite() && interval_ms > 0.0) {
            return;
        }
        if self.intervals.len() < FRAME_WINDOW {
            self.intervals.push(interval_ms);
            self.work.push(work_ms.max(0.0));
        } else {
            self.intervals[self.next] = interval_ms;
            self.work[self.next] = work_ms.max(0.0);
        }
        self.next = (self.next + 1) % FRAME_WINDOW;
    }

    /// Current statistics.
    #[must_use]
    pub fn summary(&self) -> PacingSummary {
        let n = self.intervals.len();
        if n == 0 {
            return PacingSummary {
                fps: 0.0,
                frame_ms: 0.0,
                p99_ms: 0.0,
                max_ms: 0.0,
                cpu_ms: 0.0,
                frames: self.frames,
            };
        }
        let mean = self.intervals.iter().sum::<f32>() / n as f32;
        let mut sorted = self.intervals.clone();
        sorted.sort_by(f32::total_cmp);
        let p99 = sorted[((n as f32 * 0.99).ceil() as usize).clamp(1, n) - 1];
        PacingSummary {
            fps: 1000.0 / mean,
            frame_ms: mean,
            p99_ms: p99,
            max_ms: sorted[n - 1],
            cpu_ms: self.work.iter().sum::<f32>() / n as f32,
            frames: self.frames,
        }
    }
}

/// Instanced quad shader.
pub const QUAD_WGSL: &str = include_str!("gpu_quad.wgsl");

#[cfg(target_arch = "wasm32")]
pub use web::NieGpuClient;

#[cfg(target_arch = "wasm32")]
mod web {
    use std::cell::RefCell;
    use std::collections::HashMap;
    use std::rc::Rc;

    use aphrody_gpu_backend::wgpu;
    use aphrody_nie_app::match3d::{self, MatchModelKind};
    use aphrody_nie_render3d::gpu::{GpuModel, GpuRenderer, SceneInstance, flat_model};
    use aphrody_nie_render3d::scene;
    use aphrody_nie_ui::paint::{DrawList, GpuQuad, Painter, QuadRecorder, QuadTexture};
    use wasm_bindgen::JsCast;
    use wasm_bindgen::prelude::*;
    use web_sys::{Event, HtmlCanvasElement, KeyboardEvent};

    use super::{FramePacing, QUAD_WGSL, Run, backing_size, batch, logical_size};
    use crate::client::NieClientRuntime;

    /// Font atlas key in the texture cache.
    const FONT: &str = "\u{0}font";
    /// External slot of the 3D match target.
    const MATCH_SLOT: u32 = 0;

    fn js_err(e: impl core::fmt::Display) -> JsValue {
        JsValue::from_str(&e.to_string())
    }

    struct Tex {
        _texture: wgpu::Texture,
        bind: wgpu::BindGroup,
        size: (u32, u32),
    }

    struct MatchGpu {
        generation: u32,
        home: GpuModel,
        away: GpuModel,
        ball: GpuModel,
        stadium: GpuModel,
        marker: GpuModel,
        /// Bind group of the renderer's colour target, keyed by its size.
        target: Option<((u32, u32), wgpu::BindGroup)>,
    }

    struct Gpu {
        surface: wgpu::Surface<'static>,
        config: wgpu::SurfaceConfiguration,
        renderer: GpuRenderer,
        pipeline: wgpu::RenderPipeline,
        tex_layout: wgpu::BindGroupLayout,
        linear: wgpu::Sampler,
        nearest: wgpu::Sampler,
        screen: wgpu::Buffer,
        screen_bind: wgpu::BindGroup,
        white: Tex,
        textures: HashMap<String, Tex>,
        instances: wgpu::Buffer,
        instance_capacity: u64,
        matchgpu: Option<MatchGpu>,
        backend: String,
        present_mode: wgpu::PresentMode,
    }

    struct State {
        rt: NieClientRuntime,
        gpu: Gpu,
        canvas: HtmlCanvasElement,
        io: js_sys::Function,
        list: DrawList,
        quads: Vec<GpuQuad>,
        runs: Vec<Run>,
        packed: Vec<f32>,
        pacing: FramePacing,
        last_ts: Option<f64>,
        overlay: bool,
        running: bool,
        raf_id: i32,
        pad_seen: bool,
        buttons: Vec<f32>,
        axes: Vec<f32>,
        fault: Option<String>,
    }

    impl Gpu {
        async fn new(canvas: &HtmlCanvasElement, width: u32, height: u32) -> anyhow::Result<Self> {
            use anyhow::Context;
            let mut descriptor = wgpu::InstanceDescriptor::new_without_display_handle();
            descriptor.backends = if cfg!(feature = "webgl") {
                wgpu::Backends::BROWSER_WEBGPU | wgpu::Backends::GL
            } else {
                wgpu::Backends::BROWSER_WEBGPU
            };
            let instance = aphrody_gpu_backend::create_instance(descriptor);
            let surface = instance
                .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
                .context("canvas surface")?;
            let adapter = aphrody_gpu_backend::request_adapter(
                &instance,
                &wgpu::RequestAdapterOptions {
                    power_preference: wgpu::PowerPreference::HighPerformance,
                    force_fallback_adapter: false,
                    compatible_surface: Some(&surface),
                    apply_limit_buckets: false,
                },
            )
            .await
            .context("no WebGPU/WebGL2 adapter for this canvas")?;
            let info = adapter.get_info();
            let device = aphrody_gpu_backend::request_device(
                &adapter,
                aphrody_gpu_backend::DeviceRequest::new(
                    Some("NIE client"),
                    aphrody_gpu_backend::DeviceLimits::DownlevelWithAdapterResolution,
                ),
            )
            .await
            .context("GPU device")?;
            let (device, queue) = (device.device, device.queue);
            let caps = surface.get_capabilities(&adapter);
            // Lowest latency first; browsers expose Fifo only, native WebGL may expose more.
            let present_mode = [
                wgpu::PresentMode::Mailbox,
                wgpu::PresentMode::Immediate,
                wgpu::PresentMode::Fifo,
            ]
            .into_iter()
            .find(|m| caps.present_modes.contains(m));
            let alpha = if caps
                .alpha_modes
                .contains(&wgpu::CompositeAlphaMode::PreMultiplied)
            {
                wgpu::CompositeAlphaMode::PreMultiplied
            } else {
                wgpu::CompositeAlphaMode::Auto
            };
            let config = aphrody_gpu_backend::surface_configuration(
                &caps,
                aphrody_gpu_backend::SurfaceRequest {
                    width,
                    height,
                    // Unorm, not sRGB: the layouts were authored for gamma-space blending.
                    format: aphrody_gpu_backend::SurfaceFormat::Require(&[
                        wgpu::TextureFormat::Bgra8Unorm,
                        wgpu::TextureFormat::Rgba8Unorm,
                    ]),
                    present_mode,
                    alpha_mode: Some(alpha),
                    desired_maximum_frame_latency: 1,
                },
            )
            .context("no Rgba8/Bgra8 unorm surface format")?;
            surface.configure(&device, &config);

            let screen_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("nie screen"),
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }],
            });
            let tex_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("nie quad texture"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Texture {
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                            view_dimension: wgpu::TextureViewDimension::D2,
                            multisampled: false,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                ],
            });
            let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("nie quads"),
                bind_group_layouts: &[Some(&screen_layout), Some(&tex_layout)],
                immediate_size: 0,
            });
            let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("nie quads"),
                source: wgpu::ShaderSource::Wgsl(QUAD_WGSL.into()),
            });
            let premul = wgpu::BlendComponent {
                src_factor: wgpu::BlendFactor::One,
                dst_factor: wgpu::BlendFactor::OneMinusSrcAlpha,
                operation: wgpu::BlendOperation::Add,
            };
            let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("nie quads"),
                layout: Some(&layout),
                vertex: wgpu::VertexState {
                    module: &shader,
                    entry_point: Some("vs"),
                    buffers: &[Some(wgpu::VertexBufferLayout {
                        array_stride: core::mem::size_of::<GpuQuad>() as wgpu::BufferAddress,
                        step_mode: wgpu::VertexStepMode::Instance,
                        attributes: &wgpu::vertex_attr_array![
                            0 => Float32x4, 1 => Float32x4, 2 => Float32x4,
                            3 => Float32x4, 4 => Float32x4, 5 => Float32x4
                        ],
                    })],
                    compilation_options: wgpu::PipelineCompilationOptions::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: &shader,
                    entry_point: Some("fs"),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: config.format,
                        blend: Some(wgpu::BlendState {
                            color: premul,
                            alpha: premul,
                        }),
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                    compilation_options: wgpu::PipelineCompilationOptions::default(),
                }),
                primitive: wgpu::PrimitiveState::default(),
                depth_stencil: None,
                multisample: wgpu::MultisampleState::default(),
                multiview_mask: None,
                cache: None,
            });
            let sampler = |filter| {
                device.create_sampler(&wgpu::SamplerDescriptor {
                    label: Some("nie quads"),
                    address_mode_u: wgpu::AddressMode::ClampToEdge,
                    address_mode_v: wgpu::AddressMode::ClampToEdge,
                    mag_filter: filter,
                    min_filter: filter,
                    mipmap_filter: wgpu::MipmapFilterMode::Nearest,
                    ..Default::default()
                })
            };
            let linear = sampler(wgpu::FilterMode::Linear);
            let nearest = sampler(wgpu::FilterMode::Nearest);
            let screen = device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("nie screen"),
                size: 16,
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
            let screen_bind = device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("nie screen"),
                layout: &screen_layout,
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: screen.as_entire_binding(),
                }],
            });
            let instance_capacity = 4096 * core::mem::size_of::<GpuQuad>() as u64;
            let instances = device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("nie quads"),
                size: instance_capacity,
                usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
            let backend = format!("{:?}", info.backend);
            let renderer = GpuRenderer::from_device(info, device, queue);
            let white = upload(&renderer, &tex_layout, &linear, &nearest, 1, 1, &[255; 4]);
            Ok(Self {
                surface,
                config,
                renderer,
                pipeline,
                tex_layout,
                linear,
                nearest,
                screen,
                screen_bind,
                white,
                textures: HashMap::new(),
                instances,
                instance_capacity,
                matchgpu: None,
                backend,
                present_mode: present_mode.unwrap_or(wgpu::PresentMode::Fifo),
            })
        }

        fn resize(&mut self, width: u32, height: u32) {
            if self.config.width != width || self.config.height != height {
                self.config.width = width;
                self.config.height = height;
                self.surface.configure(self.renderer.device(), &self.config);
            }
        }

        fn bind_view(&self, view: &wgpu::TextureView) -> wgpu::BindGroup {
            self.renderer
                .device()
                .create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("nie quad texture"),
                    layout: &self.tex_layout,
                    entries: &[
                        wgpu::BindGroupEntry {
                            binding: 0,
                            resource: wgpu::BindingResource::TextureView(view),
                        },
                        wgpu::BindGroupEntry {
                            binding: 1,
                            resource: wgpu::BindingResource::Sampler(&self.linear),
                        },
                        wgpu::BindGroupEntry {
                            binding: 2,
                            resource: wgpu::BindingResource::Sampler(&self.nearest),
                        },
                    ],
                })
        }

        /// Uploads, once, every atlas the list references (and the font).
        fn sync_textures(&mut self, rt: &NieClientRuntime, list: &DrawList) {
            let comp = rt.compositor();
            let mut wanted: Vec<(&str, u32, u32, &[u8])> = Vec::new();
            for key in &list.keys {
                if let Some(a) = comp.atlas(key) {
                    wanted.push((key.as_str(), a.width, a.height, &a.rgba));
                }
            }
            if list.quads.iter().any(|q| q.texture == QuadTexture::Font)
                && let Some((w, h, rgba)) = comp.font_atlas()
            {
                wanted.push((FONT, w, h, rgba));
            }
            for (key, w, h, rgba) in wanted {
                if self.textures.get(key).is_some_and(|t| t.size == (w, h)) {
                    continue;
                }
                let tex = upload(
                    &self.renderer,
                    &self.tex_layout,
                    &self.linear,
                    &self.nearest,
                    w,
                    h,
                    rgba,
                );
                self.textures.insert(key.to_owned(), tex);
            }
        }

        /// Renders the 3D match into the renderer target and returns its size.
        fn render_match(&mut self, rt: &NieClientRuntime, out_w: u32, out_h: u32) -> bool {
            let Some(frame) = rt.match_frame() else {
                return false;
            };
            if self
                .matchgpu
                .as_ref()
                .is_none_or(|m| m.generation != frame.models_gen)
            {
                let r = &self.renderer;
                let up = |m: &aphrody_nie_render3d::glb::Model| r.try_upload(m);
                let built = (|| -> anyhow::Result<MatchGpu> {
                    Ok(MatchGpu {
                        generation: frame.models_gen,
                        home: up(frame.models.model(MatchModelKind::Home))?,
                        away: up(frame.models.model(MatchModelKind::Away))?,
                        ball: up(frame.models.model(MatchModelKind::Ball))?,
                        stadium: up(&flat_model(frame.stadium))?,
                        marker: up(&flat_model(&match3d::marker_at_origin()))?,
                        target: None,
                    })
                })();
                match built {
                    Ok(m) => self.matchgpu = Some(m),
                    Err(e) => {
                        web_sys::console::error_1(&js_err(format!("match upload: {e}")));
                        return false;
                    }
                }
            }
            let Some(m) = self.matchgpu.as_ref() else {
                return false;
            };
            let mut instances = Vec::with_capacity(frame.placements.len() + 2);
            instances.push(SceneInstance {
                model: &m.stadium,
                transform: scene::mat_identity(),
            });
            if let Some([x, z]) = frame.marker {
                instances.push(SceneInstance {
                    model: &m.marker,
                    transform: scene::mat_translate([x, 0.0, z]),
                });
            }
            for (kind, transform) in &frame.placements {
                let model = match kind {
                    MatchModelKind::Home => &m.home,
                    MatchModelKind::Away => &m.away,
                    MatchModelKind::Ball => &m.ball,
                };
                instances.push(SceneInstance {
                    model,
                    transform: *transform,
                });
            }
            let scale = rt.match_render_scale();
            let w = ((out_w as f32 * scale) as u32).clamp(1, out_w);
            let h = ((out_h as f32 * scale) as u32).clamp(1, out_h);
            let view = match self
                .renderer
                .render_scene_to_texture(&instances, &frame.camera, w, h)
            {
                Ok(v) => v.clone(),
                Err(e) => {
                    web_sys::console::error_1(&js_err(format!("match render: {e}")));
                    return false;
                }
            };
            drop(instances);
            let stale = self
                .matchgpu
                .as_ref()
                .and_then(|m| m.target.as_ref())
                .is_none_or(|(size, _)| *size != (w, h));
            if stale {
                let bind = self.bind_view(&view);
                if let Some(m) = self.matchgpu.as_mut() {
                    m.target = Some(((w, h), bind));
                }
            }
            true
        }

        fn draw(
            &mut self,
            list: &DrawList,
            packed: &[f32],
            runs: &[Run],
            logical: (u32, u32),
        ) -> Result<(), String> {
            let device = self.renderer.device().clone();
            let queue = self.renderer.queue().clone();
            let bytes: &[u8] = bytemuck::cast_slice(packed);
            let needed = (bytes.len() as u64).max(16);
            if needed > self.instance_capacity {
                self.instance_capacity = needed.next_power_of_two();
                self.instances.destroy();
                self.instances = device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some("nie quads"),
                    size: self.instance_capacity,
                    usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
            }
            if !bytes.is_empty() {
                queue.write_buffer(&self.instances, 0, bytes);
            }
            let screen = [logical.0 as f32, logical.1 as f32, 0.0, 0.0];
            queue.write_buffer(&self.screen, 0, bytemuck::cast_slice(&screen));

            let (frame, reconfigure) = match self.surface.get_current_texture() {
                wgpu::CurrentSurfaceTexture::Success(f) => (f, false),
                wgpu::CurrentSurfaceTexture::Suboptimal(f) => (f, true),
                wgpu::CurrentSurfaceTexture::Timeout | wgpu::CurrentSurfaceTexture::Occluded => {
                    return Ok(());
                }
                wgpu::CurrentSurfaceTexture::Outdated => {
                    self.surface.configure(&device, &self.config);
                    return Ok(());
                }
                wgpu::CurrentSurfaceTexture::Lost => return Err("surface lost".into()),
                wgpu::CurrentSurfaceTexture::Validation => {
                    return Err("surface validation failed".into());
                }
            };
            let target = frame
                .texture
                .create_view(&wgpu::TextureViewDescriptor::default());
            let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("nie frame"),
            });
            {
                let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("nie frame"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &target,
                        depth_slice: None,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    timestamp_writes: None,
                    occlusion_query_set: None,
                    multiview_mask: None,
                });
                pass.set_pipeline(&self.pipeline);
                pass.set_bind_group(0, &self.screen_bind, &[]);
                pass.set_vertex_buffer(0, self.instances.slice(..));
                for run in runs {
                    let bind = match run.texture {
                        QuadTexture::None => Some(&self.white.bind),
                        QuadTexture::Font => self.textures.get(FONT).map(|t| &t.bind),
                        QuadTexture::Atlas(i) => list
                            .keys
                            .get(i as usize)
                            .and_then(|k| self.textures.get(k))
                            .map(|t| &t.bind),
                        QuadTexture::External(MATCH_SLOT) => self
                            .matchgpu
                            .as_ref()
                            .and_then(|m| m.target.as_ref())
                            .map(|(_, b)| b),
                        QuadTexture::External(_) => None,
                    };
                    if let Some(bind) = bind {
                        pass.set_bind_group(1, bind, &[]);
                        pass.draw(0..6, run.start..run.start + run.count);
                    }
                }
            }
            queue.submit(Some(encoder.finish()));
            queue.present(frame);
            if reconfigure {
                self.surface.configure(&device, &self.config);
            }
            Ok(())
        }
    }

    impl State {
        /// Re-reads the CSS size and devicePixelRatio; reconfigures surface and runtime on change.
        fn sync_size(&mut self) -> (u32, u32) {
            let window = web_sys::window();
            let dpr = window.as_ref().map_or(1.0, web_sys::Window::device_pixel_ratio);
            let (css_w, css_h) = match (self.canvas.client_width(), self.canvas.client_height()) {
                (w, h) if w > 0 && h > 0 => (f64::from(w), f64::from(h)),
                _ => window
                    .as_ref()
                    .map(|w| {
                        (
                            w.inner_width().ok().and_then(|v| v.as_f64()).unwrap_or(1.0),
                            w.inner_height().ok().and_then(|v| v.as_f64()).unwrap_or(1.0),
                        )
                    })
                    .unwrap_or((1.0, 1.0)),
            };
            let max_dim = self.gpu.renderer.device().limits().max_texture_dimension_2d;
            let (w, h) = backing_size(css_w, css_h, dpr, max_dim);
            if self.canvas.width() != w || self.canvas.height() != h {
                self.canvas.set_width(w);
                self.canvas.set_height(h);
            }
            self.gpu.resize(w, h);
            let (lw, lh) = logical_size(w, h);
            if self.rt.width() != lw || self.rt.height() != lh {
                self.rt.resize(lw, lh);
            }
            (w, h)
        }

        fn poll_gamepad(&mut self) {
            let Some(nav) = web_sys::window().map(|w| w.navigator()) else {
                return;
            };
            let pads = match nav.get_gamepads() {
                Ok(p) => p,
                Err(_) => return,
            };
            let pad = pads
                .iter()
                .filter_map(|p| p.dyn_into::<web_sys::Gamepad>().ok())
                .find(web_sys::Gamepad::connected);
            if let Some(pad) = pad {
                self.buttons.clear();
                self.buttons.extend(pad.buttons().iter().map(|b| {
                    b.dyn_into::<web_sys::GamepadButton>()
                        .map_or(0.0, |b| b.value() as f32)
                }));
                self.axes.clear();
                self.axes
                    .extend(pad.axes().iter().map(|a| a.as_f64().unwrap_or(0.0) as f32));
                self.rt.set_gamepad(&self.buttons, &self.axes, &pad.id());
                self.pad_seen = true;
            } else if self.pad_seen {
                self.rt.clear_gamepad();
                self.pad_seen = false;
            }
        }

        /// One `requestAnimationFrame` tick. Returns the I/O to hand to JavaScript.
        fn frame(&mut self, ts: f64) -> (String, String) {
            let start = now();
            let interval = self.last_ts.map_or(0.0, |l| ts - l);
            self.last_ts = Some(ts);
            // Input is sampled right before the simulation step that consumes it.
            self.poll_gamepad();
            self.rt.tick(interval.min(100.0));
            let requests = self.rt.poll_asset_requests();
            let media = self.rt.poll_media_commands();
            let _ = self.rt.poll_events();

            let (w, h) = self.sync_size();
            let logical = (self.rt.width(), self.rt.height());
            let has_match = self.gpu.render_match(&self.rt, w, h);
            self.list.clear();
            if has_match {
                let full = [0.0, 0.0, logical.0 as f32, logical.1 as f32];
                let (top, bottom) = match3d::SKY;
                self.list
                    .push_gradient(full, [top[0], top[1], top[2], 255], [
                        bottom[0], bottom[1], bottom[2], 255,
                    ]);
                self.list.push_external(MATCH_SLOT, full);
            }
            {
                let mut rec = QuadRecorder::new(&mut self.list, logical.0, logical.1);
                self.rt.paint_ui(&mut rec);
                if self.overlay {
                    let s = self.pacing.summary();
                    let text = format!(
                        "{:.1} FPS  {:.2} MS  P99 {:.2}  CPU {:.2}  {}X{}  {}",
                        s.fps, s.frame_ms, s.p99_ms, s.cpu_ms, w, h, self.gpu.backend
                    );
                    rec.fill_rect(8, 8, 620, 30, [0, 0, 0, 170]);
                    let _ = self.rt.compositor().draw_text_height_on(
                        &text,
                        16,
                        14,
                        16.0,
                        [120, 255, 140, 255],
                        false,
                        &mut rec,
                    );
                }
            }
            if self.rt.video_under_frame() {
                // Transparent frame: the boot video element shows through the canvas.
                self.list.clear();
            }
            self.gpu.sync_textures(&self.rt, &self.list);
            batch(&self.list, &mut self.quads, &mut self.runs);
            super::pack(&self.quads, &mut self.packed);
            if let Err(e) = self.gpu.draw(&self.list, &self.packed, &self.runs, logical) {
                self.fault = Some(e);
            }
            self.pacing.record(interval as f32, (now() - start) as f32);
            (requests, media)
        }
    }

    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map_or(0.0, |p| p.now())
    }

    type RafSlot = Rc<RefCell<Option<Closure<dyn FnMut(f64)>>>>;
    type Listener = (web_sys::EventTarget, &'static str, Closure<dyn FnMut(Event)>);

    /// GPU-presented NIE client: Rust owns the loop, the input and every pixel.
    #[wasm_bindgen]
    pub struct NieGpuClient {
        state: Rc<RefCell<State>>,
        raf: RafSlot,
        listeners: Vec<Listener>,
    }

    impl NieGpuClient {
        fn listen(&mut self) -> Result<(), JsValue> {
            let window = web_sys::window().ok_or("no window")?;
            let target: web_sys::EventTarget = window.clone().into();
            let s = Rc::clone(&self.state);
            self.add(&target, "keydown", move |e: Event| {
                let Some(k) = e.dyn_ref::<KeyboardEvent>() else {
                    return;
                };
                let Ok(mut st) = s.try_borrow_mut() else {
                    return;
                };
                if k.code() == "F3" {
                    st.overlay = !st.overlay;
                    e.prevent_default();
                } else if st.rt.key_down(&k.code()) {
                    e.prevent_default();
                }
            })?;
            let s = Rc::clone(&self.state);
            self.add(&target, "keyup", move |e: Event| {
                if let (Some(k), Ok(mut st)) = (e.dyn_ref::<KeyboardEvent>(), s.try_borrow_mut()) {
                    st.rt.key_up(&k.code());
                }
            })?;
            let s = Rc::clone(&self.state);
            self.add(&target, "blur", move |_| {
                if let Ok(mut st) = s.try_borrow_mut() {
                    st.rt.blur();
                }
            })?;
            if let Some(doc) = window.document() {
                let doc_target: web_sys::EventTarget = doc.clone().into();
                let s = Rc::clone(&self.state);
                self.add(&doc_target, "visibilitychange", move |_| {
                    if doc.hidden()
                        && let Ok(mut st) = s.try_borrow_mut()
                    {
                        st.rt.blur();
                        // A hidden tab stops rAF: do not count the gap as a frame interval.
                        st.last_ts = None;
                    }
                })?;
            }
            Ok(())
        }

        fn add(
            &mut self,
            target: &web_sys::EventTarget,
            name: &'static str,
            f: impl FnMut(Event) + 'static,
        ) -> Result<(), JsValue> {
            let closure = Closure::<dyn FnMut(Event)>::new(f);
            target.add_event_listener_with_callback(name, closure.as_ref().unchecked_ref())?;
            self.listeners.push((target.clone(), name, closure));
            Ok(())
        }

        fn start(&self) {
            let state = Rc::clone(&self.state);
            let raf = Rc::clone(&self.raf);
            let tick = Closure::<dyn FnMut(f64)>::new(move |ts: f64| {
                let io = {
                    let Ok(mut st) = state.try_borrow_mut() else {
                        return;
                    };
                    if !st.running {
                        return;
                    }
                    let (requests, media) = st.frame(ts);
                    if let Some(window) = web_sys::window()
                        && let Some(cb) = raf.borrow().as_ref()
                    {
                        st.raf_id = window
                            .request_animation_frame(cb.as_ref().unchecked_ref())
                            .unwrap_or(0);
                    }
                    (requests != "[]" || media != "[]").then(|| (st.io.clone(), requests, media))
                };
                // Called with no borrow held: the host may call back into the client.
                if let Some((cb, requests, media)) = io {
                    let _ = cb.call2(
                        &JsValue::NULL,
                        &JsValue::from_str(&requests),
                        &JsValue::from_str(&media),
                    );
                }
            });
            if let Some(window) = web_sys::window() {
                let id = window
                    .request_animation_frame(tick.as_ref().unchecked_ref())
                    .unwrap_or(0);
                self.state.borrow_mut().raf_id = id;
            }
            *self.raf.borrow_mut() = Some(tick);
        }

    }

    #[wasm_bindgen]
    impl NieGpuClient {
        /// Creates the GPU surface on `canvas` and starts the frame loop.
        ///
        /// `io(requests, media)` is called after a frame that produced asset requests
        /// (`[{id, url, kind}]`) or media commands (JSON), never with both empty.
        ///
        /// # Errors
        ///
        /// Rejects when neither WebGPU nor WebGL2 can drive the canvas.
        pub async fn create(
            canvas: HtmlCanvasElement,
            cdn_base: Option<String>,
            io: js_sys::Function,
        ) -> Result<NieGpuClient, JsValue> {
            console_error_panic_hook::set_once();
            let (w, h) = (canvas.width().max(1), canvas.height().max(1));
            let gpu = Gpu::new(&canvas, w, h).await.map_err(js_err)?;
            let (lw, lh) = logical_size(w, h);
            let mut rt = NieClientRuntime::new(cdn_base, lw, lh).map_err(js_err)?;
            rt.set_match_render_scale(1.0);
            let overlay = web_sys::window()
                .and_then(|w| w.location().search().ok())
                .is_some_and(|q| q.contains("nie-debug"));
            let state = Rc::new(RefCell::new(State {
                rt,
                gpu,
                canvas: canvas.clone(),
                io,
                list: DrawList::default(),
                quads: Vec::new(),
                runs: Vec::new(),
                packed: Vec::new(),
                pacing: FramePacing::default(),
                last_ts: None,
                overlay,
                running: true,
                raf_id: 0,
                pad_seen: false,
                buttons: Vec::new(),
                axes: Vec::new(),
                fault: None,
            }));
            let mut client = NieGpuClient {
                state,
                raf: Rc::new(RefCell::new(None)),
                listeners: Vec::new(),
            };
            client.listen()?;
            client.start();
            Ok(client)
        }

        /// Answers an asset request with its bytes.
        ///
        /// # Errors
        ///
        /// Forwards the runtime decoding error.
        pub fn provide_asset(&self, id: u32, bytes: &[u8]) -> Result<(), String> {
            self.state.borrow_mut().rt.provide_asset(id, bytes)
        }

        /// Reports a failed asset request.
        pub fn asset_failed(&self, id: u32, status: u16, reason: &str) {
            self.state.borrow_mut().rt.asset_failed(id, status, reason);
        }

        /// The boot video `name` ended (or failed).
        pub fn video_ended(&self, name: &str) {
            self.state.borrow_mut().rt.video_ended(name);
        }

        /// Whether the current screen expects the video element under the canvas.
        #[must_use]
        pub fn wants_video(&self) -> bool {
            self.state.borrow().rt.wants_video()
        }

        /// Current screen name.
        #[must_use]
        pub fn stage(&self) -> String {
            self.state.borrow().rt.stage()
        }

        /// Focused control id, if any.
        #[must_use]
        pub fn focused_control(&self) -> Option<String> {
            self.state.borrow().rt.focused_control()
        }

        /// Frames presented since start.
        #[must_use]
        pub fn frames(&self) -> f64 {
            self.state.borrow().pacing.frames as f64
        }

        /// Frame pacing measured in wasm, JSON
        /// `{fps, frame_ms, p99_ms, max_ms, cpu_ms, frames, backend, present_mode, width, height, fault}`.
        #[must_use]
        pub fn frame_stats(&self) -> String {
            let st = self.state.borrow();
            serde_json::json!({
                "pacing": st.pacing.summary(),
                "backend": st.gpu.backend,
                "present_mode": format!("{:?}", st.gpu.present_mode),
                "width": st.gpu.config.width,
                "height": st.gpu.config.height,
                "ui_width": st.rt.width(),
                "ui_height": st.rt.height(),
                "fault": st.fault,
            })
            .to_string()
        }

        /// Shows or hides the in-canvas frame-time overlay (also toggled with F3).
        pub fn set_debug_overlay(&self, on: bool) {
            self.state.borrow_mut().overlay = on;
        }

        /// Fraction of the output resolution used for the 3D match (0.25..1).
        pub fn set_match_render_scale(&self, scale: f32) {
            self.state.borrow_mut().rt.set_match_render_scale(scale);
        }

        /// Stops the loop and removes every listener.
        pub fn stop(&mut self) {
            if let Ok(mut st) = self.state.try_borrow_mut() {
                st.running = false;
                if let Some(w) = web_sys::window() {
                    let _ = w.cancel_animation_frame(st.raf_id);
                }
            }
            for (target, name, closure) in self.listeners.drain(..) {
                let _ = target
                    .remove_event_listener_with_callback(name, closure.as_ref().unchecked_ref());
            }
            self.raf.borrow_mut().take();
        }
    }

    fn upload(
        renderer: &GpuRenderer,
        layout: &wgpu::BindGroupLayout,
        linear: &wgpu::Sampler,
        nearest: &wgpu::Sampler,
        width: u32,
        height: u32,
        rgba: &[u8],
    ) -> Tex {
        let device = renderer.device();
        let size = wgpu::Extent3d {
            width: width.max(1),
            height: height.max(1),
            depth_or_array_layers: 1,
        };
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("nie atlas"),
            size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        let expected = (size.width as usize) * (size.height as usize) * 4;
        let padded;
        let data = if rgba.len() >= expected {
            &rgba[..expected]
        } else {
            let mut v = rgba.to_vec();
            v.resize(expected, 0);
            padded = v;
            &padded
        };
        renderer.queue().write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            data,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(size.width * 4),
                rows_per_image: Some(size.height),
            },
            size,
        );
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let bind = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("nie atlas"),
            layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(linear),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(nearest),
                },
            ],
        });
        Tex {
            _texture: texture,
            bind,
            size: (width, height),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use aphrody_nie_ui::paint::{Painter, QuadRecorder};

    #[test]
    fn backing_store_follows_dpr_up_to_4k() {
        assert_eq!(backing_size(1920.0, 1080.0, 2.0, 8192), (3840, 2160));
        assert_eq!(backing_size(800.0, 450.0, 1.5, 8192), (1200, 675));
        let (w, h) = backing_size(2560.0, 1440.0, 2.0, 8192);
        assert!(u64::from(w) * u64::from(h) <= MAX_PIXELS);
        assert!((w as f32 / h as f32 - 16.0 / 9.0).abs() < 0.01);
        assert_eq!(backing_size(4000.0, 1000.0, 1.0, 2048), (2048, 512));
    }

    #[test]
    fn ui_keeps_1080p_metrics_at_4k() {
        assert_eq!(logical_size(3840, 2160), (1920, 1080));
        assert_eq!(logical_size(1280, 720), (1280, 720));
    }

    #[test]
    fn batching_keeps_order_and_merges_same_texture() {
        let mut list = DrawList::default();
        {
            let mut p = QuadRecorder::new(&mut list, 100, 100);
            p.fill_rect(0, 0, 1, 1, [1, 1, 1, 255]);
            p.fill_rect(0, 0, 1, 1, [1, 1, 1, 255]);
        }
        list.push_external(0, [0.0; 4]);
        {
            let mut p = QuadRecorder::new(&mut list, 100, 100);
            p.fill_disc(5.0, 5.0, 3.0, [1, 1, 1, 255]);
        }
        let (mut quads, mut runs) = (Vec::new(), Vec::new());
        batch(&list, &mut quads, &mut runs);
        assert_eq!(quads.len(), 4);
        assert_eq!(
            runs.iter().map(|r| (r.start, r.count)).collect::<Vec<_>>(),
            vec![(0, 2), (2, 1), (3, 1)]
        );
        let mut packed = Vec::new();
        pack(&quads, &mut packed);
        assert_eq!(packed.len(), 4 * 24);
    }

    #[test]
    fn pacing_reports_120hz() {
        let mut p = FramePacing::default();
        for _ in 0..300 {
            p.record(1000.0 / 120.0, 1.5);
        }
        let s = p.summary();
        assert!((s.fps - 120.0).abs() < 0.01);
        assert!((s.p99_ms - 8.333).abs() < 0.01);
        assert!((s.cpu_ms - 1.5).abs() < 1e-4);
        assert_eq!(s.frames, 300);
    }

    #[cfg(not(target_arch = "wasm32"))]
    #[test]
    fn quad_wgsl_is_valid() {
        use aphrody_gpu_backend::wgpu::naga;
        let module = naga::front::wgsl::parse_str(QUAD_WGSL).expect("WGSL parses");
        naga::valid::Validator::new(
            naga::valid::ValidationFlags::all(),
            naga::valid::Capabilities::empty(),
        )
        .validate(&module)
        .expect("WGSL validates");
        assert_eq!(module.entry_points.len(), 2);
    }
}
