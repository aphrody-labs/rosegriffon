//! HUD de match 3D et d'exploration Open-World composé sur le canevas RGBA8.
//!
//! Combine les fenêtres/bandeaux VFS (`win04_01.g4tx`, `cmn03_03.g4tx`), la police officielle
//! `font_def`, la jauge de Tension, le radar tactique 22 joueurs, les superpositions Focus Battle /
//! Zone / Technique Hissatsu et le menu Pause piloté à la manette.

use crate::compositor::SceneCompositor;
use crate::gamepad_glyphs::{
    ControllerFamily, FooterPrompt, PromptButton, draw_footer_bar_on, draw_prompt_chip_on,
};
use crate::paint::{Painter, RasterPainter};

/// Chemin VFS de la fenêtre système d'IEVR utilisée pour les cadres HUD et le menu Pause.
pub const HUD_WIN_ASSET: &str = "data/dx11/menu/10_win/win04/win04_01/win04_01.g4tx";

/// Chemin VFS des bandeaux de boutons système d'IEVR.
pub const HUD_CMN_ASSET: &str = "data/dx11/menu/20_cmn/cmn03/cmn03_03/cmn03_03.g4tx";

/// Point joueur sur la mini-carte tactique (`nx`, `ny` normalisés dans `[-1.0, 1.0]`).
#[derive(Debug, Clone, Copy)]
pub struct MinimapDot {
    /// Abscisse normalisée sur la longueur du terrain (`-1.0..=1.0`).
    pub nx: f32,
    /// Ordonnée normalisée sur la largeur du terrain (`-1.0..=1.0`).
    pub ny: f32,
    /// Équipe (`0` = domicile, `1` = extérieur).
    pub team: u8,
    /// Indique s'il s'agit du joueur actuellement contrôlé à la manette.
    pub controlled: bool,
}

/// État complet du HUD de match consommé par [`render_match_hud`].
#[derive(Debug, Clone)]
pub struct MatchHudView<'a> {
    /// Nom de l'équipe à domicile.
    pub home_name: &'a str,
    /// Nom de l'équipe extérieure.
    pub away_name: &'a str,
    /// Score domicile.
    pub home_score: u32,
    /// Score extérieur.
    pub away_score: u32,
    /// Horloge de match en secondes écoulées.
    pub match_seconds: u32,
    /// Période (`1` = 1re mi-temps, `2` = 2de mi-temps).
    pub half: u8,
    /// Tension d'équipe domicile (`0.0..=100.0`).
    pub home_tension: f32,
    /// Tension d'équipe extérieure (`0.0..=100.0`).
    pub away_tension: f32,
    /// Nom du joueur contrôlé.
    pub controlled_player_name: &'a str,
    /// Ratio d'endurance du joueur contrôlé (`0.0..=1.0`).
    pub stamina_ratio: f32,
    /// Duel Focus actif (attaque vs défense).
    pub in_focus_duel: bool,
    /// Mode Zone ralenti devant les cages actif.
    pub in_zone: bool,
    /// Nom de la technique spéciale Hissatsu déclenchée (bannière animée).
    pub active_hissatsu: Option<&'a str>,
    /// Bannière de but marquée (`Some("BUT !")`).
    pub goal_banner: Option<&'a str>,
    /// Positions des 22 joueurs sur le radar.
    pub minimap_players: &'a [MinimapDot],
    /// Position normalisée du ballon sur le radar (`[-1, 1]`).
    pub minimap_ball: (f32, f32),
    /// Menu Pause ouvert (`btn_start`).
    pub paused: bool,
    /// Option surlignée du menu Pause (`0..4`).
    pub pause_index: usize,
    /// Libellé de la caméra active (`TV`, `Suivi Pro`, `Grand Angle`).
    pub camera_label: &'a str,
    /// Famille de manette active pour les glyphes de boutons.
    pub controller: ControllerFamily,
}

