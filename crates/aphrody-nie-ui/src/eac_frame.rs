//! Rendu fidèle de la fenêtre de démarrage `EACLauncher.exe` sur le canevas plein écran.
//!
//! Utilise la vraie image `EasyAntiCheat/SplashScreen.png`, les identifiants de
//! `EasyAntiCheat/Settings.json` (`title: "INAZUMA ELEVEN: Victory Road"`,
//! `productid: "da518e53730f4be6acbac5ebf75745e0"`) et les états officiels de
//! `EasyAntiCheat/Localization/fr_fr.cfg` (`INITIALIZING`, `LOADING`, `WAITING FOR GAME`).

use crate::compositor::{
    SceneCompositor, fill_rect_alpha, fill_solid, stroke_rect_alpha,
};

/// Clé d'atlas réservée dans [`SceneCompositor`] pour `EasyAntiCheat/SplashScreen.png`.
pub const EAC_SPLASH_KEY: &str = "EasyAntiCheat/SplashScreen.png";

/// Titre produit exact lu dans `EasyAntiCheat/Settings.json`.
pub const EAC_PRODUCT_TITLE: &str = "INAZUMA ELEVEN: Victory Road";

/// Identifiant produit EOS/EAC exact lu dans `EasyAntiCheat/Settings.json`.
pub const EAC_PRODUCT_ID: &str = "da518e53730f4be6acbac5ebf75745e0";

/// États du bootstrapper `EACLauncher.exe` tels que définis dans `Localization/fr_fr.cfg`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EacBootStage {
    /// `LAUNCHER_STATE_INITIALIZING`
    Initializing,
    /// `LAUNCHER_STATE_LOADING`
    Loading,
    /// `LAUNCHER_STATE_WAITING_FOR_GAME`
    WaitingForGame,
}

impl EacBootStage {
    /// Chaîne exacte issue de `EasyAntiCheat/Localization/fr_fr.cfg`.
    #[must_use]
    pub const fn status_label(self) -> &'static str {
        match self {
            Self::Initializing => "INITIALIZING...",
            Self::Loading => "LOADING...",
            Self::WaitingForGame => "WAITING FOR GAME...",
        }
    }

    /// Sélectionne l'étape EAC à partir de la progression réelle `[0.0, 1.0]`.
    #[must_use]
    pub fn from_progress(progress: f32) -> Self {
        if progress < 0.20 {
            Self::Initializing
        } else if progress < 0.92 {
            Self::Loading
        } else {
            Self::WaitingForGame
        }
    }
}

/// Peint la fenêtre `EACLauncher.exe` centrée sur le canevas `w x h` sans aucun élément DOM/HTML.
pub fn render_eac_launcher(
    compositor: &SceneCompositor,
    progress: f32,
    loaded_assets: usize,
    total_assets: usize,
    canvas: &mut [u8],
    w: u32,
    h: u32,
) {
    if w == 0 || h == 0 || canvas.len() < (w as usize) * (h as usize) * 4 {
        return;
    }
    fill_solid(canvas, [5, 7, 12, 255]);

    let win_w = ((w as i32) * 62 / 100).clamp(520, 800);
    let win_h = (win_w * 9 / 16).clamp(300, 450);
    let wx = (w as i32 - win_w) / 2;
    let wy = (h as i32 - win_h) / 2;

    // Ombre portée de la fenêtre native EACLauncher.
    fill_rect_alpha(
        canvas,
        w,
        h,
        wx + 10,
        wy + 14,
        win_w,
        win_h,
        [0, 0, 0, 180],
    );
    fill_rect_alpha(canvas, w, h, wx, wy, win_w, win_h, [13, 19, 30, 255]);

    // Blit de la vraie texture `EasyAntiCheat/SplashScreen.png` dès qu'elle est disponible.
    let _ = compositor.blit_named_region(
        EAC_SPLASH_KEY,
        "SplashScreen",
        wx,
        wy,
        win_w as u32,
        win_h as u32,
        255,
        canvas,
        w,
        h,
    );

    // Bandeau inférieur officiel Easy Anti-Cheat (statut + barre de progression cyan).
    let bar_zone_h = 68;
    let by = wy + win_h - bar_zone_h;
    fill_rect_alpha(canvas, w, h, wx, by, win_w, bar_zone_h, [8, 12, 20, 226]);

    // Logo / badge vectoriel EAC (bouclier bleu/cyan) à gauche du bandeau.
    let bx = wx + 20;
    let shield_y = by + 14;
    fill_rect_alpha(canvas, w, h, bx, shield_y, 28, 30, [0, 168, 232, 255]);
    fill_rect_alpha(
        canvas,
        w,
        h,
        bx + 4,
        shield_y + 4,
        20,
        22,
        [10, 22, 38, 255],
    );
    fill_rect_alpha(
        canvas,
        w,
        h,
        bx + 8,
        shield_y + 9,
        12,
        12,
        [46, 229, 255, 255],
    );

    let clamped = progress.clamp(0.02, 1.0);
    let stage = EacBootStage::from_progress(clamped);

    let _ = compositor.draw_text_height(
        EAC_PRODUCT_TITLE,
        bx + 40,
        by + 11,
        15.0,
        [235, 242, 252, 255],
        true,
        canvas,
        w,
        h,
    );

    let pct = (clamped * 100.0).round() as u32;
    let status = if total_assets > 0 {
        format!(
            "{}  {}/{} ({pct}%)",
            stage.status_label(),
            loaded_assets.min(total_assets),
            total_assets
        )
    } else {
        stage.status_label().to_owned()
    };
    let _ = compositor.draw_text_height(
        &status,
        bx + 40,
        by + 32,
        12.0,
        [126, 208, 248, 255],
        false,
        canvas,
        w,
        h,
    );

    // Piste et jauge de progression EAC en bas de la fenêtre.
    let track_h = 6;
    let track_y = wy + win_h - track_h;
    fill_rect_alpha(canvas, w, h, wx, track_y, win_w, track_h, [22, 34, 52, 255]);
    let fill_w = ((win_w as f32) * clamped).round() as i32;
    fill_rect_alpha(
        canvas,
        w,
        h,
        wx,
        track_y,
        fill_w.clamp(4, win_w),
        track_h,
        [0, 186, 255, 255],
    );

    stroke_rect_alpha(
        canvas,
        w,
        h,
        wx,
        wy,
        win_w,
        win_h,
        1,
        [52, 92, 136, 220],
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eac_stages_follow_progress_monotonically() {
        assert_eq!(EacBootStage::from_progress(0.0), EacBootStage::Initializing);
        assert_eq!(EacBootStage::from_progress(0.5), EacBootStage::Loading);
        assert_eq!(
            EacBootStage::from_progress(0.96),
            EacBootStage::WaitingForGame
        );
    }

    #[test]
    fn eac_frame_renders_non_blank_window_without_html() {
        let comp = SceneCompositor::new();
        let mut buf = vec![0u8; 320 * 180 * 4];
        render_eac_launcher(&comp, 0.45, 5, 11, &mut buf, 320, 180);
        let cyan_pixels = buf
            .chunks_exact(4)
            .filter(|px| px[2] > 200 && px[1] > 150 && px[0] < 32)
            .count();
        assert!(cyan_pixels > 20, "progress bar must be painted in RGBA");
    }
}
