//! Rendu **3D** d'un match : stade, buts, marquages réglementaires, et vingt-deux joueurs
//! représentés par de vrais modèles du jeu.
//!
//! Le rastériseur top-down de `aphrody_nie_runtime::render` reste la vue de référence — déterministe,
//! sans assets, c'est lui que testent les goldens. Celle-ci lui ajoute la profondeur et les vrais
//! maillages.
//!
//! # Deux sources de modèles
//!
//! - **Navigateur et tout hôte sans VFS** : [`MatchModels::from_glb`] reçoit les GLB que sert le
//!   CDN public — personnage complet assemblé (`/model-full/<code>.glb`, tête + uniforme) pour
//!   chaque équipe, et le ballon (`/model-chr/item/b000004.glb`). Aucune lecture de fichier : le
//!   module compile pour `wasm32`.
//! - **Natif avec VFS** : [`charger_modele_joueur`] et [`rendre`] (hôte `aphrody-nie-game`), qui
//!   ne trouvent dans le VFS brut que des têtes squelettées, faute du manifeste d'uniformes.
//!
//! **Un modèle par équipe est décodé**, instancié onze fois : vingt-deux décodages de textures
//! coûteraient autant de mégaoctets pour des personnages que la caméra voit de loin.

use anyhow::{Context, Result};
use aphrody_nie_render3d::glb::{self, Model};
use aphrody_nie_render3d::scene::{self, Camera, Instance, Mat4, Tri};
use aphrody_nie_runtime::{GOAL_HALF, GOAL_HEIGHT, HALF_LEN, HALF_WID, Role, World};

#[cfg(not(target_arch = "wasm32"))]
use aphrody_nie_formats::vfs::Vfs;

#[cfg(not(target_arch = "wasm32"))]
use crate::render::{H, W};

/// Chemin CDN du modèle complet de l'équipe à domicile (Raimon, `c01000010`).
pub const HOME_MODEL_PATH: &str = "/model-full/c01000010.glb";
/// Chemin CDN du modèle complet de l'équipe extérieure (`c05000010`).
pub const AWAY_MODEL_PATH: &str = "/model-full/c05000010.glb";
/// Chemin CDN du ballon de match (`b000004`).
pub const BALL_MODEL_PATH: &str = "/model-chr/item/b000004.glb";

/// Diamètre d'un ballon réglementaire (taille 5), en mètres.
const BALL_DIAMETER: f32 = 0.22;
/// Taille de référence d'un joueur, utilisée seulement si le GLB n'est pas en mètres.
const PLAYER_HEIGHT: f32 = 1.70;
/// Largeur des lignes de marquage (12 cm, maximum réglementaire).
const LINE_W: f32 = 0.12;
/// Hauteur des lignes au-dessus de la pelouse, contre le z-fighting.
const LINE_Y: f32 = 0.02;

/// Recalage d'un modèle dans le repère du terrain : mise à l'échelle uniforme, puis translation
/// qui pose ses pieds au sol et centre son emprise.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Fit {
    scale: f32,
    offset: [f32; 3],
}

/// Boîte englobante de tous les sommets d'un modèle.
fn bounds(model: &Model) -> Option<([f32; 3], [f32; 3])> {
    let mut it = model.primitives.iter().flat_map(|p| p.positions.iter());
    let first = *it.next()?;
    let (mut lo, mut hi) = (first, first);
    for p in it {
        for k in 0..3 {
            lo[k] = lo[k].min(p[k]);
            hi[k] = hi[k].max(p[k]);
        }
    }
    Some((lo, hi))
}

/// Recalage d'un joueur : les GLB du CDN sont en mètres, mais un modèle exporté en centimètres
/// (hauteur hors de `0,5..3 m`) est ramené à [`PLAYER_HEIGHT`] plutôt que d'emplir le stade.
fn fit_player(model: &Model) -> Result<Fit> {
    let (lo, hi) = bounds(model).context("modèle de joueur sans sommet")?;
    let height = hi[1] - lo[1];
    anyhow::ensure!(
        height.is_finite() && height > 0.0,
        "hauteur de modèle nulle"
    );
    let scale = if (0.5..3.0).contains(&height) {
        1.0
    } else {
        PLAYER_HEIGHT / height
    };
    Ok(Fit {
        scale,
        offset: [-(lo[0] + hi[0]) * 0.5, -lo[1], -(lo[2] + hi[2]) * 0.5],
    })
}