/// Peint le HUD complet d'un match 3D par-dessus le rendu `aphrody-nie-render3d`.
pub fn render_match_hud_on(
    compositor: &SceneCompositor,
    view: &MatchHudView<'_>,
    canvas: &mut dyn Painter,
) {
    let (w, h) = canvas.size();
    if w == 0 || h == 0 {
        return;
    }

    // 1. Tableau d'affichage supérieur centré (couleurs officielles Raimon Or/Bleu vs Rouge).
    let sb_w = 460i32;
    let sb_h = 54i32;
    let sb_x = (w as i32 - sb_w) / 2;
    let sb_y = 16i32;
    canvas.fill_rect(sb_x, sb_y, sb_w, sb_h, [10, 18, 34, 224]);
    let _ = compositor.blit_named_region_on(
        HUD_CMN_ASSET,
        "cmd_press_btn_base_on01",
        sb_x,
        sb_y,
        sb_w as u32,
        sb_h as u32,
        72,
        canvas,
    );
    canvas.fill_rect(sb_x, sb_y, 6, sb_h, [54, 142, 255, 255]);
    canvas.fill_rect(sb_x + sb_w - 6,
        sb_y,
        6,
        sb_h,
        [236, 72, 72, 255],
    );
    canvas.stroke_rect(sb_x,
        sb_y,
        sb_w,
        sb_h,
        1,
        [102, 168, 236, 190],
    );

    let _ = compositor.draw_text_height_on(
        view.home_name,
        sb_x + 18,
        sb_y + 9,
        17.0,
        [232, 242, 255, 255],
        true,
        canvas,
    );
    let score_txt = format!("{} - {}", view.home_score, view.away_score);
    let score_w = compositor.measure_text_height(&score_txt, 24.0);
    let _ = compositor.draw_text_height_on(
        &score_txt,
        sb_x + (sb_w - score_w) / 2,
        sb_y + 5,
        24.0,
        [255, 218, 68, 255],
        true,
        canvas,
    );
    let away_w = compositor.measure_text_height(view.away_name, 17.0);
    let _ = compositor.draw_text_height_on(
        view.away_name,
        sb_x + sb_w - away_w - 18,
        sb_y + 9,
        17.0,
        [255, 226, 226, 255],
        true,
        canvas,
    );

    let mins = view.match_seconds / 60;
    let secs = view.match_seconds % 60;
    let clock_txt = format!("MT{}  {:02}:{:02}   CAM {}", view.half, mins, secs, view.camera_label);
    let clock_w = compositor.measure_text_height(&clock_txt, 13.0);
    let _ = compositor.draw_text_height_on(
        &clock_txt,
        sb_x + (sb_w - clock_w) / 2,
        sb_y + 34,
        13.0,
        [168, 214, 255, 255],
        false,
        canvas,
    );

    // 2. Fiche du joueur contrôlé + Endurance + Jauge de Tension (bas-gauche).
    let card_x = 24i32;
    let card_y = h as i32 - 134;
    let card_w = 308i32;
    let card_h = 84i32;
    canvas.fill_rect(card_x,
        card_y,
        card_w,
        card_h,
        [10, 18, 34, 216],
    );
    canvas.stroke_rect(card_x,
        card_y,
        card_w,
        card_h,
        1,
        [82, 162, 240, 180],
    );
    let _ = compositor.draw_text_height_on(
        view.controlled_player_name,
        card_x + 14,
        card_y + 10,
        17.0,
        [255, 255, 255, 255],
        true,
        canvas,
    );

    // Barre d'endurance (PE).
    let stam = view.stamina_ratio.clamp(0.0, 1.0);
    canvas.fill_rect(card_x + 14,
        card_y + 36,
        280,
        10,
        [28, 40, 58, 255],
    );
    canvas.fill_rect(card_x + 14,
        card_y + 36,
        (280.0 * stam).round() as i32,
        10,
        [72, 224, 132, 255],
    );

    // Barre de Tension d'équipe (nécessaire aux techniques Hissatsu : seuil 40%).
    let tens = (view.home_tension / 100.0).clamp(0.0, 1.0);
    canvas.fill_rect(card_x + 14,
        card_y + 56,
        280,
        14,
        [34, 28, 18, 255],
    );
    let tens_col = if view.home_tension >= 40.0 {
        [255, 196, 36, 255]
    } else {
        [188, 128, 42, 255]
    };
    canvas.fill_rect(card_x + 14,
        card_y + 56,
        (280.0 * tens).round() as i32,
        14,
        tens_col,
    );
    let tens_label = format!("TENSION {:3.0}%", view.home_tension.clamp(0.0, 100.0));
    let _ = compositor.draw_text_height_on(
        &tens_label,
        card_x + 20,
        card_y + 56,
        12.0,
        [18, 18, 24, 255],
        false,
        canvas,
    );

    // 3. Mini-carte radar tactique (bas-droite).
    let map_w = 216i32;
    let map_h = 132i32;
    let map_x = w as i32 - map_w - 24;
    let map_y = h as i32 - map_h - 50;
    canvas.fill_rect(map_x,
        map_y,
        map_w,
        map_h,
        [16, 56, 34, 212],
    );
    canvas.stroke_rect(map_x,
        map_y,
        map_w,
        map_h,
        2,
        [220, 240, 226, 200],
    );
    canvas.fill_rect(map_x + map_w / 2,
        map_y + 2,
        1,
        map_h - 4,
        [220, 240, 226, 150],
    );
    for dot in view.minimap_players {
        let px = map_x + ((dot.nx.clamp(-1.0, 1.0) * 0.5 + 0.5) * (map_w - 12) as f32) as i32 + 6;
        let py = map_y + ((dot.ny.clamp(-1.0, 1.0) * 0.5 + 0.5) * (map_h - 12) as f32) as i32 + 6;
        let col = if dot.controlled {
            [255, 232, 64, 255]
        } else if dot.team == 0 {
            [68, 162, 255, 255]
        } else {
            [244, 78, 78, 255]
        };
        let sz = if dot.controlled { 6 } else { 4 };
        canvas.fill_rect(px - sz / 2, py - sz / 2, sz, sz, col);
    }
    let bx =
        map_x + ((view.minimap_ball.0.clamp(-1.0, 1.0) * 0.5 + 0.5) * (map_w - 12) as f32) as i32
            + 6;
    let by =
        map_y + ((view.minimap_ball.1.clamp(-1.0, 1.0) * 0.5 + 0.5) * (map_h - 12) as f32) as i32
            + 6;
    canvas.fill_rect(bx - 3, by - 3, 6, 6, [255, 255, 255, 255]);

    // 4. Superpositions contextuelles Focus Battle / Zone / Hissatsu / But.
    if view.in_focus_duel {
        let fx = (w as i32 - 480) / 2;
        let fy = 92;
        canvas.fill_rect(fx, fy, 480, 62, [14, 28, 56, 228]);
        canvas.stroke_rect(fx, fy, 480, 62, 2, [58, 214, 255, 255]);
        let _ = compositor.draw_text_height_on(
            "DUEL FOCUS",
            fx + 18,
            fy + 8,
            20.0,
            [74, 228, 255, 255],
            true,
            canvas,
        );
        let c1 = draw_prompt_chip_on(
            compositor,
            view.controller,
            PromptButton::LeftStick,
            "Esquiver",
            fx + 18,
            fy + 32,
            canvas,
        );
        let _ = draw_prompt_chip_on(
            compositor,
            view.controller,
            PromptButton::West,
            "Technique",
            fx + 34 + c1,
            fy + 32,
            canvas,
        );
    } else if view.in_zone {
        let zx = (w as i32 - 320) / 2;
        canvas.fill_rect(zx, 90, 320, 38, [48, 22, 74, 210]);
        canvas.stroke_rect(zx, 90, 320, 38, 2, [255, 214, 68, 255]);
        let _ = compositor.draw_text_height_on(
            "ZONE DE TIR ACTIVE",
            zx + 54,
            99,
            18.0,
            [255, 226, 92, 255],
            true,
            canvas,
        );
    }

    if let Some(tech) = view.active_hissatsu {
        let hy = h as i32 / 2 - 140;
        canvas.fill_rect(0, hy, w as i32, 58, [18, 32, 68, 226]);
        canvas.fill_rect(0, hy, w as i32, 3, [255, 212, 52, 255]);
        canvas.fill_rect(0, hy + 55, w as i32, 3, [255, 212, 52, 255]);
        let tw = compositor.measure_text_height(tech, 28.0);
        let _ = compositor.draw_text_height_on(
            tech,
            (w as i32 - tw) / 2,
            hy + 14,
            28.0,
            [255, 232, 92, 255],
            true,
            canvas,
        );
    }

    if let Some(goal_txt) = view.goal_banner {
        let gy = h as i32 / 2 - 46;
        canvas.fill_rect(0, gy, w as i32, 92, [12, 24, 52, 236]);
        canvas.stroke_rect(0, gy, w as i32, 92, 3, [255, 214, 64, 255]);
        let gw = compositor.measure_text_height(goal_txt, 42.0);
        let _ = compositor.draw_text_height_on(
            goal_txt,
            (w as i32 - gw) / 2,
            gy + 24,
            42.0,
            [255, 224, 72, 255],
            true,
            canvas,
        );
    }

    // 5. Barre de commandes manette en bas de l'écran.
    let prompts = [
        FooterPrompt {
            button: PromptButton::LeftStick,
            label: "Courir",
        },
        FooterPrompt {
            button: PromptButton::R2,
            label: "Sprint",
        },
        FooterPrompt {
            button: PromptButton::South,
            label: "Passe",
        },
        FooterPrompt {
            button: PromptButton::East,
            label: "Tir",
        },
        FooterPrompt {
            button: PromptButton::West,
            label: "Hissatsu",
        },
        FooterPrompt {
            button: PromptButton::L1,
            label: "Joueur",
        },
        FooterPrompt {
            button: PromptButton::Start,
            label: "Pause",
        },
    ];
    draw_footer_bar_on(
        compositor,
        view.controller,
        &prompts,
        h as i32 - 34,
        canvas,
    );

    // 6. Fenêtre Pause (`win04_01.g4tx`) si active.
    if view.paused {
        canvas.fill_rect(0, 0, w as i32, h as i32, [4, 8, 16, 178]);
        let pw = 460i32;
        let ph = 310i32;
        let px = (w as i32 - pw) / 2;
        let py = (h as i32 - ph) / 2;
        canvas.fill_rect(px, py, pw, ph, [14, 24, 44, 244]);
        let _ = compositor.blit_named_region_on(
            HUD_WIN_ASSET,
            "win_base01",
            px,
            py,
            pw as u32,
            ph as u32,
            190,
            canvas,
        );
        canvas.stroke_rect(px, py, pw, ph, 2, [96, 178, 255, 230]);
        let _ = compositor.draw_text_height_on(
            "PAUSE",
            px + 32,
            py + 24,
            26.0,
            [255, 224, 72, 255],
            true,
            canvas,
        );

        let items = [
            "Reprendre le match",
            "Changer d'angle de caméra",
            "Recommencer le coup d'envoi",
            "Retour au menu principal",
        ];
        for (idx, item) in items.iter().enumerate() {
            let iy = py + 78 + (idx as i32) * 50;
            let sel = idx == view.pause_index;
            let bg = if sel {
                [38, 108, 206, 235]
            } else {
                [22, 36, 62, 195]
            };
            canvas.fill_rect(px + 28, iy, pw - 56, 40, bg);
            if sel {
                canvas.stroke_rect(px + 28,
                    iy,
                    pw - 56,
                    40,
                    2,
                    [255, 222, 76, 255],
                );
            }
            let _ = compositor.draw_text_height_on(
                item,
                px + 46,
                iy + 10,
                18.0,
                [245, 248, 255, 255],
                true,
                canvas,
            );
        }
    }
}

/// CPU wrapper of [`render_match_hud_on`] over an RGBA8 buffer.
pub fn render_match_hud(
    compositor: &SceneCompositor,
    view: &MatchHudView<'_>,
    canvas: &mut [u8],
    w: u32,
    h: u32,
) {
    if let Some(mut p) = RasterPainter::new(canvas, w, h) {
        render_match_hud_on(compositor, view, &mut p);
    }
}
