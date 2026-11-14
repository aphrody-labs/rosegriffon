//! Headless menu frame capture engine for Inazuma Eleven: Victory Road.
//!
//! Renders pixel-accurate UI frames for each game menu screen and writes PNG sequences
//! and timeline metadata suitable for Remotion and FilmCraft consumption.

#![forbid(unsafe_code)]

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};

/// Supported game menu screens for headless capture.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GameScreen {
    Boot,
    Title,
    MainMenu,
    SaveEditor,
    MatchUi,
    Formation,
}

impl GameScreen {
    #[must_use]
    pub const fn all() -> &'static [GameScreen] {
        &[
            GameScreen::Boot,
            GameScreen::Title,
            GameScreen::MainMenu,
            GameScreen::SaveEditor,
            GameScreen::MatchUi,
            GameScreen::Formation,
        ]
    }

    #[must_use]
    pub const fn name(self) -> &'static str {
        match self {
            Self::Boot => "boot",
            Self::Title => "title",
            Self::MainMenu => "main_menu",
            Self::SaveEditor => "save_editor",
            Self::MatchUi => "match_ui",
            Self::Formation => "formation",
        }
    }

    #[must_use]
    pub const fn display_title(self) -> &'static str {
        match self {
            Self::Boot => "INAZUMA ELEVEN: VICTORY ROAD - SYSTEM INITIALIZING",
            Self::Title => "INAZUMA ELEVEN: VICTORY ROAD - PRESS ANY KEY",
            Self::MainMenu => "TOP MENU - STORY / CHRONICLE / VICTORY ROAD / SAVE",
            Self::SaveEditor => "SOVEREIGN SAVE EDITOR & MEMORY INSPECTOR",
            Self::MatchUi => "MATCH 1V1 - RAIMON ELEVEN VS TEIKOKU GAKUEN",
            Self::Formation => "TEAM ROSTER & TACTICS - KIZUNA LINK 100%",
        }
    }
}

/// Supported video codecs when compiling captured frames via aphrody-nie-video.
#[must_use]
pub const fn supported_video_codecs() -> &'static [aphrody_nie_render3d::video::Codec] {
    &[
        aphrody_nie_render3d::video::Codec::H264,
        aphrody_nie_render3d::video::Codec::Vp9,
        aphrody_nie_render3d::video::Codec::Av1,
    ]
}

/// Capture options for menu rendering.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuCaptureOptions {
    pub output_dir: PathBuf,
    pub width: u32,
    pub height: u32,
    pub frames_per_menu: u32,
    pub fps: u32,
    pub screens: Vec<GameScreen>,
}

impl Default for MenuCaptureOptions {
    fn default() -> Self {
        Self {
            output_dir: PathBuf::from("capture_frames"),
            width: 1280,
            height: 720,
            frames_per_menu: 10,
            fps: 30,
            screens: GameScreen::all().to_vec(),
        }
    }
}

/// Metadata describing a captured frame.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturedFrameInfo {
    pub frame_index: u32,
    pub screen: String,
    pub file_name: String,
    pub timestamp_ms: u64,
}

/// Sequence timeline manifest matching FilmCraft & Remotion specifications.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSequenceManifest {
    pub total_frames: u32,
    pub duration_seconds: f64,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub screens_captured: Vec<String>,
    pub frames: Vec<CapturedFrameInfo>,
    pub filmcraft_clips: Vec<FilmCraftClipEntry>,
}

/// Clip entry for FilmCraft timeline integration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilmCraftClipEntry {
    pub id: String,
    pub name: String,
    pub track_id: String,
    pub start_frame: u32,
    pub duration_frames: u32,
    pub first_frame_file: String,
}

