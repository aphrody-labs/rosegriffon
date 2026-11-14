//! Moteur de mise en page NIE basé sur `taffy` (`taffy::TaffyTree` + `taffy::Style`).
//!
//! Remplace les calculs manuels de coordonnées (`eac_frame`, `match_hud`, `gamepad_glyphs`,
//! `compositor`, `aphrody-nie-editor`) par un arbre flexbox/grille `taffy` déterministe.

use taffy::prelude::*;

/// Rectangle calculé par `taffy` en coordonnées absolues du canevas (pixels).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LayoutRect {
    /// Abscisse du bord gauche (px).
    pub x: f32,
    /// Ordonnée du bord supérieur (px).
    pub y: f32,
    /// Largeur calculée (px).
    pub width: f32,
    /// Hauteur calculée (px).
    pub height: f32,
}

impl LayoutRect {
    /// Abscisse arrondie en `i32`.
    #[must_use]
    pub fn ix(self) -> i32 {
        self.x.round() as i32
    }

    /// Ordonnée arrondie en `i32`.
    #[must_use]
    pub fn iy(self) -> i32 {
        self.y.round() as i32
    }

    /// Largeur arrondie en `i32`.
    #[must_use]
    pub fn iw(self) -> i32 {
        self.width.round() as i32
    }

    /// Hauteur arrondie en `i32`.
    #[must_use]
    pub fn ih(self) -> i32 {
        self.height.round() as i32
    }

    /// Largeur arrondie en `u32` (bornée à `>= 0`).
    #[must_use]
    pub fn uw(self) -> u32 {
        self.width.max(0.0).round() as u32
    }

    /// Hauteur arrondie en `u32` (bornée à `>= 0`).
    #[must_use]
    pub fn uh(self) -> u32 {
        self.height.max(0.0).round() as u32
    }
}

/// Lit la géométrie absolue d'un nœud `taffy` en remontant ses parents jusqu'à la racine.
#[must_use]
pub fn absolute_rect(tree: &TaffyTree<()>, node: NodeId) -> LayoutRect {
    let Ok(layout) = tree.layout(node) else {
        return LayoutRect {
            x: 0.0,
            y: 0.0,
            width: 0.0,
            height: 0.0,
        };
    };
    let mut x = layout.location.x;
    let mut y = layout.location.y;
    let mut cur = node;
    while let Some(parent) = tree.parent(cur) {
        if let Ok(pl) = tree.layout(parent) {
            x += pl.location.x;
            y += pl.location.y;
        }
        cur = parent;
    }
    LayoutRect {
        x,
        y,
        width: layout.size.width,
        height: layout.size.height,
    }
}

/// Géométrie complète de la fenêtre `EACLauncher.exe` calculée par `taffy`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EacLauncherLayout {
    /// Cadre principal centré de la fenêtre EAC.
    pub window: LayoutRect,
    /// Bandeau inférieur (bouclier + titre + statut).
    pub bottom_bar: LayoutRect,
    /// Badge vectoriel du bouclier EAC.
    pub shield: LayoutRect,
    /// Ligne du titre produit.
    pub title: LayoutRect,
    /// Ligne d'état / progression textuelle.
    pub status: LayoutRect,
    /// Piste de la barre de progression en bas de la fenêtre.
    pub progress_track: LayoutRect,
    /// Remplissage cyan de la barre de progression.
    pub progress_fill: LayoutRect,
}

