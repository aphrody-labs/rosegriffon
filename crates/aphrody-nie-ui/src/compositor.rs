//! Compositeur 2D pur Rust des scènes VFS (`aphrody_nie_formats::menu_presentation::Scene`).
//!
//! Décode les PNG servis par `aphrody-nie-model-serve` (`/tex/…`), résout les sous-rectangles
//! d'atlas (`/tex-info/…`), applique les masques d'alpha et de luminance (`btn_base01_msk`), les
//! rotations (`rotationDeg`), les régions focalisées (`focusedRegion`, `visibleWhen = "focused"`),
//! la police bitmap officielle `font_def` (`FontMetrics`) et la navigation directionnelle 2D à la
//! manette sur tous les contrôles mesurés.

use std::collections::BTreeMap;

use aphrody_nie_formats::font::{FontMetrics, GlyphMetric};
use aphrody_nie_formats::menu_presentation::{Control, Layer, Rect, Scene, Text};

use crate::paint::{Painter, RasterPainter};

/// Sous-rectangle nommé dans un atlas décodé en RGBA8.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AtlasRegion {
    /// Abscisse du coin supérieur gauche dans l'atlas (px).
    pub x: u32,
    /// Ordonnée du coin supérieur gauche dans l'atlas (px).
    pub y: u32,
    /// Largeur de la région (px).
    pub width: u32,
    /// Hauteur de la région (px).
    pub height: u32,
}

/// Texture d'atlas décodée en RGBA8 accompagnée de ses régions nommées.
#[derive(Debug, Clone)]
pub struct DecodedAtlas {
    /// Largeur totale de l'image RGBA8 (px).
    pub width: u32,
    /// Hauteur totale de l'image RGBA8 (px).
    pub height: u32,
    /// Tampon RGBA8 ligne par ligne (`width * height * 4` octets).
    pub rgba: Vec<u8>,
    /// Régions nommées indexées par leur identifiant exact dans le `.g4tx`.
    pub regions: BTreeMap<String, AtlasRegion>,
}

/// Compositeur d'écrans VFS partagé entre `EACLauncher`, `Start`, `title_menu_2`, les sous-menus
/// et le HUD de match.
#[derive(Debug, Default, Clone)]
pub struct SceneCompositor {
    atlases: BTreeMap<String, DecodedAtlas>,
    pending_regions: BTreeMap<String, BTreeMap<String, AtlasRegion>>,
    font_atlas: Option<(u32, u32, Vec<u8>)>,
    font_metrics: Option<FontMetrics>,
}

/// Décode un PNG (RGBA, RGB, niveaux de gris ou palette normalisée) en RGBA8 borné.
///
/// # Errors
///
/// Retourne une erreur lisible si les octets PNG sont invalides ou dépassent `max_rgba_bytes`.
pub fn decode_png_rgba(bytes: &[u8], max_rgba_bytes: usize) -> Result<(u32, u32, Vec<u8>), String> {
    let mut decoder = png::Decoder::new(std::io::Cursor::new(bytes));
    decoder.set_transformations(png::Transformations::normalize_to_color8());
    let mut reader = decoder
        .read_info()
        .map_err(|e| format!("png read_info: {e}"))?;
    let info_hdr = reader.info();
    let w = info_hdr.width;
    let h = info_hdr.height;
    let rgba_len = (w as usize)
        .checked_mul(h as usize)
        .and_then(|px| px.checked_mul(4))
        .ok_or_else(|| String::from("png dimensions overflow"))?;
    if rgba_len == 0 || rgba_len > max_rgba_bytes {
        return Err(format!("png size {rgba_len} out of bounds"));
    }
    let buf_size = reader
        .output_buffer_size()
        .ok_or_else(|| String::from("png output_buffer_size overflow"))?;
    if buf_size > max_rgba_bytes {
        return Err(String::from("png raw buffer exceeds limit"));
    }
    let mut raw = vec![0u8; buf_size];
    let frame = reader
        .next_frame(&mut raw)
        .map_err(|e| format!("png next_frame: {e}"))?;
    let px_count = (frame.width as usize) * (frame.height as usize);
    let mut rgba = vec![0u8; px_count * 4];
    match frame.color_type {
        png::ColorType::Rgba => rgba.copy_from_slice(&raw[..px_count * 4]),
        png::ColorType::Rgb => {
            for i in 0..px_count {
                rgba[i * 4] = raw[i * 3];
                rgba[i * 4 + 1] = raw[i * 3 + 1];
                rgba[i * 4 + 2] = raw[i * 3 + 2];
                rgba[i * 4 + 3] = 255;
            }
        }
        png::ColorType::Grayscale => {
            for i in 0..px_count {
                let g = raw[i];
                rgba[i * 4] = g;
                rgba[i * 4 + 1] = g;
                rgba[i * 4 + 2] = g;
                rgba[i * 4 + 3] = 255;
            }
        }
        png::ColorType::GrayscaleAlpha => {
            for i in 0..px_count {
                let g = raw[i * 2];
                rgba[i * 4] = g;
                rgba[i * 4 + 1] = g;
                rgba[i * 4 + 2] = g;
                rgba[i * 4 + 3] = raw[i * 2 + 1];
            }
        }
        png::ColorType::Indexed => {
            return Err(String::from("png indexed palette was not expanded"));
        }
    }
    Ok((frame.width, frame.height, rgba))
}

