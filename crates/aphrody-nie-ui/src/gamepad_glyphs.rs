//! Glyphes de manette dynamiques (`gaiji_game.g4tx` + profils Xbox, PlayStation, Switch, Steam Deck).
//!
//! Associe les actions de `steam_action_manifest.vdf` aux icônes de boutons affichées dans les
//! barres d'aide au bas des menus et du HUD de match.

use crate::compositor::{SceneCompositor, blend_over, fill_rect_alpha, stroke_rect_alpha};

/// Chemin VFS de l'atlas d'icônes système et manette d'IEVR.
pub const GAIJI_GAME_PATH: &str = "data/dx11/font/gaiji_game.g4tx";

/// Famille matérielle de contrôleur détectée via `navigator.getGamepads()` ou choisie dans Options.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ControllerFamily {
    /// Manette Xbox (`045e`, XInput standard) : A / B / X / Y.
    #[default]
    Xbox,
    /// DualShock 4 / DualSense (`054c`) : Croix / Rond / Carré / Triangle.
    PlayStation,
    /// Nintendo Switch Pro / Joy-Con (`057e`) : B / A / Y / X.
    Switch,
    /// Valve Steam Deck (`28de`) : A / B / X / Y + L1/R1.
    SteamDeck,
    /// Clavier PC (repli quand aucune manette n'est active).
    Keyboard,
}

impl ControllerFamily {
    /// Déduit la famille à partir de l'identifiant `Gamepad.id` du navigateur.
    #[must_use]
    pub fn from_gamepad_id(id: &str) -> Self {
        let lower = id.to_ascii_lowercase();
        if lower.contains("054c")
            || lower.contains("dualsense")
            || lower.contains("dualshock")
            || lower.contains("playstation")
            || lower.contains("wireless controller")
        {
            Self::PlayStation
        } else if lower.contains("057e")
            || lower.contains("nintendo")
            || lower.contains("pro controller")
            || lower.contains("joy-con")
        {
            Self::Switch
        } else if lower.contains("28de") || lower.contains("steam") || lower.contains("neptune") {
            Self::SteamDeck
        } else if lower.contains("keyboard") {
            Self::Keyboard
        } else {
            Self::Xbox
        }
    }
}

/// Bouton logique correspondant aux entrées de `steam_action_manifest.vdf`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PromptButton {
    /// `btn_a` (Sud : Valider / Passe).
    South,
    /// `btn_b` (Est : Retour / Tir).
    East,
    /// `btn_x` (Ouest : Technique 1 / Sous-action).
    West,
    /// `btn_y` (Nord : Technique 2 / Détails).
    North,
    /// `btn_left_trigger1` (L1 / LB).
    L1,
    /// `btn_right_trigger1` (R1 / RB).
    R1,
    /// `btn_right_trigger2` (R2 / RT : Sprint).
    R2,
    /// `btn_start` (Menu / Pause).
    Start,
    /// `btn_select` (Affichage / Plein écran).
    Select,
    /// `left_stick` (Déplacement).
    LeftStick,
    /// `btn_arrow_*` (Navigation).
    Dpad,
}

/// Entrée d'une barre de commandes au bas d'un écran (`[(PromptButton, libellé)]`).
#[derive(Debug, Clone, Copy)]
pub struct FooterPrompt<'a> {
    /// Bouton affiché.
    pub button: PromptButton,
    /// Action localisée en français.
    pub label: &'a str,
}