/// Recalage du ballon : centré sur son origine, ramené à [`BALL_DIAMETER`].
fn fit_ball(model: &Model) -> Result<Fit> {
    let (lo, hi) = bounds(model).context("modèle de ballon sans sommet")?;
    let extent = (0..3).map(|k| hi[k] - lo[k]).fold(0.0f32, f32::max);
    anyhow::ensure!(extent.is_finite() && extent > 0.0, "ballon d'étendue nulle");
    Ok(Fit {
        scale: BALL_DIAMETER / extent,
        offset: [
            -(lo[0] + hi[0]) * 0.5,
            -(lo[1] + hi[1]) * 0.5,
            -(lo[2] + hi[2]) * 0.5,
        ],
    })
}

/// Les trois modèles d'un match, décodés et recalés une fois pour toutes.
#[derive(Clone)]
pub struct MatchModels {
    home: Model,
    away: Model,
    ball: Model,
    home_fit: Fit,
    away_fit: Fit,
    ball_fit: Fit,
}

// `glb::Model` ne dérive pas `Debug` (tampons de sommets et de texels) : on n'en montre que la taille.
impl core::fmt::Debug for MatchModels {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        let n = |m: &Model| m.primitives.len();
        f.debug_struct("MatchModels")
            .field("home_primitives", &n(&self.home))
            .field("away_primitives", &n(&self.away))
            .field("ball_primitives", &n(&self.ball))
            .finish_non_exhaustive()
    }
}

impl MatchModels {
    /// Assemble les modèles déjà décodés.
    ///
    /// # Errors
    ///
    /// Rend une erreur si l'un des modèles n'a aucun sommet.
    pub fn from_models(home: Model, away: Model, ball: Model) -> Result<Self> {
        Ok(Self {
            home_fit: fit_player(&home).context("équipe à domicile")?,
            away_fit: fit_player(&away).context("équipe extérieure")?,
            ball_fit: fit_ball(&ball).context("ballon")?,
            home,
            away,
            ball,
        })
    }

    /// Décode les trois GLB servis par le CDN ([`HOME_MODEL_PATH`], [`AWAY_MODEL_PATH`],
    /// [`BALL_MODEL_PATH`]).
    ///
    /// # Errors
    ///
    /// Rend une erreur si un GLB est illisible ou vide.
    pub fn from_glb(home: &[u8], away: &[u8], ball: &[u8]) -> Result<Self> {
        Self::from_models(
            glb::parse(home).context("GLB domicile")?,
            glb::parse(away).context("GLB extérieur")?,
            glb::parse(ball).context("GLB ballon")?,
        )
    }
}

/// Angle de caméra, cyclé depuis le menu Pause.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum MatchCamera {
    /// Retransmission : depuis la tribune latérale, suit le ballon le long du terrain.
    #[default]
    Broadcast,
    /// Suivi : derrière le joueur contrôlé, dans l'axe de son attaque.
    Follow,
    /// Grand angle : tout le terrain.
    Wide,
}

impl MatchCamera {
    /// Libellé affiché par le HUD.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Broadcast => "TV",
            Self::Follow => "Suivi Pro",
            Self::Wide => "Grand Angle",
        }
    }

    /// Angle suivant dans le cycle.
    #[must_use]
    pub const fn next(self) -> Self {
        match self {
            Self::Broadcast => Self::Follow,
            Self::Follow => Self::Wide,
            Self::Wide => Self::Broadcast,
        }
    }
}

/// Quad horizontal `[x0, x1] × [z0, z1]` à la hauteur `y`, dans les deux sens d'enroulement
/// pour rester visible quel que soit le culling du rastériseur.
fn quad_h(out: &mut Vec<Tri>, x0: f32, z0: f32, x1: f32, z1: f32, y: f32, color: [u8; 3]) {
    out.push(Tri {
        p: [[x0, y, z0], [x1, y, z0], [x1, y, z1]],
        color,
    });
    out.push(Tri {
        p: [[x0, y, z0], [x1, y, z1], [x0, y, z1]],
        color,
    });
}