/// Extrait les régions d'atlas d'une réponse `/tex-info/<rel>.g4tx` (`aphrody-nie-model-serve`).
///
/// # Errors
///
/// Retourne une erreur si le JSON est malformé.
pub fn parse_tex_info_regions(json: &str) -> Result<BTreeMap<String, AtlasRegion>, String> {
    let root: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("tex-info json: {e}"))?;
    let mut map = BTreeMap::new();
    if let Some(textures) = root.get("textures").and_then(serde_json::Value::as_array) {
        for tex in textures {
            let tw = tex
                .get("width")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(0) as u32;
            let th = tex
                .get("height")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(0) as u32;
            if let Some(tname) = tex.get("name").and_then(serde_json::Value::as_str)
                && tw > 0
                && th > 0
            {
                map.entry(tname.to_owned()).or_insert(AtlasRegion {
                    x: 0,
                    y: 0,
                    width: tw,
                    height: th,
                });
            }
            if let Some(regions) = tex
                .get("regionsDetail")
                .and_then(serde_json::Value::as_array)
            {
                for reg in regions {
                    let Some(name) = reg.get("name").and_then(serde_json::Value::as_str) else {
                        continue;
                    };
                    let x = reg
                        .get("x")
                        .and_then(serde_json::Value::as_i64)
                        .unwrap_or(0)
                        .max(0) as u32;
                    let y = reg
                        .get("y")
                        .and_then(serde_json::Value::as_i64)
                        .unwrap_or(0)
                        .max(0) as u32;
                    let width = reg
                        .get("width")
                        .and_then(serde_json::Value::as_i64)
                        .unwrap_or(0)
                        .max(0) as u32;
                    let height = reg
                        .get("height")
                        .and_then(serde_json::Value::as_i64)
                        .unwrap_or(0)
                        .max(0) as u32;
                    if width > 0 && height > 0 {
                        map.insert(
                            name.to_owned(),
                            AtlasRegion {
                                x,
                                y,
                                width,
                                height,
                            },
                        );
                    }
                }
            }
        }
    }
    Ok(map)
}

impl SceneCompositor {
    /// Crée un compositeur vide prêt à recevoir les textures et la police du VFS.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Indique si l'atlas identifié par `asset_path` est déjà chargé en mémoire.
    #[must_use]
    pub fn has_atlas(&self, asset_path: &str) -> bool {
        self.atlases.contains_key(asset_path)
    }

    /// Indique si les régions d'atlas pour `asset_path` ont déjà été reçues.
    #[must_use]
    pub fn has_regions(&self, asset_path: &str) -> bool {
        self.pending_regions.contains_key(asset_path)
            || self
                .atlases
                .get(asset_path)
                .is_some_and(|a| !a.regions.is_empty())
    }

    /// Indique si la police officielle `font_def` (atlas + métriques) est prête.
    #[must_use]
    pub fn has_font(&self) -> bool {
        self.font_atlas.is_some() && self.font_metrics.is_some()
    }

    /// Accès en lecture à un atlas décodé par son chemin VFS (`data/dx11/...`).
    #[must_use]
    pub fn atlas(&self, asset_path: &str) -> Option<&DecodedAtlas> {
        self.atlases.get(asset_path)
    }

    /// Accès aux métriques typographiques chargées.
    #[must_use]
    pub fn font_metrics(&self) -> Option<&FontMetrics> {
        self.font_metrics.as_ref()
    }

    /// Enregistre un PNG décodé pour un chemin VFS donné (`data/dx11/...g4tx` ou clé statique).
    ///
    /// # Errors
    ///
    /// Retourne une erreur si le PNG est invalide ou excède le budget mémoire.
    pub fn insert_png(&mut self, asset_path: &str, png_bytes: &[u8]) -> Result<(), String> {
        // `font_def` fait 4096x2048x4 = 33.55 MiB ; plafond unitaire fixé à 48 MiB.
        const MAX_ATLAS_BYTES: usize = 48 * 1024 * 1024;
        let (width, height, rgba) = decode_png_rgba(png_bytes, MAX_ATLAS_BYTES)?;
        if asset_path == "data/dx11/font/font_def/font.g4tx" || asset_path == "font_def" {
            self.font_atlas = Some((width, height, rgba));
            return Ok(());
        }
        let mut regions = self
            .pending_regions
            .remove(asset_path)
            .or_else(|| self.atlases.remove(asset_path).map(|old| old.regions))
            .unwrap_or_default();
        if let Some(stem) = asset_path
            .rsplit('/')
            .next()
            .and_then(|f| f.strip_suffix(".g4tx"))
        {
            regions.entry(stem.to_owned()).or_insert(AtlasRegion {
                x: 0,
                y: 0,
                width,
                height,
            });
        }
        self.atlases.insert(
            asset_path.to_owned(),
            DecodedAtlas {
                width,
                height,
                rgba,
                regions,
            },
        );
        Ok(())
    }