/// Dessine une rangée de guides de boutons alignée à droite ou centrée dans un bandeau inférieur.
#[allow(clippy::too_many_arguments)]
pub fn draw_footer_bar(
    compositor: &SceneCompositor,
    family: ControllerFamily,
    prompts: &[FooterPrompt<'_>],
    y: i32,
    canvas: &mut [u8],
    w: u32,
    h: u32,
) {
    if prompts.is_empty() || w == 0 || h == 0 {
        return;
    }
    fill_rect_alpha(canvas, w, h, 0, y - 6, w as i32, 40, [8, 13, 24, 196]);
    stroke_rect_alpha(canvas, w, h, 0, y - 6, w as i32, 1, 1, [70, 128, 190, 140]);

    let mut total_w = 0i32;
    for p in prompts {
        total_w += 30 + compositor.measure_text_height(p.label, 16.0) + 26;
    }
    let mut cx = ((w as i32) - total_w - 28).max(24);
    for p in prompts {
        cx += draw_prompt_chip(compositor, family, p.button, p.label, cx, y, canvas, w, h) + 22;
    }
}

/// Dessine une puce de bouton + son texte d'action et retourne la largeur occupée (px).
#[allow(clippy::too_many_arguments)]
pub fn draw_prompt_chip(
    compositor: &SceneCompositor,
    family: ControllerFamily,
    button: PromptButton,
    label: &str,
    x: i32,
    y: i32,
    canvas: &mut [u8],
    w: u32,
    h: u32,
) -> i32 {
    let icon_size = 26i32;
    let gaiji_candidates = gaiji_region_candidates(family, button);
    let mut blitted = false;
    for reg in gaiji_candidates {
        if compositor
            .atlas(GAIJI_GAME_PATH)
            .is_some_and(|a| a.regions.contains_key(*reg))
            && compositor.blit_named_region(
                GAIJI_GAME_PATH,
                reg,
                x,
                y,
                icon_size as u32,
                icon_size as u32,
                255,
                canvas,
                w,
                h,
            )
        {
            blitted = true;
            break;
        }
    }
    if !blitted {
        draw_vector_button_badge(compositor, family, button, x, y, icon_size, canvas, w, h);
    }
    let text_w = compositor.draw_text_height(
        label,
        x + icon_size + 7,
        y + 4,
        16.0,
        [238, 244, 255, 255],
        true,
        canvas,
        w,
        h,
    );
    icon_size + 7 + text_w
}

fn gaiji_region_candidates(
    family: ControllerFamily,
    button: PromptButton,
) -> &'static [&'static str] {
    match (family, button) {
        (ControllerFamily::PlayStation, PromptButton::South) => &["gaiji_ps5_01", "gaiji_ps4_01"],
        (ControllerFamily::PlayStation, PromptButton::East) => &["gaiji_ps5_00", "gaiji_ps4_00"],
        (ControllerFamily::PlayStation, PromptButton::West) => &["gaiji_ps5_02", "gaiji_ps4_02"],
        (ControllerFamily::PlayStation, PromptButton::North) => &["gaiji_ps5_03", "gaiji_ps4_03"],
        (ControllerFamily::Switch, PromptButton::South) => &["gaiji_nx_01"],
        (ControllerFamily::Switch, PromptButton::East) => &["gaiji_nx_00"],
        (ControllerFamily::Switch, PromptButton::West) => &["gaiji_nx_03"],
        (ControllerFamily::Switch, PromptButton::North) => &["gaiji_nx_02"],
        (_, PromptButton::South) => &["gaiji_xbox_00"],
        (_, PromptButton::East) => &["gaiji_xbox_01"],
        (_, PromptButton::West) => &["gaiji_xbox_02"],
        (_, PromptButton::North) => &["gaiji_xbox_03"],
        (_, _) => &[],
    }
}