/// Calcule la mise en page de la fenêtre `EACLauncher.exe` sur un canevas `canvas_w x canvas_h`.
#[must_use]
pub fn eac_launcher_layout(
    canvas_w: u32,
    canvas_h: u32,
    progress: f32,
) -> EacLauncherLayout {
    let cw = canvas_w as f32;
    let ch = canvas_h as f32;
    let win_w = (cw * 0.62).clamp(520.0_f32.min(cw), 800.0_f32.min(cw));
    let win_h = (win_w * 9.0 / 16.0).clamp(300.0_f32.min(ch), 450.0_f32.min(ch));
    let clamped = progress.clamp(0.02, 1.0);

    let mut tree: TaffyTree<()> = TaffyTree::new();
    let shield = tree
        .new_leaf(Style {
            size: Size {
                width: length(28.0),
                height: length(30.0),
            },
            flex_shrink: 0.0,
            ..Default::default()
        })
        .expect("taffy leaf");
    let title = tree
        .new_leaf(Style {
            size: Size {
                width: percent(1.0),
                height: length(18.0),
            },
            ..Default::default()
        })
        .expect("taffy leaf");
    let status = tree
        .new_leaf(Style {
            size: Size {
                width: percent(1.0),
                height: length(16.0),
            },
            ..Default::default()
        })
        .expect("taffy leaf");
    let text_col = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Column,
                justify_content: JustifyContent::CENTER,
                gap: Size {
                    width: length(0.0),
                    height: length(3.0),
                },
                flex_grow: 1.0,
                ..Default::default()
            },
            &[title, status],
        )
        .expect("taffy node");
    let bar_row = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Row,
                align_items: AlignItems::CENTER,
                padding: Rect {
                    left: length(20.0),
                    right: length(20.0),
                    top: length(0.0),
                    bottom: length(0.0),
                },
                gap: Size {
                    width: length(12.0),
                    height: length(0.0),
                },
                flex_grow: 1.0,
                ..Default::default()
            },
            &[shield, text_col],
        )
        .expect("taffy node");
    let progress_fill = tree
        .new_leaf(Style {
            size: Size {
                width: percent(clamped),
                height: percent(1.0),
            },
            min_size: Size {
                width: length(4.0_f32.min(win_w)),
                height: auto(),
            },
            ..Default::default()
        })
        .expect("taffy leaf");
    let progress_track = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Row,
                size: Size {
                    width: percent(1.0),
                    height: length(6.0),
                },
                ..Default::default()
            },
            &[progress_fill],
        )
        .expect("taffy node");
    let bottom_bar = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Column,
                size: Size {
                    width: percent(1.0),
                    height: length(68.0),
                },
                ..Default::default()
            },
            &[bar_row, progress_track],
        )
        .expect("taffy node");
    let window = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Column,
                justify_content: JustifyContent::FLEX_END,
                size: Size {
                    width: length(win_w),
                    height: length(win_h),
                },
                ..Default::default()
            },
            &[bottom_bar],
        )
        .expect("taffy node");
    let root = tree
        .new_with_children(
            Style {
                display: Display::Flex,
                align_items: AlignItems::CENTER,
                justify_content: JustifyContent::CENTER,
                size: Size {
                    width: length(cw),
                    height: length(ch),
                },
                ..Default::default()
            },
            &[window],
        )
        .expect("taffy root");

    tree.compute_layout(
        root,
        Size {
            width: AvailableSpace::Definite(cw),
            height: AvailableSpace::Definite(ch),
        },
    )
    .expect("taffy compute_layout");

    EacLauncherLayout {
        window: absolute_rect(&tree, window),
        bottom_bar: absolute_rect(&tree, bottom_bar),
        shield: absolute_rect(&tree, shield),
        title: absolute_rect(&tree, title),
        status: absolute_rect(&tree, status),
        progress_track: absolute_rect(&tree, progress_track),
        progress_fill: absolute_rect(&tree, progress_fill),
    }
}

/// Calcule la rangée centrée de guides de boutons via `taffy` (`FlexDirection::Row`).
#[must_use]
pub fn footer_bar_layout(canvas_w: u32, y: i32, chip_widths: &[f32]) -> Vec<LayoutRect> {
    if chip_widths.is_empty() {
        return Vec::new();
    }
    let mut tree: TaffyTree<()> = TaffyTree::new();
    let children: Vec<NodeId> = chip_widths
        .iter()
        .map(|&w| {
            tree.new_leaf(Style {
                size: Size {
                    width: length(w.max(0.0)),
                    height: length(22.0),
                },
                flex_shrink: 0.0,
                ..Default::default()
            })
            .expect("taffy chip")
        })
        .collect();
    let row = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Row,
                justify_content: JustifyContent::CENTER,
                align_items: AlignItems::CENTER,
                gap: Size {
                    width: length(16.0),
                    height: length(0.0),
                },
                size: Size {
                    width: length(canvas_w as f32),
                    height: length(24.0),
                },
                ..Default::default()
            },
            &children,
        )
        .expect("taffy footer row");
    let root = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Column,
                padding: Rect {
                    top: length(y.max(0) as f32),
                    left: length(0.0),
                    right: length(0.0),
                    bottom: length(0.0),
                },
                size: Size {
                    width: length(canvas_w as f32),
                    height: auto(),
                },
                ..Default::default()
            },
            &[row],
        )
        .expect("taffy footer root");

    tree.compute_layout(
        root,
        Size {
            width: AvailableSpace::Definite(canvas_w as f32),
            height: AvailableSpace::MaxContent,
        },
    )
    .expect("taffy compute_layout");

    children
        .into_iter()
        .map(|c| {
            let mut r = absolute_rect(&tree, c);
            if y < 0 {
                r.y += y as f32;
            }
            r
        })
        .collect()
}