    /// Enregistre la table des régions issue de `/tex-info/<rel>.g4tx`.
    ///
    /// # Errors
    ///
    /// Retourne une erreur si le JSON de `/tex-info` est malformé.
    pub fn insert_tex_info(&mut self, asset_path: &str, tex_info_json: &str) -> Result<(), String> {
        let parsed = parse_tex_info_regions(tex_info_json)?;
        if let Some(atlas) = self.atlases.get_mut(asset_path) {
            for (k, v) in parsed {
                atlas.regions.insert(k, v);
            }
        } else {
            self.pending_regions.insert(asset_path.to_owned(), parsed);
        }
        Ok(())
    }

    /// Enregistre les métriques de glyphes (`FontMetrics` sérialisées en JSON depuis `font.cfg.bin`).
    ///
    /// # Errors
    ///
    /// Retourne une erreur si le JSON ne correspond pas à `FontMetrics`.
    pub fn insert_font_metrics_json(&mut self, metrics_json: &str) -> Result<(), String> {
        let metrics: FontMetrics =
            serde_json::from_str(metrics_json).map_err(|e| format!("font metrics json: {e}"))?;
        self.font_metrics = Some(metrics);
        Ok(())
    }

    /// Enregistre directement `FontMetrics` en mémoire (utile aux tests et hôtes natifs).
    pub fn set_font(&mut self, atlas_w: u32, atlas_h: u32, atlas_rgba: Vec<u8>, metrics: FontMetrics) {
        self.font_atlas = Some((atlas_w, atlas_h, atlas_rgba));
        self.font_metrics = Some(metrics);
    }

    /// Compose une ou plusieurs scènes superposées (ex. `avatar-common` + `avatar-top`) dans `canvas`.
    ///
    /// `focused_actions` contient le ou les identifiants d'actions actifs (ex. onglet courant +
    /// bouton focalisé). Retourne le nombre de calques effectivement peints.
    #[allow(clippy::too_many_arguments)]
    pub fn compose_scenes(
        &self,
        scenes: &[&Scene],
        focused_actions: &[&str],
        pulse_phase: f32,
        canvas: &mut [u8],
        dst_w: u32,
        dst_h: u32,
        clear_bg: bool,
    ) -> usize {
        RasterPainter::new(canvas, dst_w, dst_h).map_or(0, |mut p| {
            self.compose_scenes_on(scenes, focused_actions, pulse_phase, &mut p, clear_bg)
        })
    }