#[allow(clippy::too_many_arguments)]
fn draw_vector_button_badge(
    compositor: &SceneCompositor,
    family: ControllerFamily,
    button: PromptButton,
    x: i32,
    y: i32,
    size: i32,
    canvas: &mut [u8],
    w: u32,
    h: u32,
) {
    let (bg, short_txt) = match (family, button) {
        (ControllerFamily::PlayStation, PromptButton::South) => ([42, 108, 224, 255], "X"),
        (ControllerFamily::PlayStation, PromptButton::East) => ([218, 66, 72, 255], "O"),
        (ControllerFamily::PlayStation, PromptButton::West) => ([198, 88, 188, 255], "[]"),
        (ControllerFamily::PlayStation, PromptButton::North) => ([40, 178, 134, 255], "/\\"),
        (ControllerFamily::Switch, PromptButton::South) => ([220, 170, 32, 255], "B"),
        (ControllerFamily::Switch, PromptButton::East) => ([218, 64, 64, 255], "A"),
        (ControllerFamily::Switch, PromptButton::West) => ([46, 162, 90, 255], "Y"),
        (ControllerFamily::Switch, PromptButton::North) => ([48, 126, 222, 255], "X"),
        (ControllerFamily::Keyboard, PromptButton::South) => ([58, 76, 106, 255], "ENT"),
        (ControllerFamily::Keyboard, PromptButton::East) => ([58, 76, 106, 255], "ESC"),
        (ControllerFamily::Keyboard, PromptButton::West) => ([58, 76, 106, 255], "X"),
        (ControllerFamily::Keyboard, PromptButton::North) => ([58, 76, 106, 255], "Y"),
        (_, PromptButton::South) => ([44, 168, 74, 255], "A"),
        (_, PromptButton::East) => ([214, 62, 62, 255], "B"),
        (_, PromptButton::West) => ([44, 122, 224, 255], "X"),
        (_, PromptButton::North) => ([222, 166, 30, 255], "Y"),
        (_, PromptButton::L1) => ([52, 68, 94, 255], "L1"),
        (_, PromptButton::R1) => ([52, 68, 94, 255], "R1"),
        (_, PromptButton::R2) => ([52, 68, 94, 255], "R2"),
        (_, PromptButton::Start) => ([52, 68, 94, 255], "ST"),
        (_, PromptButton::Select) => ([52, 68, 94, 255], "SEL"),
        (_, PromptButton::LeftStick) => ([44, 88, 136, 255], "LS"),
        (_, PromptButton::Dpad) => ([44, 88, 136, 255], "+"),
    };

    let is_pill = matches!(
        button,
        PromptButton::L1
            | PromptButton::R1
            | PromptButton::R2
            | PromptButton::Start
            | PromptButton::Select
    ) || family == ControllerFamily::Keyboard;

    if is_pill {
        fill_rect_alpha(canvas, w, h, x, y + 3, size + 2, size - 6, bg);
        stroke_rect_alpha(
            canvas,
            w,
            h,
            x,
            y + 3,
            size + 2,
            size - 6,
            1,
            [230, 240, 255, 220],
        );
    } else {
        draw_filled_disc(
            canvas,
            w,
            h,
            x as f32 + size as f32 * 0.5,
            y as f32 + size as f32 * 0.5,
            size as f32 * 0.48,
            bg,
        );
    }

    let tw = compositor.measure_text_height(short_txt, 12.0);
    let tx = x + ((size - tw) / 2).max(2);
    let _ = compositor.draw_text_height(
        short_txt,
        tx,
        y + 6,
        12.0,
        [255, 255, 255, 255],
        false,
        canvas,
        w,
        h,
    );
}

fn draw_filled_disc(
    canvas: &mut [u8],
    w: u32,
    h: u32,
    cx: f32,
    cy: f32,
    radius: f32,
    color: [u8; 4],
) {
    let x0 = ((cx - radius - 1.0).floor() as i32).max(0);
    let y0 = ((cy - radius - 1.0).floor() as i32).max(0);
    let x1 = ((cx + radius + 1.0).ceil() as i32).min(w as i32 - 1);
    let y1 = ((cy + radius + 1.0).ceil() as i32).min(h as i32 - 1);
    for py in y0..=y1 {
        let row = (py as usize) * (w as usize) * 4;
        for px in x0..=x1 {
            let dx = (px as f32 + 0.5) - cx;
            let dy = (py as f32 + 0.5) - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist <= radius + 0.6 {
                let edge = (radius + 0.6 - dist).clamp(0.0, 1.0);
                let a = (f32::from(color[3]) * edge).round() as u8;
                let off = row + (px as usize) * 4;
                blend_over(&mut canvas[off..off + 4], [color[0], color[1], color[2], a]);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gamepad_id_classification_detects_all_major_vendors() {
        assert_eq!(
            ControllerFamily::from_gamepad_id("DualSense Wireless Controller (Vendor: 054c Product: 0ce6)"),
            ControllerFamily::PlayStation
        );
        assert_eq!(
            ControllerFamily::from_gamepad_id("Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)"),
            ControllerFamily::Switch
        );
        assert_eq!(
            ControllerFamily::from_gamepad_id("Steam Virtual Gamepad (Vendor: 28de)"),
            ControllerFamily::SteamDeck
        );
        assert_eq!(
            ControllerFamily::from_gamepad_id("Xbox 360 Controller (XInput STANDARD GAMEPAD)"),
            ControllerFamily::Xbox
        );
    }
}