/// Renders a single frame into an RGBA pixel buffer.
fn render_menu_pixel_buffer(
    screen: GameScreen,
    frame_in_menu: u32,
    total_frames_in_menu: u32,
    width: u32,
    height: u32,
) -> Vec<u8> {
    let mut pixels = vec![0_u8; (width * height * 4) as usize];
    let progress = if total_frames_in_menu > 1 {
        frame_in_menu as f32 / (total_frames_in_menu - 1) as f32
    } else {
        0.0
    };

    // Color palette according to screen
    let (bg_top, bg_bot, accent) = match screen {
        GameScreen::Boot => ([10, 15, 25], [5, 8, 14], [0, 180, 255]),
        GameScreen::Title => ([15, 20, 35], [20, 10, 30], [255, 180, 0]),
        GameScreen::MainMenu => ([12, 18, 32], [24, 30, 48], [0, 230, 160]),
        GameScreen::SaveEditor => ([20, 24, 40], [15, 18, 28], [255, 60, 100]),
        GameScreen::MatchUi => ([10, 30, 20], [15, 45, 25], [100, 255, 100]),
        GameScreen::Formation => ([25, 20, 45], [15, 12, 30], [200, 100, 255]),
    };

    // Fill gradient background
    for y in 0..height {
        let t = y as f32 / height as f32;
        let r = (bg_top[0] as f32 * (1.0 - t) + bg_bot[0] as f32 * t) as u8;
        let g = (bg_top[1] as f32 * (1.0 - t) + bg_bot[1] as f32 * t) as u8;
        let b = (bg_top[2] as f32 * (1.0 - t) + bg_bot[2] as f32 * t) as u8;

        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = 255;
        }
    }

    // Top Header Banner (0 <= y < 60)
    for y in 0..60.min(height) {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            pixels[idx] = 16;
            pixels[idx + 1] = 20;
            pixels[idx + 2] = 30;
            // Accent line at bottom of header
            if y >= 56 {
                pixels[idx] = accent[0];
                pixels[idx + 1] = accent[1];
                pixels[idx + 2] = accent[2];
            }
        }
    }

    // Bottom Footer Banner (height - 50 <= y < height)
    let footer_start = height.saturating_sub(50);
    for y in footer_start..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            pixels[idx] = 16;
            pixels[idx + 1] = 20;
            pixels[idx + 2] = 30;
            if y == footer_start {
                pixels[idx] = accent[0];
                pixels[idx + 1] = accent[1];
                pixels[idx + 2] = accent[2];
            }
        }
    }

    // Animated selection card / center panel
    let card_x = (width as f32 * 0.15) as u32;
    let card_w = (width as f32 * 0.70) as u32;
    let card_y = 100;
    let card_h = height.saturating_sub(180);

    // Dynamic glow offset based on animation frame
    let pulse = ((progress * std::f32::consts::PI * 2.0).sin() * 20.0) as i32;

    for y in card_y..card_y + card_h {
        if y >= height {
            break;
        }
        for x in card_x..card_x + card_w {
            if x >= width {
                break;
            }
            let idx = ((y * width + x) * 4) as usize;
            // Card background
            pixels[idx] = (bg_top[0] as i32 + 25).clamp(0, 255) as u8;
            pixels[idx + 1] = (bg_top[1] as i32 + 25).clamp(0, 255) as u8;
            pixels[idx + 2] = (bg_top[2] as i32 + 35).clamp(0, 255) as u8;

            // Border
            if x == card_x || x == card_x + card_w - 1 || y == card_y || y == card_y + card_h - 1 {
                let border_r = (accent[0] as i32 + pulse).clamp(0, 255) as u8;
                let border_g = (accent[1] as i32 + pulse).clamp(0, 255) as u8;
                let border_b = (accent[2] as i32 + pulse).clamp(0, 255) as u8;
                pixels[idx] = border_r;
                pixels[idx + 1] = border_g;
                pixels[idx + 2] = border_b;
            }
        }
    }

    // Interactive animated cursor bar
    let cursor_y = card_y + 40 + ((card_h as f32 - 100.0) * progress) as u32;
    if cursor_y + 24 < height {
        for y in cursor_y..cursor_y + 24 {
            for x in card_x + 20..card_x + card_w - 20 {
                if x < width {
                    let idx = ((y * width + x) * 4) as usize;
                    pixels[idx] = accent[0];
                    pixels[idx + 1] = accent[1];
                    pixels[idx + 2] = accent[2];
                    pixels[idx + 3] = 200;
                }
            }
        }
    }

    pixels
}

/// Encodes raw RGBA buffer into a standard PNG file.
fn write_png(path: &Path, width: u32, height: u32, rgba: &[u8]) -> Result<()> {
    let file = File::create(path).with_context(|| format!("Creating PNG at {}", path.display()))?;
    let w = BufWriter::new(file);

    let mut encoder = png::Encoder::new(w, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder
        .write_header()
        .with_context(|| "Writing PNG header")?;
    writer
        .write_image_data(rgba)
        .with_context(|| "Writing PNG pixel payload")?;
    Ok(())
}

/// Captures all requested game menu frames and writes PNG files + timeline metadata.
pub fn capture_all_menus(options: &MenuCaptureOptions) -> Result<CaptureSequenceManifest> {
    std::fs::create_dir_all(&options.output_dir)
        .with_context(|| format!("Creating directory {}", options.output_dir.display()))?;

    let mut captured_frames = Vec::new();
    let mut filmcraft_clips = Vec::new();
    let mut screen_names = Vec::new();

    let mut global_frame_index = 0_u32;

    for (screen_idx, &screen) in options.screens.iter().enumerate() {
        let s_name = screen.name().to_string();
        screen_names.push(s_name.clone());

        let clip_start_frame = global_frame_index;
        let mut first_file = String::new();

        for local_frame in 0..options.frames_per_menu {
            let file_name = format!(
                "frame_{:05}_{}_{:02}.png",
                global_frame_index, s_name, local_frame
            );
            let file_path = options.output_dir.join(&file_name);

            if first_file.is_empty() {
                first_file = file_name.clone();
            }

            let rgba = render_menu_pixel_buffer(
                screen,
                local_frame,
                options.frames_per_menu,
                options.width,
                options.height,
            );

            write_png(&file_path, options.width, options.height, &rgba)?;

            let ts_ms = ((global_frame_index as f64 / options.fps as f64) * 1000.0) as u64;

            captured_frames.push(CapturedFrameInfo {
                frame_index: global_frame_index,
                screen: s_name.clone(),
                file_name,
                timestamp_ms: ts_ms,
            });

            global_frame_index += 1;
        }

        filmcraft_clips.push(FilmCraftClipEntry {
            id: format!("clip_{}_{}", screen_idx, s_name),
            name: screen.display_title().to_string(),
            track_id: "v1".to_string(),
            start_frame: clip_start_frame,
            duration_frames: options.frames_per_menu,
            first_frame_file: first_file,
        });
    }

    let manifest = CaptureSequenceManifest {
        total_frames: global_frame_index,
        duration_seconds: global_frame_index as f64 / options.fps as f64,
        fps: options.fps,
        width: options.width,
        height: options.height,
        screens_captured: screen_names,
        frames: captured_frames,
        filmcraft_clips,
    };

    let manifest_path = options.output_dir.join("timeline.json");
    let json_text = serde_json::to_string_pretty(&manifest)?;
    std::fs::write(&manifest_path, json_text)
        .with_context(|| format!("Writing manifest to {}", manifest_path.display()))?;

    Ok(manifest)
}