/// Géométrie complète du HUD de match 3D calculée par `taffy`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MatchHudLayout {
    /// Tableau d'affichage supérieur.
    pub scoreboard: LayoutRect,
    /// Colonne du nom de l'équipe à domicile dans le tableau.
    pub scoreboard_home: LayoutRect,
    /// Score central dans le tableau.
    pub scoreboard_score: LayoutRect,
    /// Colonne du nom de l'équipe extérieure dans le tableau.
    pub scoreboard_away: LayoutRect,
    /// Horloge de match dans le tableau.
    pub scoreboard_clock: LayoutRect,
    /// Fiche du joueur contrôlé en bas à gauche.
    pub player_card: LayoutRect,
    /// Nom du joueur contrôlé.
    pub player_name: LayoutRect,
    /// Barre d'endurance.
    pub stamina_bar: LayoutRect,
    /// Barre de tension.
    pub tension_bar: LayoutRect,
    /// Mini-carte radar tactique en bas à droite.
    pub minimap: LayoutRect,
    /// Superposition Duel Focus.
    pub focus_overlay: LayoutRect,
    /// Superposition Zone de tir.
    pub zone_overlay: LayoutRect,
    /// Bannière technique Hissatsu.
    pub hissatsu_banner: LayoutRect,
    /// Bannière de but marqué.
    pub goal_banner: LayoutRect,
    /// Fenêtre de pause centrée.
    pub pause_dialog: LayoutRect,
    /// Titre « PAUSE » dans la fenêtre de pause.
    pub pause_title: LayoutRect,
    /// Les 4 boutons du menu Pause.
    pub pause_items: [LayoutRect; 4],
}