/// Parallélépipède aligné sur les axes (poteaux, gradins).
fn boite(out: &mut Vec<Tri>, lo: [f32; 3], hi: [f32; 3], color: [u8; 3]) {
    let [x0, y0, z0] = lo;
    let [x1, y1, z1] = hi;
    let ombre = |c: [u8; 3], k: u16| c.map(|v| (u16::from(v) * k / 100) as u8);
    // Six faces, chacune éclairée différemment pour lire le volume sans calcul de normales.
    let faces: [([[f32; 3]; 4], u16); 6] = [
        (
            [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
            100,
        ),
        ([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], 55),
        ([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], 85),
        ([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 75),
        ([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 70),
        ([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], 90),
    ];
    for (q, k) in faces {
        let c = ombre(color, k);
        out.push(Tri {
            p: [q[0], q[1], q[2]],
            color: c,
        });
        out.push(Tri {
            p: [q[0], q[2], q[3]],
            color: c,
        });
        out.push(Tri {
            p: [q[0], q[2], q[1]],
            color: c,
        });
        out.push(Tri {
            p: [q[0], q[3], q[2]],
            color: c,
        });
    }
}

/// Ligne droite de marquage entre deux points du sol `(x, z)`.
fn ligne(out: &mut Vec<Tri>, a: (f32, f32), b: (f32, f32), color: [u8; 3]) {
    let (dx, dz) = (b.0 - a.0, b.1 - a.1);
    let len = (dx * dx + dz * dz).sqrt();
    if len <= f32::EPSILON {
        return;
    }
    let (nx, nz) = (-dz / len * LINE_W * 0.5, dx / len * LINE_W * 0.5);
    let p = |x: f32, z: f32| [x, LINE_Y, z];
    let q = [
        p(a.0 + nx, a.1 + nz),
        p(b.0 + nx, b.1 + nz),
        p(b.0 - nx, b.1 - nz),
        p(a.0 - nx, a.1 - nz),
    ];
    for (i, j, k) in [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)] {
        out.push(Tri {
            p: [q[i], q[j], q[k]],
            color,
        });
    }
}

/// Arc de cercle de marquage, centre `(cx, cz)`, de `a0` à `a1` radians.
fn arc(out: &mut Vec<Tri>, c: (f32, f32), r: f32, a0: f32, a1: f32, color: [u8; 3]) {
    const SEGMENTS: usize = 32;
    for i in 0..SEGMENTS {
        let t0 = a0 + (a1 - a0) * i as f32 / SEGMENTS as f32;
        let t1 = a0 + (a1 - a0) * (i + 1) as f32 / SEGMENTS as f32;
        ligne(
            out,
            (c.0 + r * t0.cos(), c.1 + r * t0.sin()),
            (c.0 + r * t1.cos(), c.1 + r * t1.sin()),
            color,
        );
    }
}

/// Le stade : pelouse tondue, marquages réglementaires, buts avec filets, gradins.
///
/// Géométrie constante, à calculer une fois et à passer à chaque [`render_match`].
#[must_use]
pub fn stadium() -> Vec<Tri> {
    let mut t = Vec::with_capacity(4096);
    // Abords (hors des lignes) puis bandes de tonte.
    quad_h(
        &mut t,
        -HALF_LEN - 8.0,
        -HALF_WID - 6.0,
        HALF_LEN + 8.0,
        HALF_WID + 6.0,
        -0.01,
        [30, 112, 44],
    );
    const BANDES: i32 = 18;
    for i in 0..BANDES {
        let x0 = -HALF_LEN + 2.0 * HALF_LEN * (i as f32 / BANDES as f32);
        let x1 = -HALF_LEN + 2.0 * HALF_LEN * ((i + 1) as f32 / BANDES as f32);
        let c = if i % 2 == 0 {
            [38, 142, 56]
        } else {
            [46, 156, 64]
        };
        quad_h(&mut t, x0, -HALF_WID, x1, HALF_WID, 0.0, c);
    }

    // Marquages (Lois du jeu, règle 1).
    let blanc = [236, 241, 236];
    let (l, w) = (HALF_LEN, HALF_WID);
    for (a, b) in [
        ((-l, -w), (l, -w)),
        ((-l, w), (l, w)),
        ((-l, -w), (-l, w)),
        ((l, -w), (l, w)),
        ((0.0, -w), (0.0, w)),
    ] {
        ligne(&mut t, a, b, blanc);
    }
    arc(&mut t, (0.0, 0.0), 9.15, 0.0, core::f32::consts::TAU, blanc);
    arc(&mut t, (0.0, 0.0), 0.2, 0.0, core::f32::consts::TAU, blanc);
    for s in [-1.0f32, 1.0] {
        let gx = s * l;
        // Surface de réparation 16,5 m × 40,32 m, surface de but 5,5 m × 18,32 m.
        for (depth, half) in [(16.5, 20.16), (5.5, 9.16)] {
            let ix = gx - s * depth;
            ligne(&mut t, (gx, -half), (ix, -half), blanc);
            ligne(&mut t, (gx, half), (ix, half), blanc);
            ligne(&mut t, (ix, -half), (ix, half), blanc);
        }
        // Point de penalty à 11 m et arc de surface (rayon 9,15 m, hors de la surface).
        let spot = gx - s * 11.0;
        arc(&mut t, (spot, 0.0), 0.2, 0.0, core::f32::consts::TAU, blanc);
        let ouverture = (5.5f32 / 9.15).acos();
        let centre = if s > 0.0 { core::f32::consts::PI } else { 0.0 };
        arc(
            &mut t,
            (spot, 0.0),
            9.15,
            centre - ouverture,
            centre + ouverture,
            blanc,
        );
        // Arcs de coin.
        // Arcs de coin (rayon 1 m), tournés vers l'intérieur du terrain.
        for sz in [-1.0f32, 1.0] {
            let a0 = 0.0f32.atan2(-s);
            let mut a1 = (-sz).atan2(0.0);
            if a1 - a0 > core::f32::consts::PI {
                a1 -= core::f32::consts::TAU;
            } else if a0 - a1 > core::f32::consts::PI {
                a1 += core::f32::consts::TAU;
            }
            arc(&mut t, (gx, sz * w), 1.0, a0.min(a1), a0.max(a1), blanc);
        }

        // But : deux poteaux, une barre, et le filet (toit, fond, côtés) en gris translucide.
        const POTEAU: f32 = 0.06;
        const PROFONDEUR: f32 = 2.0;
        let back = gx + s * PROFONDEUR;
        for z in [-GOAL_HALF, GOAL_HALF] {
            boite(
                &mut t,
                [gx - POTEAU, 0.0, z - POTEAU],
                [gx + POTEAU, GOAL_HEIGHT, z + POTEAU],
                [245, 245, 245],
            );
        }
        boite(
            &mut t,
            [gx - POTEAU, GOAL_HEIGHT - POTEAU, -GOAL_HALF],
            [gx + POTEAU, GOAL_HEIGHT + POTEAU, GOAL_HALF],
            [245, 245, 245],
        );
        let filet = [196, 204, 212];
        let (x_in, x_out) = (gx.min(back), gx.max(back));
        quad_h(
            &mut t,
            x_in,
            -GOAL_HALF,
            x_out,
            GOAL_HALF,
            GOAL_HEIGHT,
            filet,
        );
        boite(
            &mut t,
            [back - 0.01, 0.0, -GOAL_HALF],
            [back + 0.01, GOAL_HEIGHT, GOAL_HALF],
            filet,
        );
        for z in [-GOAL_HALF, GOAL_HALF] {
            boite(
                &mut t,
                [x_in, 0.0, z - 0.01],
                [x_out, GOAL_HEIGHT, z + 0.01],
                filet,
            );
        }
    }

    // Gradins : quatre tribunes de six rangs, en marches, derrière les abords.
    const RANGS: usize = 6;
    const MARCHE: f32 = 1.6;
    const HAUTEUR: f32 = 0.9;
    let sieges = [[52, 84, 168], [196, 44, 52]];
    for r in 0..RANGS {
        let d = r as f32 * MARCHE;
        let y = (r + 1) as f32 * HAUTEUR;
        let c = sieges[r % 2];
        // Tribunes latérales.
        boite(
            &mut t,
            [-l - 8.0, 0.0, -w - 8.0 - d - MARCHE],
            [l + 8.0, y, -w - 8.0 - d],
            c,
        );
        boite(
            &mut t,
            [-l - 8.0, 0.0, w + 8.0 + d],
            [l + 8.0, y, w + 8.0 + d + MARCHE],
            c,
        );
        // Virages derrière les buts.
        boite(
            &mut t,
            [-l - 10.0 - d - MARCHE, 0.0, -w - 8.0],
            [-l - 10.0 - d, y, w + 8.0],
            c,
        );
        boite(
            &mut t,
            [l + 10.0 + d, 0.0, -w - 8.0],
            [l + 10.0 + d + MARCHE, y, w + 8.0],
            c,
        );
    }
    t
}

/// Caméra du match pour l'angle `mode`.
///
/// La retransmission se tient **hors** du terrain, haute : placée au milieu du jeu, des joueurs
/// passent devant l'objectif et remplissent l'écran.
#[must_use]
pub fn camera_for(world: &World, mode: MatchCamera, controlled: Option<usize>) -> Camera {
    let b = world.ball.pos;
    match mode {
        MatchCamera::Broadcast => {
            let cx = b.x.clamp(-HALF_LEN * 0.6, HALF_LEN * 0.6);
            Camera {
                eye: [cx, 16.0, HALF_WID + 14.0],
                target: [cx, 0.0, b.y * 0.3],
                up: [0.0, 1.0, 0.0],
                fov_y: 0.9,
            }
        }
        MatchCamera::Follow => {
            let p = controlled
                .and_then(|i| world.players.get(i))
                .map_or((b.x, b.y), |p| (p.pos.x, p.pos.y));
            Camera {
                eye: [p.0 - 14.0, 7.0, p.1 - 4.0],
                target: [p.0 + 6.0, 0.5, p.1],
                up: [0.0, 1.0, 0.0],
                fov_y: 1.0,
            }
        }
        MatchCamera::Wide => Camera {
            eye: [0.0, 62.0, HALF_WID + 38.0],
            target: [0.0, 0.0, 0.0],
            up: [0.0, 1.0, 0.0],
            fov_y: 0.95,
        },
    }
}

/// Transformation monde d'un modèle recalé : position, orientation, puis recalage.
fn placement(pos: [f32; 3], yaw: f32, fit: Fit) -> Mat4 {
    let recale = scene::mat_mul(
        &scene::mat_scale(fit.scale),
        &scene::mat_translate(fit.offset),
    );
    scene::mat_mul(
        &scene::mat_translate(pos),
        &scene::mat_mul(&scene::mat_rot_y(yaw), &recale),
    )
}

/// Marqueur au sol du joueur contrôlé : un losange jaune sous ses pieds.
fn marqueur(out: &mut Vec<Tri>, x: f32, z: f32) {
    let c = [255, 214, 40];
    let r = 0.75;
    let y = LINE_Y * 2.0;
    let p = [[x + r, y, z], [x, y, z + r], [x - r, y, z], [x, y, z - r]];
    for (i, j, k) in [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)] {
        out.push(Tri {
            p: [p[i], p[j], p[k]],
            color: c,
        });
    }
}

/// Rend le match en 3D dans une image RGBA8 `w × h`.
///
/// `stadium` est la géométrie de [`stadium`], calculée une fois par l'appelant. Le repère du
/// moteur (`z` = hauteur) est converti ici vers celui du rastériseur (`y` = hauteur).
#[must_use]
pub fn render_match(
    world: &World,
    models: &MatchModels,
    stadium: &[Tri],
    mode: MatchCamera,
    controlled: Option<usize>,
    w: u32,
    h: u32,
) -> Vec<u8> {
    let mut flat = stadium.to_vec();
    if let Some(p) = controlled.and_then(|i| world.players.get(i)) {
        marqueur(&mut flat, p.pos.x, p.pos.y);
    }

    let mut instances: Vec<Instance> = Vec::with_capacity(world.players.len() + 1);
    for p in &world.players {
        // Le joueur regarde où il court ; à l'arrêt, le but qu'il attaque (le gardien, le jeu).
        let attack = if p.team == 0 { 1.0 } else { -1.0 };
        let (dx, dz) = if p.vel.len() > 0.2 && p.role != Role::Goalkeeper {
            (p.vel.x, p.vel.y)
        } else {
            (attack, 0.0)
        };
        let (model, fit) = if p.team == 0 {
            (&models.home, models.home_fit)
        } else {
            (&models.away, models.away_fit)
        };
        instances.push(Instance {
            model,
            transform: placement([p.pos.x, 0.0, p.pos.y], dx.atan2(dz), fit),
            two_sided: false,
        });
    }
    let b = world.ball.pos;
    instances.push(Instance {
        model: &models.ball,
        transform: placement(
            [b.x, b.z.max(0.0) + BALL_DIAMETER * 0.5, b.y],
            world.time * 6.0,
            models.ball_fit,
        ),
        two_sided: false,
    });

    scene::render_scene(
        &flat,
        &instances,
        &camera_for(world, mode, controlled),
        w,
        h,
        [118, 152, 214],
        [56, 84, 140],
    )
}

// ── Hôte natif avec VFS ─────────────────────────────────────────────────────────

/// Assets d'un personnage tel que le VFS les range : quatre fichiers de même radical.
#[cfg(not(target_arch = "wasm32"))]
fn lire_personnage(vfs: &Vfs, dossier: &str, code: &str) -> Result<Model> {
    let md = vfs
        .read(&format!("{dossier}/{code}.g4md"))
        .map_err(|e| anyhow::anyhow!("{code}.g4md : {e:?}"))?;
    let mg = vfs
        .read(&format!("{dossier}/{code}.g4mg"))
        .map_err(|e| anyhow::anyhow!("{code}.g4mg : {e:?}"))?;
    let sk = vfs
        .read(&format!("{dossier}/{code}.g4sk"))
        .map_err(|e| anyhow::anyhow!("{code}.g4sk : {e:?}"))?;
    // La texture vit sous la racine de plateforme, pas sous `common/`.
    let tex_path = dossier.replacen("data/common/", "data/dx11/", 1);
    let tex = vfs
        .read(&format!("{tex_path}/{code}.g4tx"))
        .map_err(|e| anyhow::anyhow!("{code}.g4tx : {e:?}"))?;
    crate::character::build_skinned_model(&md, &mg, &sk, &tex)
}

/// Charge un modèle squeletté du VFS brut pour représenter un joueur (hôte natif).
///
/// Les seuls modèles du VFS qui portent les quatre fichiers nécessaires (`g4md` + `g4mg` +
/// `g4sk` + `g4tx`) sont sous `chr/_face/` : ce sont des TÊTES. Le personnage complet s'assemble
/// côté `aphrody-nie-model-serve` (`/model-full`), ce que [`MatchModels::from_glb`] consomme.
///
/// # Errors
///
/// Rend une erreur si aucun personnage complet n'est trouvé dans les `essais` premiers candidats.
#[cfg(not(target_arch = "wasm32"))]
pub fn charger_modele_joueur(vfs: &Vfs, essais: usize) -> Result<Model> {
    // On part des SQUELETTES : des milliers de `.g4md` pour quelques dizaines de `.g4sk`.
    let mut dossiers: Vec<String> = vfs
        .iter()
        .map(|(p, _)| p)
        .filter(|p| p.starts_with("data/common/chr/") && p.ends_with(".g4sk"))
        .filter_map(|p| p.rsplit_once('/').map(|(d, _)| d.to_string()))
        // Un JOUEUR (`c` + chiffres), pas `_animal`, `_armd` ni `_keshin`.
        .filter(|d| {
            d.rsplit('/')
                .next()
                .is_some_and(|n| n.starts_with('c') && n[1..].chars().all(|c| c.is_ascii_digit()))
        })
        .collect();
    dossiers.sort_unstable();
    dossiers.dedup();

    let mut derniere = None;
    for dossier in dossiers.iter().take(essais) {
        let Some(code) = dossier.rsplit('/').next() else {
            continue;
        };
        match lire_personnage(vfs, dossier, code) {
            Ok(m) if !m.primitives.is_empty() => return Ok(m),
            Ok(_) => {}
            Err(e) => derniere = Some(e),
        }
    }
    Err(derniere.unwrap_or_else(|| anyhow::anyhow!("aucun personnage complet dans le VFS")))
        .context("chargement d'un modèle de joueur")
}

/// Corps figuré sous une tête du VFS brut : deux quads croisés aux couleurs de l'équipe.
///
/// N'existe que pour l'hôte natif, qui ne dispose que de têtes (cf. [`charger_modele_joueur`]).
#[cfg(not(target_arch = "wasm32"))]
fn corps(x: f32, z: f32, equipe: u8) -> Vec<Tri> {
    let c = if equipe == 0 {
        [40, 110, 230]
    } else {
        [225, 60, 60]
    };
    // Épaules à 1,22 m, là où commence la boîte englobante d'une tête du jeu.
    const HAUT: f32 = 1.22;
    const DEMI: f32 = 0.28;
    vec![
        Tri {
            p: [[x - DEMI, 0.0, z], [x + DEMI, 0.0, z], [x + DEMI, HAUT, z]],
            color: c,
        },
        Tri {
            p: [[x - DEMI, 0.0, z], [x + DEMI, HAUT, z], [x - DEMI, HAUT, z]],
            color: c,
        },
        Tri {
            p: [[x, 0.0, z - DEMI], [x, 0.0, z + DEMI], [x, HAUT, z + DEMI]],
            color: c,
        },
        Tri {
            p: [[x, 0.0, z - DEMI], [x, HAUT, z + DEMI], [x, HAUT, z - DEMI]],
            color: c,
        },
    ]
}

/// Rend le match en 3D avec une tête du VFS brut par joueur (hôte natif `aphrody-nie-game`).
#[cfg(not(target_arch = "wasm32"))]
#[must_use]
pub fn rendre(world: &World, modele: &Model) -> Vec<u8> {
    let mut plats = stadium();
    for p in &world.players {
        plats.extend(corps(p.pos.x, p.pos.y, p.team));
    }
    // Les maillages du jeu sont en mètres ET à leur place dans le repère du personnage : une
    // tête occupe Y ∈ [1,22 ; 1,63]. Il suffit de les translater.
    let instances: Vec<Instance> = world
        .players
        .iter()
        .map(|p| {
            let angle = if p.team == 0 {
                0.0
            } else {
                core::f32::consts::PI
            };
            Instance {
                model: modele,
                transform: scene::mat_mul(
                    &scene::mat_translate([p.pos.x, 0.0, p.pos.y]),
                    &scene::mat_rot_y(angle),
                ),
                two_sided: false,
            }
        })
        .collect();
    scene::render_scene(
        &plats,
        &instances,
        &camera_for(world, MatchCamera::Broadcast, None),
        W as u32,
        H as u32,
        [120, 150, 210],
        [58, 86, 140],
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use aphrody_nie_render3d::glb::Primitive;

    /// Un tétraèdre de `taille` unités, base au sol à `y0`.
    fn tetra(taille: f32, y0: f32) -> Model {
        Model {
            primitives: vec![Primitive {
                positions: vec![
                    [0.0, y0, 0.0],
                    [taille * 0.4, y0, 0.0],
                    [0.0, y0, taille * 0.4],
                    [0.1, y0 + taille, 0.1],
                ],
                normals: vec![[0.0, 1.0, 0.0]; 4],
                uv: vec![[0.0, 0.0]; 4],
                indices: vec![0, 1, 3, 1, 2, 3, 2, 0, 3, 0, 2, 1],
                texture: None,
            }],
            textures: Vec::new(),
        }
    }

    fn modeles() -> MatchModels {
        MatchModels::from_models(tetra(1.7, 0.0), tetra(170.0, 5.0), tetra(30.0, -15.0)).unwrap()
    }

    #[test]
    fn les_modeles_sont_recales_au_sol_et_a_lechelle() {
        let m = modeles();
        assert_eq!(
            m.home_fit.scale, 1.0,
            "un modèle en mètres n'est pas touché"
        );
        assert_eq!(m.home_fit.offset[1], 0.0);
        assert!(
            (m.away_fit.scale * 170.0 - PLAYER_HEIGHT).abs() < 1e-4,
            "centimètres → mètres"
        );
        assert!(
            (m.away_fit.offset[1] + 5.0).abs() < 1e-5,
            "pieds ramenés au sol"
        );
        assert!((m.ball_fit.scale * 30.0 - BALL_DIAMETER).abs() < 1e-5);
    }

    #[test]
    fn un_modele_vide_est_refuse() {
        let vide = Model {
            primitives: Vec::new(),
            textures: Vec::new(),
        };
        assert!(MatchModels::from_models(vide, tetra(1.7, 0.0), tetra(1.0, 0.0)).is_err());
        assert!(MatchModels::from_glb(b"pas un glb", b"", b"").is_err());
    }

    #[test]
    fn le_stade_porte_terrain_buts_et_gradins() {
        let s = stadium();
        let max_y = s
            .iter()
            .flat_map(|t| t.p.iter())
            .fold(0.0f32, |m, p| m.max(p[1]));
        assert!(max_y > 5.0, "gradins : {max_y}");
        let poteaux = s
            .iter()
            .filter(|t| t.color == [245, 245, 245] && t.p.iter().any(|p| p[1] >= GOAL_HEIGHT))
            .count();
        assert!(poteaux > 0, "buts présents");
        let lignes = s.iter().filter(|t| t.color == [236, 241, 236]).count();
        assert!(lignes > 200, "marquages : {lignes}");
    }

    #[test]
    fn le_rendu_montre_le_terrain_et_le_cycle_de_camera_boucle() {
        let world = World::kickoff();
        let m = modeles();
        let s = stadium();
        let (w, h) = (160u32, 90u32);
        let img = render_match(&world, &m, &s, MatchCamera::Broadcast, Some(0), w, h);
        assert_eq!(img.len(), (w * h * 4) as usize);
        // Le bas de l'image est la pelouse : du vert domine.
        let i = (((h - 6) * w + w / 2) * 4) as usize;
        let (r, g, b) = (img[i], img[i + 1], img[i + 2]);
        assert!(g > r && g > b, "pelouse attendue, lu {r},{g},{b}");
        let mut c = MatchCamera::default();
        for _ in 0..3 {
            c = c.next();
        }
        assert_eq!(c, MatchCamera::Broadcast);
        assert_eq!(MatchCamera::Follow.label(), "Suivi Pro");
    }

    /// Le côté droit de l'écran est bien le but `+x` : sans cela, pousser le stick à droite
    /// enverrait le joueur vers la gauche de l'image.
    #[test]
    fn la_droite_de_lecran_est_le_but_adverse() {
        let world = World::kickoff();
        let mut s = Vec::new();
        quad_h(&mut s, 10.0, -5.0, 30.0, 5.0, 0.05, [255, 0, 0]);
        let cam = camera_for(&world, MatchCamera::Broadcast, None);
        let (w, h) = (200u32, 100u32);
        let img = scene::render_scene(&s, &[], &cam, w, h, [0, 0, 0], [0, 0, 0]);
        let mut gauche = 0;
        let mut droite = 0;
        for y in 0..h {
            for x in 0..w {
                let i = ((y * w + x) * 4) as usize;
                if img[i] > 200 && img[i + 1] < 50 {
                    if x < w / 2 {
                        gauche += 1;
                    } else {
                        droite += 1;
                    }
                }
            }
        }
        assert!(droite > gauche, "+x à droite : {gauche} / {droite}");
    }
}