    /// [`Self::compose_scenes`] on any [`Painter`] (CPU raster or GPU quad recorder).
    pub fn compose_scenes_on(
        &self,
        scenes: &[&Scene],
        focused_actions: &[&str],
        pulse_phase: f32,
        canvas: &mut dyn Painter,
        clear_bg: bool,
    ) -> usize {
        let (dst_w, dst_h) = canvas.size();
        if dst_w == 0 || dst_h == 0 {
            return 0;
        }
        if clear_bg {
            let bg = scenes
                .first()
                .and_then(|s| s.background.as_deref())
                .and_then(parse_hex_rgba)
                .unwrap_or([6, 10, 18, 255]);
            canvas.clear(bg);
        }

        let mut drawn = 0usize;
        for scene in scenes {
            let sx = dst_w as f64 / f64::from(scene.canvas.width.max(1));
            let sy = dst_h as f64 / f64::from(scene.canvas.height.max(1));

            #[derive(Clone, Copy)]
            enum Item<'a> {
                Layer(&'a Layer),
                Text(&'a Text),
            }
            let mut items: Vec<(i32, usize, Item<'_>)> =
                Vec::with_capacity(scene.layers.len() + scene.texts.len());
            for (idx, layer) in scene.layers.iter().enumerate() {
                items.push((layer.draw_order, idx, Item::Layer(layer)));
            }
            let base = scene.layers.len();
            for (idx, text) in scene.texts.iter().enumerate() {
                items.push((text.draw_order, base + idx, Item::Text(text)));
            }
            items.sort_by_key(|(order, idx, _)| (*order, *idx));

            for (_, _, item) in items {
                match item {
                    Item::Layer(layer) => {
                        let is_focused = layer
                            .action_id
                            .as_deref()
                            .is_some_and(|act| focused_actions.contains(&act));
                        if layer.visible_when.as_deref() == Some("focused") && !is_focused {
                            continue;
                        }
                        let region_name = if is_focused {
                            layer.focused_region.as_deref().unwrap_or(&layer.region)
                        } else {
                            &layer.region
                        };
                        let opacity = if layer.visible_when.as_deref() == Some("focused") {
                            let wave = 0.82 + 0.18 * (pulse_phase * 5.0).sin().abs();
                            (wave * 255.0).clamp(180.0, 255.0) as u8
                        } else {
                            255
                        };
                        if self.blit_scene_layer(
                            layer,
                            region_name,
                            opacity,
                            sx,
                            sy,
                            canvas,
                        ) {
                            drawn += 1;
                        }
                    }
                    Item::Text(t) => {
                        let rgb = t.color.unwrap_or(0xFF_FFFF);
                        let color = [
                            ((rgb >> 16) & 0xFF) as u8,
                            ((rgb >> 8) & 0xFF) as u8,
                            (rgb & 0xFF) as u8,
                            255,
                        ];
                        let dx = (t.rect.x * sx).round() as i32;
                        let dy = (t.rect.y * sy).round() as i32;
                        let dh = (t.rect.h * sy).round().max(12.0) as f32;
                        if self.draw_text_height_on(
                            &t.text,
                            dx,
                            dy,
                            dh * 0.62,
                            color,
                            true,
                            canvas,
                        ) > 0
                        {
                            drawn += 1;
                        }
                    }
                }
            }
        }
        drawn
    }

    /// Blitte une région nommée d'un atlas arbitraire vers un rectangle destination en pixels écran.
    #[allow(clippy::too_many_arguments)]
    pub fn blit_named_region(
        &self,
        asset_path: &str,
        region_name: &str,
        dst_x: i32,
        dst_y: i32,
        dst_w_px: u32,
        dst_h_px: u32,
        opacity: u8,
        canvas: &mut [u8],
        canvas_w: u32,
        canvas_h: u32,
    ) -> bool {
        RasterPainter::new(canvas, canvas_w, canvas_h).is_some_and(|mut p| {
            self.blit_named_region_on(
                asset_path, region_name, dst_x, dst_y, dst_w_px, dst_h_px, opacity, &mut p,
            )
        })
    }

    /// [`Self::blit_named_region`] on any [`Painter`].
    #[allow(clippy::too_many_arguments)]
    pub fn blit_named_region_on(
        &self,
        asset_path: &str,
        region_name: &str,
        dst_x: i32,
        dst_y: i32,
        dst_w_px: u32,
        dst_h_px: u32,
        opacity: u8,
        canvas: &mut dyn Painter,
    ) -> bool {
        let Some(atlas) = self.atlases.get(asset_path) else {
            return false;
        };
        let region = atlas
            .regions
            .get(region_name)
            .copied()
            .unwrap_or(AtlasRegion {
                x: 0,
                y: 0,
                width: atlas.width,
                height: atlas.height,
            });
        canvas.blit(
            asset_path,
            atlas,
            region,
            None,
            false,
            0.0,
            opacity,
            [dst_x, dst_y, dst_w_px as i32, dst_h_px as i32],
        );
        true
    }

    /// Mesure la largeur en pixels d'une chaîne rendue à hauteur cible `target_px_h`.
    #[must_use]
    pub fn measure_text_height(&self, text: &str, target_px_h: f32) -> i32 {
        if let Some(metrics) = &self.font_metrics {
            let base_h = f32::from(metrics.dims.cell_height.max(1));
            let scale = (target_px_h / base_h).clamp(0.15, 3.0);
            (metrics.measure_text(text) as f32 * scale).round() as i32
        } else {
            let scale = (target_px_h / 7.0).round().max(1.0) as i32;
            (text.chars().count() as i32) * 6 * scale
        }
    }

    /// Trace une chaîne avec la vraie police `font_def` mise à l'échelle `target_px_h` (avec ombre
    /// portée optionnelle pour la lisibilité sur les scènes lumineuses). Repli sur le mini-rastériseur
    /// 5x7 uniquement pendant les premières millisecondes du boot EAC avant réception de `font_def`.
    #[allow(clippy::too_many_arguments)]
    pub fn draw_text_height(
        &self,
        text: &str,
        x: i32,
        y: i32,
        target_px_h: f32,
        color: [u8; 4],
        shadow: bool,
        canvas: &mut [u8],
        canvas_w: u32,
        canvas_h: u32,
    ) -> i32 {
        RasterPainter::new(canvas, canvas_w, canvas_h).map_or(0, |mut p| {
            self.draw_text_height_on(text, x, y, target_px_h, color, shadow, &mut p)
        })
    }

    /// [`Self::draw_text_height`] on any [`Painter`].
    #[allow(clippy::too_many_arguments)]
    pub fn draw_text_height_on(
        &self,
        text: &str,
        x: i32,
        y: i32,
        target_px_h: f32,
        color: [u8; 4],
        shadow: bool,
        canvas: &mut dyn Painter,
    ) -> i32 {
        if let (Some((atlas_w, _, atlas_rgba)), Some(metrics)) =
            (&self.font_atlas, &self.font_metrics)
        {
            let base_h = f32::from(metrics.dims.cell_height.max(1));
            let scale = (target_px_h / base_h).clamp(0.18, 2.5);
            if shadow && color[3] > 32 {
                let sh_alpha = (u16::from(color[3]) * 165 / 255) as u8;
                let _ = draw_scaled_font_def(
                    atlas_rgba,
                    *atlas_w,
                    metrics,
                    text,
                    x + 2,
                    y + 2,
                    scale,
                    [0, 0, 0, sh_alpha],
                    canvas,
                );
            }
            return draw_scaled_font_def(
                atlas_rgba,
                *atlas_w,
                metrics,
                text,
                x,
                y,
                scale,
                color,
                canvas,
            );
        }

        let px_scale = (target_px_h / 8.0).round().clamp(1.0, 4.0) as i32;
        if shadow && color[3] > 32 {
            draw_fallback_5x7(
                text,
                x + 1,
                y + 1,
                px_scale,
                [0, 0, 0, color[3] / 2],
                canvas,
            );
        }
        draw_fallback_5x7(text, x, y, px_scale, color, canvas)
    }

    #[allow(clippy::too_many_arguments)]
    fn blit_scene_layer(
        &self,
        layer: &Layer,
        region_name: &str,
        opacity: u8,
        sx: f64,
        sy: f64,
        canvas: &mut dyn Painter,
    ) -> bool {
        let Some(atlas) = self.atlases.get(&layer.asset_path) else {
            return false;
        };
        let region = if let Some(r) = atlas.regions.get(region_name) {
            *r
        } else if atlas.regions.len() <= 1 {
            AtlasRegion {
                x: 0,
                y: 0,
                width: atlas.width,
                height: atlas.height,
            }
        } else {
            return false;
        };
        let mask = layer
            .mask_region
            .as_deref()
            .and_then(|m| atlas.regions.get(m).copied());
        let mask_luminance = layer.mask_mode.as_deref() == Some("luminance");
        let rot_deg = layer.rotation_deg.unwrap_or(0.0) as f32;

        let dx = (layer.rect.x * sx).round() as i32;
        let dy = (layer.rect.y * sy).round() as i32;
        let dw = (layer.rect.w * sx).round().max(1.0) as i32;
        let dh = (layer.rect.h * sy).round().max(1.0) as i32;

        canvas.blit(
            &layer.asset_path,
            atlas,
            region,
            mask,
            mask_luminance,
            rot_deg,
            opacity,
            [dx, dy, dw, dh],
        );
        true
    }
}

/// Navigation spatiale 2D sur les rectangles mesurés d'une [`Scene`].
///
/// Trouve le contrôle voisin le plus naturel dans la direction `(dx, dy)` (croix directionnelle ou
/// stick analogique gauche), avec pénalité latérale pour respecter les rangées et colonnes de
/// `title-menu.json` (bannières Avatar/Équipe en haut, 8 tuiles centrales, 3 tuiles basses).
#[must_use]
pub fn navigate_spatial(
    controls: &[Control],
    current_id: Option<&str>,
    dx: f32,
    dy: f32,
) -> Option<String> {
    if controls.is_empty() {
        return None;
    }
    let mag = (dx * dx + dy * dy).sqrt();
    if mag < 0.25 {
        return current_id.map(str::to_owned);
    }
    let Some(cur_id) = current_id else {
        return Some(controls[0].id.clone());
    };
    let Some(cur) = controls.iter().find(|c| c.id == cur_id) else {
        return Some(controls[0].id.clone());
    };
    let dir_x = f64::from(dx / mag);
    let dir_y = f64::from(dy / mag);
    let (cx, cy) = rect_center(&cur.rect);

    let mut best: Option<(f64, &str)> = None;
    for cand in controls {
        if cand.id == cur.id {
            continue;
        }
        let (tx, ty) = rect_center(&cand.rect);
        let vx = tx - cx;
        let vy = ty - cy;
        let dist = (vx * vx + vy * vy).sqrt();
        if dist < 1.0 {
            continue;
        }
        let proj = vx * dir_x + vy * dir_y;
        // Exige que le candidat soit dans le demi-cône avant (~72 degrés).
        if proj <= dist * 0.30 {
            continue;
        }
        let perp = (vx * (-dir_y) + vy * dir_x).abs();
        let score = proj + perp * 2.35;
        if best.is_none_or(|(b, _)| score < b) {
            best = Some((score, &cand.id));
        }
    }
    best.map(|(_, id)| id.to_owned())
        .or_else(|| Some(cur.id.clone()))
}

fn rect_center(r: &Rect) -> (f64, f64) {
    (r.x + r.w * 0.5, r.y + r.h * 0.5)
}

/// Remplit un tampon RGBA8 d'une couleur unie.
pub fn fill_solid(canvas: &mut [u8], color: [u8; 4]) {
    for px in canvas.chunks_exact_mut(4) {
        px.copy_from_slice(&color);
    }
}

/// Peint un rectangle plein alpha-composé sur `canvas`.
#[allow(clippy::too_many_arguments)]
pub fn fill_rect_alpha(
    canvas: &mut [u8],
    canvas_w: u32,
    canvas_h: u32,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    color: [u8; 4],
) {
    if w <= 0 || h <= 0 || color[3] == 0 {
        return;
    }
    let x0 = x.max(0);
    let y0 = y.max(0);
    let x1 = (x + w).min(canvas_w as i32);
    let y1 = (y + h).min(canvas_h as i32);
    if x0 >= x1 || y0 >= y1 {
        return;
    }
    for py in y0..y1 {
        let row = (py as usize) * (canvas_w as usize) * 4;
        for px in x0..x1 {
            let off = row + (px as usize) * 4;
            blend_over(&mut canvas[off..off + 4], color);
        }
    }
}

/// Trace une bordure rectangulaire de `thickness` pixels.
#[allow(clippy::too_many_arguments)]
pub fn stroke_rect_alpha(
    canvas: &mut [u8],
    canvas_w: u32,
    canvas_h: u32,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    thickness: i32,
    color: [u8; 4],
) {
    let t = thickness.max(1);
    fill_rect_alpha(canvas, canvas_w, canvas_h, x, y, w, t, color);
    fill_rect_alpha(canvas, canvas_w, canvas_h, x, y + h - t, w, t, color);
    fill_rect_alpha(canvas, canvas_w, canvas_h, x, y + t, t, h - 2 * t, color);
    fill_rect_alpha(
        canvas,
        canvas_w,
        canvas_h,
        x + w - t,
        y + t,
        t,
        h - 2 * t,
        color,
    );
}

/// Mélange alpha droit standard `src over dst`.
#[inline]
pub fn blend_over(dst: &mut [u8], src: [u8; 4]) {
    let sa = u32::from(src[3]);
    if sa == 0 {
        return;
    }
    if sa == 255 || dst[3] == 0 {
        dst.copy_from_slice(&src);
        return;
    }
    let inv = 255 - sa;
    let da = u32::from(dst[3]);
    let out_a = sa * 255 + da * inv;
    for c in 0..3 {
        let num = u32::from(src[c]) * sa * 255 + u32::from(dst[c]) * da * inv;
        dst[c] = ((num + out_a / 2) / out_a) as u8;
    }
    dst[3] = ((out_a + 127) / 255) as u8;
}

fn parse_hex_rgba(hex: &str) -> Option<[u8; 4]> {
    let s = hex.strip_prefix('#')?;
    match s.len() {
        6 => {
            let v = u32::from_str_radix(s, 16).ok()?;
            Some([
                ((v >> 16) & 0xFF) as u8,
                ((v >> 8) & 0xFF) as u8,
                (v & 0xFF) as u8,
                255,
            ])
        }
        8 => {
            let v = u32::from_str_radix(s, 16).ok()?;
            Some([
                ((v >> 24) & 0xFF) as u8,
                ((v >> 16) & 0xFF) as u8,
                ((v >> 8) & 0xFF) as u8,
                (v & 0xFF) as u8,
            ])
        }
        _ => None,
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn blit_region_transformed(
    atlas: &DecodedAtlas,
    region: AtlasRegion,
    mask: Option<AtlasRegion>,
    mask_luminance: bool,
    rotation_deg: f32,
    opacity: u8,
    dst_x: i32,
    dst_y: i32,
    dst_w: i32,
    dst_h: i32,
    canvas: &mut [u8],
    canvas_w: u32,
    canvas_h: u32,
) {
    if dst_w <= 0 || dst_h <= 0 || region.width == 0 || region.height == 0 || opacity == 0 {
        return;
    }
    let rad = -rotation_deg.to_radians();
    let (cos_a, sin_a) = (rad.cos(), rad.sin());
    let rotated = rotation_deg.abs() > 0.05;

    let half_w = dst_w as f32 * 0.5;
    let half_h = dst_h as f32 * 0.5;
    let cx = dst_x as f32 + half_w;
    let cy = dst_y as f32 + half_h;

    let (bound_w, bound_h) = if rotated {
        let bw = (half_w * cos_a.abs() + half_h * sin_a.abs()).ceil() as i32 + 1;
        let bh = (half_w * sin_a.abs() + half_h * cos_a.abs()).ceil() as i32 + 1;
        (bw, bh)
    } else {
        (dst_w / 2 + 1, dst_h / 2 + 1)
    };

    let x0 = if rotated {
        ((cx as i32) - bound_w).max(0)
    } else {
        dst_x.max(0)
    };
    let y0 = if rotated {
        ((cy as i32) - bound_h).max(0)
    } else {
        dst_y.max(0)
    };
    let x1 = if rotated {
        ((cx as i32) + bound_w).min(canvas_w as i32)
    } else {
        (dst_x + dst_w).min(canvas_w as i32)
    };
    let y1 = if rotated {
        ((cy as i32) + bound_h).min(canvas_h as i32)
    } else {
        (dst_y + dst_h).min(canvas_h as i32)
    };

    for py in y0..y1 {
        let row_off = (py as usize) * (canvas_w as usize) * 4;
        for px in x0..x1 {
            let (u, v) = if rotated {
                let rx = (px as f32 + 0.5) - cx;
                let ry = (py as f32 + 0.5) - cy;
                let lx = rx * cos_a - ry * sin_a + half_w;
                let ly = rx * sin_a + ry * cos_a + half_h;
                (lx / dst_w as f32, ly / dst_h as f32)
            } else {
                (
                    (px - dst_x) as f32 / dst_w as f32,
                    (py - dst_y) as f32 / dst_h as f32,
                )
            };
            if !(0.0..1.0).contains(&u) || !(0.0..1.0).contains(&v) {
                continue;
            }
            let mut color = sample_bilinear(atlas, region, u, v);
            if color[3] == 0 {
                continue;
            }
            if let Some(mreg) = mask {
                let mpx = sample_bilinear(atlas, mreg, u, v);
                let factor = if mask_luminance {
                    let lum = (77 * u32::from(mpx[0])
                        + 150 * u32::from(mpx[1])
                        + 29 * u32::from(mpx[2]))
                        >> 8;
                    lum * u32::from(mpx[3]) / 255
                } else {
                    u32::from(mpx[3])
                };
                color[3] = ((u32::from(color[3]) * factor) / 255) as u8;
            }
            if opacity < 255 {
                color[3] = ((u32::from(color[3]) * u32::from(opacity)) / 255) as u8;
            }
            if color[3] == 0 {
                continue;
            }
            let dst_off = row_off + (px as usize) * 4;
            blend_over(&mut canvas[dst_off..dst_off + 4], color);
        }
    }
}

fn sample_bilinear(atlas: &DecodedAtlas, r: AtlasRegion, u: f32, v: f32) -> [u8; 4] {
    let fx = r.x as f32 + u.clamp(0.0, 0.999_9) * (r.width.saturating_sub(1)) as f32;
    let fy = r.y as f32 + v.clamp(0.0, 0.999_9) * (r.height.saturating_sub(1)) as f32;
    let x0 = (fx.floor() as u32).min(atlas.width.saturating_sub(1));
    let y0 = (fy.floor() as u32).min(atlas.height.saturating_sub(1));
    let x1 = (x0 + 1).min((r.x + r.width).saturating_sub(1)).min(atlas.width.saturating_sub(1));
    let y1 = (y0 + 1).min((r.y + r.height).saturating_sub(1)).min(atlas.height.saturating_sub(1));
    let tx = fx - fx.floor();
    let ty = fy - fy.floor();

    let px = |x: u32, y: u32| -> [f32; 4] {
        let i = ((y as usize) * (atlas.width as usize) + (x as usize)) * 4;
        [
            f32::from(atlas.rgba[i]),
            f32::from(atlas.rgba[i + 1]),
            f32::from(atlas.rgba[i + 2]),
            f32::from(atlas.rgba[i + 3]),
        ]
    };
    let c00 = px(x0, y0);
    let c10 = px(x1, y0);
    let c01 = px(x0, y1);
    let c11 = px(x1, y1);
    let mut out = [0u8; 4];
    for k in 0..4 {
        let top = c00[k] + (c10[k] - c00[k]) * tx;
        let bot = c01[k] + (c11[k] - c01[k]) * tx;
        out[k] = (top + (bot - top) * ty).round().clamp(0.0, 255.0) as u8;
    }
    out
}

#[allow(clippy::too_many_arguments)]
fn draw_scaled_font_def(
    atlas: &[u8],
    atlas_w: u32,
    metrics: &FontMetrics,
    text: &str,
    x: i32,
    y: i32,
    scale: f32,
    color: [u8; 4],
    canvas: &mut dyn Painter,
) -> i32 {
    let cell_h = metrics.dims.cell_height;
    if cell_h == 0 || atlas_w == 0 {
        return 0;
    }
    let mut cursor_x = 0.0f32;
    for ch in text.chars() {
        if ch == ' ' {
            let sp = metrics
                .glyph_char(' ')
                .map_or(16.0, |m| f32::from(m.advance));
            cursor_x += sp * scale;
            continue;
        }
        let Some(m) = metrics.glyph_char(ch) else {
            cursor_x += 14.0 * scale;
            continue;
        };
        canvas.glyph(
            atlas,
            atlas_w,
            m,
            cell_h,
            (x as f32 + cursor_x + f32::from(m.bearing_x) * scale).round() as i32,
            y,
            scale,
            color,
        );
        cursor_x += f32::from(m.advance) * scale;
    }
    cursor_x.round() as i32
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn blit_scaled_glyph(
    atlas: &[u8],
    atlas_w: u32,
    metric: &GlyphMetric,
    cell_h: u16,
    dst_x: i32,
    dst_y: i32,
    scale: f32,
    color: [u8; 4],
    canvas: &mut [u8],
    canvas_w: u32,
    canvas_h: u32,
) {
    let plane = usize::from(metric.page);
    if plane >= 4 || metric.width == 0 || cell_h == 0 {
        return;
    }
    let atlas_stride = (atlas_w as usize) * 4;
    let atlas_h = atlas.len() / atlas_stride;
    let out_w = ((f32::from(metric.width) * scale).ceil() as i32).max(1);
    let out_h = ((f32::from(cell_h) * scale).ceil() as i32).max(1);

    for ry in 0..out_h {
        let py = dst_y + ry;
        if py < 0 || py >= canvas_h as i32 {
            continue;
        }
        let sy = f32::from(metric.y) + (ry as f32 + 0.5) / scale;
        let ay = (sy.floor() as usize).min(atlas_h.saturating_sub(1));
        let row_canvas = (py as usize) * (canvas_w as usize) * 4;
        let row_atlas = ay * atlas_stride;
        for rx in 0..out_w {
            let px = dst_x + rx;
            if px < 0 || px >= canvas_w as i32 {
                continue;
            }
            let sx = f32::from(metric.x) + (rx as f32 + 0.5) / scale;
            let ax = (sx.floor() as usize).min((atlas_w as usize).saturating_sub(1));
            let cov = atlas[row_atlas + ax * 4 + plane];
            if cov == 0 {
                continue;
            }
            let alpha = ((u32::from(cov) * u32::from(color[3])) / 255) as u8;
            if alpha == 0 {
                continue;
            }
            let off = row_canvas + (px as usize) * 4;
            blend_over(&mut canvas[off..off + 4], [color[0], color[1], color[2], alpha]);
        }
    }
}

/// Mini-glyphes 5x7 ASCII utilisés uniquement pendant les premières millisecondes de `EACLauncher`
/// avant que `font_def` ne soit reçu du CDN.
#[allow(clippy::too_many_arguments)]
fn draw_fallback_5x7(
    text: &str,
    x: i32,
    y: i32,
    scale: i32,
    color: [u8; 4],
    canvas: &mut dyn Painter,
) -> i32 {
    let mut cx = x;
    let s = scale.max(1);
    for ch in text.chars() {
        let rows = glyph_5x7(ch.to_ascii_uppercase());
        for (ry, bits) in rows.iter().enumerate() {
            for rx in 0..5 {
                if (bits >> (4 - rx)) & 1 == 1 {
                    canvas.fill_rect(
                        cx + rx * s,
                        y + (ry as i32) * s,
                        s,
                        s,
                        color,
                    );
                }
            }
        }
        cx += 6 * s;
    }
    cx - x
}

const fn glyph_5x7(ch: char) -> [u8; 7] {
    match ch {
        'A' => [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
        'B' => [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
        'C' => [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
        'D' => [0x1E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1E],
        'E' => [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
        'F' => [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
        'G' => [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
        'H' => [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
        'I' => [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
        'J' => [0x07, 0x02, 0x02, 0x02, 0x12, 0x12, 0x0C],
        'K' => [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
        'L' => [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
        'M' => [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
        'N' => [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
        'O' => [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
        'P' => [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
        'Q' => [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
        'R' => [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
        'S' => [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
        'T' => [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
        'U' => [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
        'V' => [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
        'W' => [0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11],
        'X' => [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
        'Y' => [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
        'Z' => [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
        '0' => [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
        '1' => [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
        '2' => [0x0E, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1F],
        '3' => [0x1F, 0x02, 0x04, 0x06, 0x01, 0x11, 0x0E],
        '4' => [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
        '5' => [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
        '6' => [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
        '7' => [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
        '8' => [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
        '9' => [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
        ':' => [0x00, 0x04, 0x04, 0x00, 0x04, 0x04, 0x00],
        '-' => [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
        '.' => [0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0x06],
        '/' => [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
        '%' => [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
        '!' => [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
        _ => [0x00; 7],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use aphrody_nie_formats::menu_presentation::{parse_scene, scene_json};

    #[test]
    fn spatial_navigation_traverses_title_menu_rows_and_banners() {
        let json = scene_json("title-menu").expect("title-menu embedded");
        let scene = parse_scene(&json).expect("valid scene");
        assert_eq!(scene.controls.len(), 13);

        // Depuis Mode Histoire (`1`), aller à droite mène à Mode Chronique (`2`).
        let right = navigate_spatial(&scene.controls, Some("1"), 1.0, 0.0);
        assert_eq!(right.as_deref(), Some("2"));

        // Descendre depuis la rangée centrale atteint la rangée basse (`6` Guide joueur / `5` Options).
        let down = navigate_spatial(&scene.controls, Some("7"), 0.0, 1.0);
        assert!(matches!(down.as_deref(), Some("6" | "5" | "8")));

        // Monter depuis la droite de la rangée centrale atteint les bannières Équipe / Avatar.
        let up = navigate_spatial(&scene.controls, Some("10"), 0.0, -1.0);
        assert!(matches!(up.as_deref(), Some("avatar" | "team")));
    }

    #[test]
    fn parse_tex_info_extracts_named_regions() {
        let sample = r#"{
            "path": "data/dx11/menu/50_title/title00/title00_07/title00_07.g4tx",
            "count": 1,
            "textures": [{
                "name": "title00_07",
                "width": 1024,
                "height": 1024,
                "regionsDetail": [
                    { "name": "btn_base01_off", "x": 10, "y": 20, "width": 164, "height": 228 },
                    { "name": "btn_base01_msk", "x": 200, "y": 20, "width": 164, "height": 228 }
                ]
            }]
        }"#;
        let map = parse_tex_info_regions(sample).expect("parse regions");
        assert_eq!(map["btn_base01_off"].width, 164);
        assert_eq!(map["btn_base01_msk"].x, 200);
        assert_eq!(map["title00_07"].width, 1024);
    }
}