/// Calcule la mise en page du HUD de match 3D avec `taffy::TaffyTree`.
#[must_use]
pub fn match_hud_layout(
    canvas_w: u32,
    canvas_h: u32,
    score_w: f32,
    away_w: f32,
    clock_w: f32,
) -> MatchHudLayout {
    let cw = canvas_w as f32;
    let ch = canvas_h as f32;
    let mut tree: TaffyTree<()> = TaffyTree::new();

    // 1. Scoreboard (460 x 54, centered top 16)
    let sb_home = tree
        .new_leaf(Style {
            size: Size {
                width: auto(),
                height: length(20.0),
            },
            flex_grow: 1.0,
            ..Default::default()
        })
        .expect("leaf");
    let sb_score = tree
        .new_leaf(Style {
            size: Size {
                width: length(score_w.max(1.0)),
                height: length(24.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let sb_away = tree
        .new_leaf(Style {
            size: Size {
                width: length(away_w.max(1.0)),
                height: length(20.0),
            },
            flex_grow: 1.0,
            ..Default::default()
        })
        .expect("leaf");
    let sb_top_row = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Row,
                justify_content: JustifyContent::SPACE_BETWEEN,
                align_items: AlignItems::CENTER,
                size: Size {
                    width: percent(1.0),
                    height: auto(),
                },
                ..Default::default()
            },
            &[sb_home, sb_score, sb_away],
        )
        .expect("node");
    let sb_clock = tree
        .new_leaf(Style {
            size: Size {
                width: length(clock_w.max(1.0)),
                height: length(15.0),
            },
            align_self: Some(AlignSelf::CENTER),
            ..Default::default()
        })
        .expect("leaf");
    let scoreboard = tree
        .new_with_children(
            Style {
                position: Position::Absolute,
                inset: Rect {
                    top: length(16.0),
                    left: length(((cw - 460.0) * 0.5).max(0.0)),
                    right: auto(),
                    bottom: auto(),
                },
                flex_direction: FlexDirection::Column,
                justify_content: JustifyContent::SPACE_BETWEEN,
                padding: Rect {
                    left: length(18.0),
                    right: length(18.0),
                    top: length(5.0),
                    bottom: length(5.0),
                },
                size: Size {
                    width: length(460.0),
                    height: length(54.0),
                },
                ..Default::default()
            },
            &[sb_top_row, sb_clock],
        )
        .expect("node");

    // 2. Player card (bottom-left: left 24, bottom 50, size 308 x 84)
    let player_name = tree
        .new_leaf(Style {
            size: Size {
                width: length(280.0),
                height: length(18.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let stamina_bar = tree
        .new_leaf(Style {
            size: Size {
                width: length(280.0),
                height: length(10.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let tension_bar = tree
        .new_leaf(Style {
            size: Size {
                width: length(280.0),
                height: length(14.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let player_card = tree
        .new_with_children(
            Style {
                position: Position::Absolute,
                inset: Rect {
                    left: length(24.0),
                    bottom: length(50.0),
                    right: auto(),
                    top: auto(),
                },
                flex_direction: FlexDirection::Column,
                justify_content: JustifyContent::SPACE_BETWEEN,
                padding: Rect {
                    left: length(14.0),
                    right: length(14.0),
                    top: length(10.0),
                    bottom: length(14.0),
                },
                size: Size {
                    width: length(308.0),
                    height: length(84.0),
                },
                ..Default::default()
            },
            &[player_name, stamina_bar, tension_bar],
        )
        .expect("node");

    // 3. Minimap (bottom-right: right 24, bottom 50, size 216 x 132)
    let minimap = tree
        .new_leaf(Style {
            position: Position::Absolute,
            inset: Rect {
                right: length(24.0),
                bottom: length(50.0),
                left: auto(),
                top: auto(),
            },
            size: Size {
                width: length(216.0),
                height: length(132.0),
            },
            ..Default::default()
        })
        .expect("leaf");

    // 4. Contextual overlays
    let focus_overlay = tree
        .new_leaf(Style {
            position: Position::Absolute,
            inset: Rect {
                top: length(92.0),
                left: length((cw - 480.0) * 0.5),
                right: auto(),
                bottom: auto(),
            },
            size: Size {
                width: length(480.0),
                height: length(62.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let zone_overlay = tree
        .new_leaf(Style {
            position: Position::Absolute,
            inset: Rect {
                top: length(90.0),
                left: length((cw - 320.0) * 0.5),
                right: auto(),
                bottom: auto(),
            },
            size: Size {
                width: length(320.0),
                height: length(38.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let hissatsu_banner = tree
        .new_leaf(Style {
            position: Position::Absolute,
            inset: Rect {
                top: length(ch * 0.5 - 140.0),
                left: length(0.0),
                right: length(0.0),
                bottom: auto(),
            },
            size: Size {
                width: percent(1.0),
                height: length(58.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let goal_banner = tree
        .new_leaf(Style {
            position: Position::Absolute,
            inset: Rect {
                top: length(ch * 0.5 - 46.0),
                left: length(0.0),
                right: length(0.0),
                bottom: auto(),
            },
            size: Size {
                width: percent(1.0),
                height: length(92.0),
            },
            ..Default::default()
        })
        .expect("leaf");

    // 5. Pause dialog (460 x 310 centered)
    let pause_title = tree
        .new_leaf(Style {
            size: Size {
                width: percent(1.0),
                height: length(34.0),
            },
            margin: Rect {
                bottom: length(10.0),
                left: length(4.0),
                right: length(0.0),
                top: length(0.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let p0 = tree
        .new_leaf(Style {
            size: Size {
                width: percent(1.0),
                height: length(40.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let p1 = tree
        .new_leaf(Style {
            size: Size {
                width: percent(1.0),
                height: length(40.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let p2 = tree
        .new_leaf(Style {
            size: Size {
                width: percent(1.0),
                height: length(40.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let p3 = tree
        .new_leaf(Style {
            size: Size {
                width: percent(1.0),
                height: length(40.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let pause_dialog = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Column,
                gap: Size {
                    width: length(0.0),
                    height: length(10.0),
                },
                padding: Rect {
                    left: length(28.0),
                    right: length(28.0),
                    top: length(24.0),
                    bottom: length(24.0),
                },
                size: Size {
                    width: length(460.0),
                    height: length(310.0),
                },
                ..Default::default()
            },
            &[pause_title, p0, p1, p2, p3],
        )
        .expect("node");

    let root = tree
        .new_with_children(
            Style {
                display: Display::Flex,
                align_items: AlignItems::CENTER,
                justify_content: JustifyContent::CENTER,
                size: Size {
                    width: length(cw),
                    height: length(ch),
                },
                ..Default::default()
            },
            &[
                scoreboard,
                player_card,
                minimap,
                focus_overlay,
                zone_overlay,
                hissatsu_banner,
                goal_banner,
                pause_dialog,
            ],
        )
        .expect("root");

    tree.compute_layout(
        root,
        Size {
            width: AvailableSpace::Definite(cw),
            height: AvailableSpace::Definite(ch),
        },
    )
    .expect("taffy compute_layout");

    MatchHudLayout {
        scoreboard: absolute_rect(&tree, scoreboard),
        scoreboard_home: absolute_rect(&tree, sb_home),
        scoreboard_score: absolute_rect(&tree, sb_score),
        scoreboard_away: absolute_rect(&tree, sb_away),
        scoreboard_clock: absolute_rect(&tree, sb_clock),
        player_card: absolute_rect(&tree, player_card),
        player_name: absolute_rect(&tree, player_name),
        stamina_bar: absolute_rect(&tree, stamina_bar),
        tension_bar: absolute_rect(&tree, tension_bar),
        minimap: absolute_rect(&tree, minimap),
        focus_overlay: absolute_rect(&tree, focus_overlay),
        zone_overlay: absolute_rect(&tree, zone_overlay),
        hissatsu_banner: absolute_rect(&tree, hissatsu_banner),
        goal_banner: absolute_rect(&tree, goal_banner),
        pause_dialog: absolute_rect(&tree, pause_dialog),
        pause_title: absolute_rect(&tree, pause_title),
        pause_items: [
            absolute_rect(&tree, p0),
            absolute_rect(&tree, p1),
            absolute_rect(&tree, p2),
            absolute_rect(&tree, p3),
        ],
    }
}

/// Mise en page d'une fenêtre d'éditeur 3D (barre d'outils + panneau latéral + viewport) via `taffy`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EditorLayout {
    /// Barre d'outils supérieure.
    pub toolbar: LayoutRect,
    /// Panneau latéral de hiérarchie / inspecteur.
    pub sidebar: LayoutRect,
    /// Zone centrale du viewport 3D GPU.
    pub viewport: LayoutRect,
}

/// Calcule les zones de l'éditeur 3D (`aphrody-nie-editor`) via `taffy::TaffyTree`.
#[must_use]
pub fn editor_layout(total_w: f32, total_h: f32, toolbar_h: f32, sidebar_w: f32) -> EditorLayout {
    let mut tree: TaffyTree<()> = TaffyTree::new();
    let toolbar = tree
        .new_leaf(Style {
            size: Size {
                width: percent(1.0),
                height: length(toolbar_h.max(0.0)),
            },
            flex_shrink: 0.0,
            ..Default::default()
        })
        .expect("leaf");
    let sidebar = tree
        .new_leaf(Style {
            size: Size {
                width: length(sidebar_w.max(0.0)),
                height: percent(1.0),
            },
            flex_shrink: 0.0,
            ..Default::default()
        })
        .expect("leaf");
    let viewport = tree
        .new_leaf(Style {
            flex_grow: 1.0,
            size: Size {
                width: auto(),
                height: percent(1.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let body = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Row,
                flex_grow: 1.0,
                size: Size {
                    width: percent(1.0),
                    height: auto(),
                },
                ..Default::default()
            },
            &[sidebar, viewport],
        )
        .expect("node");
    let root = tree
        .new_with_children(
            Style {
                flex_direction: FlexDirection::Column,
                size: Size {
                    width: length(total_w.max(1.0)),
                    height: length(total_h.max(1.0)),
                },
                ..Default::default()
            },
            &[toolbar, body],
        )
        .expect("root");

    tree.compute_layout(
        root,
        Size {
            width: AvailableSpace::Definite(total_w.max(1.0)),
            height: AvailableSpace::Definite(total_h.max(1.0)),
        },
    )
    .expect("taffy compute_layout");

    EditorLayout {
        toolbar: absolute_rect(&tree, toolbar),
        sidebar: absolute_rect(&tree, sidebar),
        viewport: absolute_rect(&tree, viewport),
    }
}

/// Calcule le rectangle centré à ratio conservé d'une scène VFS dans un canevas via `taffy`.
#[must_use]
pub fn fit_scene_viewport(
    scene_w: u32,
    scene_h: u32,
    canvas_w: u32,
    canvas_h: u32,
) -> LayoutRect {
    let cw = canvas_w.max(1) as f32;
    let ch = canvas_h.max(1) as f32;
    let sw = scene_w.max(1) as f32;
    let sh = scene_h.max(1) as f32;
    let ratio = sw / sh;

    let mut tree: TaffyTree<()> = TaffyTree::new();
    let child = tree
        .new_leaf(Style {
            aspect_ratio: Some(ratio),
            size: Size {
                width: percent(1.0),
                height: auto(),
            },
            max_size: Size {
                width: percent(1.0),
                height: percent(1.0),
            },
            ..Default::default()
        })
        .expect("leaf");
    let root = tree
        .new_with_children(
            Style {
                display: Display::Flex,
                align_items: AlignItems::CENTER,
                justify_content: JustifyContent::CENTER,
                size: Size {
                    width: length(cw),
                    height: length(ch),
                },
                ..Default::default()
            },
            &[child],
        )
        .expect("root");

    tree.compute_layout(
        root,
        Size {
            width: AvailableSpace::Definite(cw),
            height: AvailableSpace::Definite(ch),
        },
    )
    .expect("taffy compute_layout");

    absolute_rect(&tree, child)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eac_launcher_layout_centers_window_and_pins_progress_at_bottom() {
        let l = eac_launcher_layout(1280, 720, 0.5);
        assert!((l.window.width - 793.6).abs() < 1.0);
        assert!((l.window.height - 446.4).abs() < 1.0);
        assert!(((l.window.x + l.window.width * 0.5) - 640.0).abs() < 1.0);
        assert!(((l.window.y + l.window.height * 0.5) - 360.0).abs() < 1.0);
        assert!((l.progress_track.y + l.progress_track.height - (l.window.y + l.window.height)).abs() < 0.5);
        assert!((l.progress_fill.width - l.window.width * 0.5).abs() < 1.0);
    }

    #[test]
    fn footer_bar_layout_centers_chips_with_gap() {
        let rects = footer_bar_layout(1280, 686, &[80.0, 100.0, 90.0]);
        assert_eq!(rects.len(), 3);
        assert!((rects[1].x - (rects[0].x + rects[0].width + 16.0)).abs() < 0.5);
        assert!((rects[2].x - (rects[1].x + rects[1].width + 16.0)).abs() < 0.5);
        assert!((rects[0].y - 686.0).abs() < 2.0);
    }

    #[test]
    fn match_hud_layout_places_scoreboard_card_minimap_and_pause_items() {
        let hud = match_hud_layout(1280, 720, 64.0, 90.0, 140.0);
        assert_eq!(hud.scoreboard.iw(), 460);
        assert_eq!(hud.scoreboard.iy(), 16);
        assert_eq!(hud.player_card.ix(), 24);
        assert_eq!(hud.player_card.iy(), 720 - 134);
        assert_eq!(hud.minimap.ix(), 1280 - 216 - 24);
        assert_eq!(hud.pause_dialog.iw(), 460);
        assert_eq!(hud.pause_dialog.ih(), 310);
        assert!(hud.pause_items[1].y > hud.pause_items[0].y + 40.0);
    }

    #[test]
    fn editor_layout_splits_toolbar_sidebar_and_viewport() {
        let ed = editor_layout(1280.0, 800.0, 96.0, 280.0);
        assert_eq!(ed.toolbar.ih(), 96);
        assert_eq!(ed.sidebar.iw(), 280);
        assert_eq!(ed.viewport.ix(), 280);
        assert_eq!(ed.viewport.iw(), 1000);
        assert_eq!(ed.viewport.ih(), 704);
    }

    #[test]
    fn fit_scene_viewport_preserves_aspect_ratio() {
        let r = fit_scene_viewport(1920, 1080, 1280, 720);
        assert_eq!(r.uw(), 1280);
        assert_eq!(r.uh(), 720);
    }
}
