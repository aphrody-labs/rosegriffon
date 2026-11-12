//! `NieClientRuntime` : le client plein écran, de `EACLauncher.exe` au coup d'envoi.
//!
//! Une seule machine à états possède l'écran entier ; l'hôte JavaScript ne fait que trois choses,
//! sans aucun élément DOM visible :
//!
//! 1. **Transporter des octets.** [`NieClientRuntime::poll_asset_requests`] rend la liste JSON des
//!    URL à télécharger sur le CDN public (`/tex`, `/tex-info`, `/ui/font-metrics.json`,
//!    `/audio-info`, `/model-full`, `/model-chr`, `/static/nie/boot/`). L'hôte rend chaque réponse
//!    par [`NieClientRuntime::provide_asset`] ou signale l'échec par
//!    [`NieClientRuntime::asset_failed`]. Aucune route `/vfs` ni `/raw` n'est jamais demandée.
//! 2. **Jouer les médias.** [`NieClientRuntime::poll_media_commands`] rend les ordres audio
//!    (musique de titre réelle, `bgm_title.acb` / cue `bg00010`) et vidéo (logos de démarrage).
//! 3. **Recopier la manette et l'image.** [`NieClientRuntime::set_gamepad`] reçoit
//!    `Gamepad.buttons[i].value` et `Gamepad.axes` ; [`NieClientRuntime::render_into`] remplit le
//!    tampon RGBA8 d'un `ImageData` plein écran.
//!
//! Enchaînement : lanceur EAC (progression = assets réellement reçus) → logos (vidéos natives) →
//! écran de chargement (`loading`) → avis de sauvegarde automatique (`autosave`) → écran-titre
//! (`start`) → menu principal `title_menu_2` (`title-menu`, 13 entrées, navigation spatiale) →
//! match 3D (`aphrody-nie-runtime::session` + `aphrody-nie-app::match3d` + HUD).

use std::collections::BTreeMap;

use aphrody_nie_app::input::{GamepadState, Key, PadButton, pad_button_for_key};
use aphrody_nie_app::match3d::{
    self, AWAY_MODEL_PATH, BALL_MODEL_PATH, HOME_MODEL_PATH, MatchCamera, MatchModels,
};
use aphrody_nie_formats::menu_presentation::{Scene, parse_scene, scene_json};
use aphrody_nie_render3d::scene::Tri;
use aphrody_nie_runtime::session::{HissatsuKind, MatchEvent, MatchPhase, MatchSession};
use aphrody_nie_runtime::{HALF_LEN, HALF_WID};
use aphrody_nie_ui::compositor::{SceneCompositor, fill_solid, navigate_spatial};
use aphrody_nie_ui::eac_frame::{EAC_SPLASH_KEY, render_eac_launcher};
use aphrody_nie_ui::gamepad_glyphs::{
    ControllerFamily, FooterPrompt, GAIJI_GAME_PATH, PromptButton, draw_footer_bar,
};
use aphrody_nie_ui::match_hud::{
    HUD_CMN_ASSET, HUD_WIN_ASSET, MatchHudView, MinimapDot, render_match_hud,
};
use serde::Serialize;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

/// CDN public dérivé, seule origine des assets du client.
pub const DEFAULT_CDN_BASE: &str = "https://cdn.rosegriffon.fr";
/// Clé VFS de l'atlas `font_def` (reconnue par [`SceneCompositor::insert_png`]).
const FONT_KEY: &str = "data/dx11/font/font_def/font.g4tx";
/// Banque de la musique de titre et son cue natif (`aphrody_nie_explore::menu_audio`).
const TITLE_BANK: &str = "data/common/sound_asset/bgm_title.acb";
const TITLE_CUE: &str = "bg00010";
/// Vidéos de démarrage, posées hors CPK dans le jeu (`L5logo.usm`, `IE_15th.usm`) et servies
/// transcodées sous `/static/nie/boot/`.
pub const BOOT_VIDEOS: [&str; 2] = ["L5logo", "IE_15th"];
/// Garde-fou d'une vidéo de démarrage que l'hôte ne signalerait jamais terminée.
const BOOT_VIDEO_TIMEOUT_S: f32 = 20.0;
/// Durée minimale de la fenêtre EAC une fois tout reçu (l'état `WAITING FOR GAME...`).
const EAC_HANDOFF_S: f32 = 1.2;
/// Durée minimale de l'écran de chargement.
const LOADING_MIN_S: f32 = 1.0;
/// Onglets de l'éditeur d'avatar, dans l'ordre de `avatar-common`.
const AVATAR_TABS: [&str; 6] = [
    "avatar-top",
    "avatar-style",
    "avatar-hair",
    "avatar-clothes",
    "avatar-stats",
    "avatar-name",
];
/// Taille plafond d'un asset reçu (le plus gros, un GLB complet, pèse quelques Mio).
const MAX_ASSET_BYTES: usize = 64 * 1024 * 1024;

/// Écran courant.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Stage {
    /// Fenêtre `EACLauncher.exe` : flux des assets de démarrage.
    EacLauncher {
        /// Temps passé depuis que tout est reçu.
        settled_for: f32,
    },
    /// Vidéo de démarrage `BOOT_VIDEOS[index]`.
    BootLogo {
        /// Rang de la vidéo.
        index: usize,
        /// Temps écoulé.
        elapsed: f32,
    },
    /// Écran de chargement, tant que les assets du menu arrivent.
    Loading {
        /// Temps écoulé.
        elapsed: f32,
    },
    /// Avis de sauvegarde automatique.
    Autosave,
    /// Écran-titre.
    Start,
    /// Menu principal `title_menu_2`.
    TitleMenu,
    /// Éditeur d'avatar, onglet `AVATAR_TABS[tab]`.
    Avatar {
        /// Onglet affiché.
        tab: usize,
    },
    /// Chargement des modèles du match.
    MatchLoading,
    /// Match en cours.
    Match,
}

impl Stage {
    fn name(self) -> &'static str {
        match self {
            Self::EacLauncher { .. } => "eac-launcher",
            Self::BootLogo { .. } => "boot-logo",
            Self::Loading { .. } => "loading",
            Self::Autosave => "autosave",
            Self::Start => "start",
            Self::TitleMenu => "title-menu",
            Self::Avatar { .. } => "avatar",
            Self::MatchLoading => "match-loading",
            Self::Match => "match",
        }
    }
}

/// Ce qu'une réponse d'asset alimente.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Target {
    Atlas(String),
    TexInfo(String),
    FontMetrics,
    TitleAudioInfo,
    Glb(usize),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Group {
    Boot,
    Menu,
    Avatar,
    Match,
}

#[derive(Debug, Clone)]
struct Pending {
    target: Target,
    group: Group,
    url: String,
    issued: bool,
    settled: bool,
    failed: Option<String>,
}

/// Requête de téléchargement exposée à l'hôte.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetRequest {
    /// Identifiant à rendre avec la réponse.
    pub id: u32,
    /// URL absolue sur le CDN.
    pub url: String,
    /// Nature attendue : `image`, `json`, `model`.
    pub kind: &'static str,
}

/// Ordre média pour l'hôte.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "op")]
pub enum MediaCommand {
    /// Jouer un son décodé par le CDN (`/audio`, WAV).
    PlayAudio {
        /// Canal (`bgm`).
        channel: &'static str,
        /// URL WAV.
        url: String,
        /// Boucler.
        #[serde(rename = "loop")]
        looped: bool,
    },
    /// Arrêter un canal.
    StopAudio {
        /// Canal.
        channel: &'static str,
    },
    /// Jouer une vidéo de démarrage plein écran, puis appeler `video_ended(name)`.
    PlayVideo {
        /// Nom (`L5logo`, `IE_15th`).
        name: &'static str,
        /// URL MP4.
        url: String,
    },
    /// Interrompre la vidéo courante.
    StopVideo,
}

/// Événement de haut niveau pour l'hôte (journal, analytique, retours haptiques).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum ClientEvent {
    /// Changement d'écran.
    Stage {
        /// Nom de l'écran.
        name: &'static str,
    },
    /// Entrée du menu principal validée (identifiant `hostActionId` de `title-menu`).
    MenuAction {
        /// Action.
        action: String,
        /// L'action ouvre-t-elle un écran de ce client ?
        handled: bool,
    },
    /// But.
    Goal {
        /// Équipe qui marque.
        team: u8,
        /// Score après le but.
        score: [u32; 2],
    },
    /// Fin du match.
    FullTime {
        /// Score final.
        score: [u32; 2],
    },
    /// Un groupe d'assets n'a pas pu être chargé.
    AssetError {
        /// URL fautive.
        url: String,
        /// Raison.
        reason: String,
    },
}

/// Le client complet.
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub struct NieClientRuntime {
    cdn: String,
    width: u32,
    height: u32,
    stage: Stage,
    compositor: SceneCompositor,
    scenes: BTreeMap<&'static str, Scene>,
    assets: BTreeMap<u32, Pending>,
    next_id: u32,
    glb: [Option<Vec<u8>>; 3],
    media: Vec<MediaCommand>,
    events: Vec<ClientEvent>,
    title_bgm: Option<String>,
    bgm_playing: bool,
    gamepad: GamepadState,
    raw_buttons: Vec<f32>,
    raw_axes: Vec<f32>,
    keyboard: u16,
    family: ControllerFamily,
    focus: Option<String>,
    avatar_focus: Option<String>,
    time: f32,
    session: Option<MatchSession>,
    models: Option<MatchModels>,
    stadium: Vec<Tri>,
    camera: MatchCamera,
    render_scale: f32,
}

impl NieClientRuntime {
    fn scene(&self, id: &str) -> Option<&Scene> {
        self.scenes.get(id)
    }

    fn rel(asset_path: &str) -> &str {
        let p = asset_path.strip_prefix("data/").unwrap_or(asset_path);
        p.strip_suffix(".g4tx").unwrap_or(p)
    }

    fn enqueue(&mut self, target: Target, group: Group, url: String) {
        if self.assets.values().any(|p| p.target == target) {
            return;
        }
        self.next_id += 1;
        self.assets.insert(
            self.next_id,
            Pending {
                target,
                group,
                url,
                issued: false,
                settled: false,
                failed: None,
            },
        );
    }

    fn enqueue_atlas(&mut self, asset_path: &str, group: Group) {
        let rel = Self::rel(asset_path).to_owned();
        self.enqueue(
            Target::Atlas(asset_path.to_owned()),
            group,
            format!("{}/tex/{rel}.png", self.cdn),
        );
        if asset_path != FONT_KEY {
            self.enqueue(
                Target::TexInfo(asset_path.to_owned()),
                group,
                format!("{}/tex-info/{rel}.g4tx", self.cdn),
            );
        }
    }

    fn enqueue_scene_atlases(&mut self, ids: &[&str], group: Group) {
        let mut paths: Vec<String> = ids
            .iter()
            .filter_map(|id| self.scene(id))
            .flat_map(|s| s.layers.iter().map(|l| l.asset_path.clone()))
            .collect();
        paths.sort();
        paths.dedup();
        for p in paths {
            self.enqueue_atlas(&p, group);
        }
    }

    fn group_progress(&self, group: Group) -> (usize, usize) {
        let all = self.assets.values().filter(|p| p.group == group);
        let total = all.clone().count();
        let settled = all.filter(|p| p.settled).count();
        (settled, total)
    }

    fn group_settled(&self, group: Group) -> bool {
        let (s, t) = self.group_progress(group);
        s == t
    }

    fn set_stage(&mut self, stage: Stage) {
        let before = self.stage.name();
        self.stage = stage;
        if before != stage.name() {
            self.events.push(ClientEvent::Stage { name: stage.name() });
        }
        match stage {
            Stage::BootLogo { index, .. } => {
                let name = BOOT_VIDEOS[index];
                self.media.push(MediaCommand::PlayVideo {
                    name,
                    url: format!("{}/static/nie/boot/{name}.mp4", self.cdn),
                });
            }
            Stage::Start | Stage::TitleMenu => self.start_title_bgm(),
            Stage::MatchLoading => {
                for (slot, path) in [HOME_MODEL_PATH, AWAY_MODEL_PATH, BALL_MODEL_PATH]
                    .into_iter()
                    .enumerate()
                {
                    let url = format!("{}{path}", self.cdn);
                    self.enqueue(Target::Glb(slot), Group::Match, url);
                }
            }
            Stage::Match => {
                if self.bgm_playing {
                    self.media.push(MediaCommand::StopAudio { channel: "bgm" });
                    self.bgm_playing = false;
                }
            }
            _ => {}
        }
    }

    fn start_title_bgm(&mut self) {
        if self.bgm_playing {
            return;
        }
        if let Some(url) = self.title_bgm.clone() {
            self.media.push(MediaCommand::PlayAudio {
                channel: "bgm",
                url,
                looped: true,
            });
            self.bgm_playing = true;
        }
    }

    /// Trouve le cue `bg00010` dans la réponse `/audio-info` de `bgm_title.acb`.
    fn resolve_title_bgm(&mut self, json: &str) -> Result<(), String> {
        let v: serde_json::Value =
            serde_json::from_str(json).map_err(|e| format!("audio-info : {e}"))?;
        let cues = v
            .get("cues")
            .and_then(serde_json::Value::as_array)
            .ok_or("audio-info sans cues")?;
        let mut ids = cues
            .iter()
            .filter(|c| c.get("name").and_then(serde_json::Value::as_str) == Some(TITLE_CUE));
        let cue = ids.next().ok_or("cue bg00010 absent")?;
        if ids.next().is_some() {
            return Err("cue bg00010 ambigu".into());
        }
        let awb = cue
            .get("awbId")
            .and_then(serde_json::Value::as_u64)
            .ok_or("cue bg00010 sans awbId")?;
        self.title_bgm = Some(format!("{}/audio/{TITLE_BANK}?id={awb}", self.cdn));
        if matches!(self.stage, Stage::Start | Stage::TitleMenu) {
            self.start_title_bgm();
        }
        Ok(())
    }

    fn apply_asset(&mut self, target: &Target, bytes: &[u8]) -> Result<(), String> {
        let text = || std::str::from_utf8(bytes).map_err(|e| format!("UTF-8 : {e}"));
        match target {
            Target::Atlas(path) => self.compositor.insert_png(path, bytes),
            Target::TexInfo(path) => self.compositor.insert_tex_info(path, text()?),
            Target::FontMetrics => self.compositor.insert_font_metrics_json(text()?),
            Target::TitleAudioInfo => self.resolve_title_bgm(text()?),
            Target::Glb(slot) => {
                self.glb[*slot] = Some(bytes.to_vec());
                Ok(())
            }
        }
    }

    fn controls_of(&self, id: &str) -> Vec<aphrody_nie_formats::menu_presentation::Control> {
        self.scene(id)
            .map(|s| s.controls.clone())
            .unwrap_or_default()
    }

    fn confirm_title(&mut self) {
        let Some(id) = self.focus.clone() else {
            return;
        };
        let action = self
            .scene("title-menu")
            .and_then(|s| s.controls.iter().find(|c| c.id == id))
            .map(|c| c.host_action_id.clone().unwrap_or_else(|| c.id.clone()))
            .unwrap_or(id);
        let handled = match action.as_str() {
            "mode-competition" => {
                self.set_stage(Stage::MatchLoading);
                true
            }
            "avatar" => {
                self.enqueue_scene_atlases(&AVATAR_TABS, Group::Avatar);
                self.avatar_focus = None;
                self.set_stage(Stage::Avatar { tab: 0 });
                true
            }
            _ => false,
        };
        self.events
            .push(ClientEvent::MenuAction { action, handled });
    }

    fn start_match(&mut self) -> Result<(), String> {
        let [Some(h), Some(a), Some(b)] = &self.glb else {
            return Err("modèles du match incomplets".into());
        };
        let models = MatchModels::from_glb(h, a, b).map_err(|e| format!("{e:#}"))?;
        self.models = Some(models);
        if self.stadium.is_empty() {
            self.stadium = match3d::stadium();
        }
        self.session = Some(MatchSession::default());
        self.camera = MatchCamera::default();
        self.set_stage(Stage::Match);
        Ok(())
    }

    fn update(&mut self, dt: f32) {
        self.time += dt;
        self.gamepad.update(&self.raw_buttons, &self.raw_axes);
        self.gamepad.merge_held(self.keyboard);
        let pad = self.gamepad.frame();
        let confirm = pad.just_pressed(PadButton::South) || pad.just_pressed(PadButton::Start);
        let back = pad.just_pressed(PadButton::East);

        match self.stage {
            Stage::EacLauncher { settled_for } => {
                if self.group_settled(Group::Boot) {
                    let t = settled_for + dt;
                    if t >= EAC_HANDOFF_S {
                        self.enqueue_scene_atlases(&["title-menu"], Group::Menu);
                        for p in [HUD_WIN_ASSET, HUD_CMN_ASSET, GAIJI_GAME_PATH] {
                            self.enqueue_atlas(p, Group::Menu);
                        }
                        self.enqueue(
                            Target::TitleAudioInfo,
                            Group::Menu,
                            format!("{}/audio-info/{TITLE_BANK}", self.cdn),
                        );
                        self.set_stage(Stage::BootLogo {
                            index: 0,
                            elapsed: 0.0,
                        });
                    } else {
                        self.stage = Stage::EacLauncher { settled_for: t };
                    }
                }
            }
            Stage::BootLogo { index, elapsed } => {
                let elapsed = elapsed + dt;
                if confirm || elapsed >= BOOT_VIDEO_TIMEOUT_S {
                    self.media.push(MediaCommand::StopVideo);
                    self.advance_boot_logo(index);
                } else {
                    self.stage = Stage::BootLogo { index, elapsed };
                }
            }
            Stage::Loading { elapsed } => {
                let elapsed = elapsed + dt;
                if elapsed >= LOADING_MIN_S && self.group_settled(Group::Menu) {
                    self.set_stage(Stage::Autosave);
                } else {
                    self.stage = Stage::Loading { elapsed };
                }
            }
            Stage::Autosave => {
                if confirm {
                    self.set_stage(Stage::Start);
                }
            }
            Stage::Start => {
                if confirm {
                    if self.focus.is_none() {
                        self.focus = self.controls_of("title-menu").first().map(|c| c.id.clone());
                    }
                    self.set_stage(Stage::TitleMenu);
                }
            }
            Stage::TitleMenu => {
                if let Some((dx, dy)) = self.gamepad.menu_direction(dt) {
                    let controls = self.controls_of("title-menu");
                    self.focus = navigate_spatial(&controls, self.focus.as_deref(), dx, dy);
                }
                if pad.just_pressed(PadButton::South) {
                    self.confirm_title();
                } else if back {
                    self.set_stage(Stage::Start);
                }
            }
            Stage::Avatar { tab } => {
                let n = AVATAR_TABS.len();
                if pad.just_pressed(PadButton::R1) {
                    self.avatar_focus = None;
                    self.set_stage(Stage::Avatar { tab: (tab + 1) % n });
                } else if pad.just_pressed(PadButton::L1) {
                    self.avatar_focus = None;
                    self.set_stage(Stage::Avatar {
                        tab: (tab + n - 1) % n,
                    });
                } else if back {
                    self.set_stage(Stage::TitleMenu);
                } else if let Some((dx, dy)) = self.gamepad.menu_direction(dt) {
                    let controls = self.controls_of(AVATAR_TABS[tab]);
                    self.avatar_focus =
                        navigate_spatial(&controls, self.avatar_focus.as_deref(), dx, dy);
                }
            }
            Stage::MatchLoading => {
                if self.group_settled(Group::Match) {
                    if let Err(reason) = self.start_match() {
                        self.events.push(ClientEvent::AssetError {
                            url: format!("{}/model-full", self.cdn),
                            reason,
                        });
                        // Les échecs sont oubliés : un nouvel essai redemandera les modèles.
                        self.assets.retain(|_, p| p.group != Group::Match);
                        self.glb = [None, None, None];
                        self.set_stage(Stage::TitleMenu);
                    }
                } else if back {
                    self.set_stage(Stage::TitleMenu);
                }
            }
            Stage::Match => self.update_match(dt, &pad),
        }
    }

    fn advance_boot_logo(&mut self, index: usize) {
        if index + 1 < BOOT_VIDEOS.len() {
            self.set_stage(Stage::BootLogo {
                index: index + 1,
                elapsed: 0.0,
            });
        } else {
            self.set_stage(Stage::Loading { elapsed: 0.0 });
        }
    }

    fn update_match(&mut self, dt: f32, pad: &aphrody_nie_runtime::pad::PadFrame) {
        let Some(session) = self.session.as_mut() else {
            self.set_stage(Stage::TitleMenu);
            return;
        };
        session.frame(dt, pad);
        let events = session.drain_events();
        let score = session.world.score;
        let mut quit = false;
        for e in events {
            match e {
                MatchEvent::CameraCycled => self.camera = self.camera.next(),
                MatchEvent::QuitRequested => quit = true,
                MatchEvent::Goal { team } => self.events.push(ClientEvent::Goal { team, score }),
                MatchEvent::FullTime => self.events.push(ClientEvent::FullTime { score }),
                _ => {}
            }
        }
        if quit {
            self.session = None;
            self.set_stage(Stage::TitleMenu);
        }
    }

    fn compose(&self, ids: &[&str], focused: &[&str], canvas: &mut [u8]) {
        let scenes: Vec<&Scene> = ids.iter().filter_map(|id| self.scene(id)).collect();
        let pulse = (self.time * 2.0).fract();
        self.compositor.compose_scenes(
            &scenes,
            focused,
            pulse,
            canvas,
            self.width,
            self.height,
            true,
        );
    }

    fn footer(&self, prompts: &[FooterPrompt<'_>], canvas: &mut [u8]) {
        let y = self.height as i32 - 34;
        draw_footer_bar(
            &self.compositor,
            self.family,
            prompts,
            y,
            canvas,
            self.width,
            self.height,
        );
    }

    fn render_match(&self, canvas: &mut [u8]) {
        let (Some(session), Some(models)) = (&self.session, &self.models) else {
            fill_solid(canvas, [0, 0, 0, 255]);
            return;
        };
        let (w, h) = (self.width, self.height);
        let rw = ((w as f32 * self.render_scale) as u32).clamp(1, w);
        let rh = ((h as f32 * self.render_scale) as u32).clamp(1, h);
        let controlled = session.controlled();
        let img = match3d::render_match(
            &session.world,
            models,
            &self.stadium,
            self.camera,
            controlled,
            rw,
            rh,
        );
        // Agrandissement au plus proche vers le canevas plein écran.
        for y in 0..h {
            let sy = (u64::from(y) * u64::from(rh) / u64::from(h)) as u32;
            for x in 0..w {
                let sx = (u64::from(x) * u64::from(rw) / u64::from(w)) as u32;
                let s = ((sy * rw + sx) * 4) as usize;
                let d = ((y * w + x) * 4) as usize;
                canvas[d..d + 4].copy_from_slice(&img[s..s + 4]);
            }
        }

        let dots: Vec<MinimapDot> = session
            .world
            .players
            .iter()
            .enumerate()
            .map(|(i, p)| MinimapDot {
                nx: p.pos.x / HALF_LEN,
                // La caméra regarde depuis la touche +y : le haut de l'écran est -y.
                ny: -p.pos.y / HALF_WID,
                team: p.team,
                controlled: Some(i) == controlled,
            })
            .collect();
        let b = session.world.ball.pos;
        let (paused, pause_index) = match session.phase {
            MatchPhase::Paused { index } => (true, usize::from(index)),
            _ => (false, 0),
        };
        let view = MatchHudView {
            home_name: "Domicile",
            away_name: "Extérieur",
            home_score: session.world.score[0],
            away_score: session.world.score[1],
            match_seconds: session.match_seconds() as u32,
            half: session.half,
            home_tension: session.tension[0],
            away_tension: session.tension[1],
            controlled_player_name: "",
            stamina_ratio: session.controlled_stamina(),
            in_focus_duel: matches!(session.phase, MatchPhase::Focus(_)),
            in_zone: session.in_zone(),
            active_hissatsu: session.hissatsu_banner.map(|(k, _)| match k {
                HissatsuKind::Shot => "Tir Hissatsu",
                HissatsuKind::Block => "Défense Hissatsu",
            }),
            goal_banner: session.goal_banner.map(|_| "BUT !"),
            minimap_players: &dots,
            minimap_ball: (b.x / HALF_LEN, -b.y / HALF_WID),
            paused,
            pause_index,
            camera_label: self.camera.label(),
            controller: self.family,
        };
        render_match_hud(&self.compositor, &view, canvas, w, h);
    }
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl NieClientRuntime {
    /// Crée le client pour un canevas `width × height`. `cdn_base` vide ou absent = CDN public.
    ///
    /// # Errors
    ///
    /// Rend une erreur si une scène embarquée est invalide (défaut de construction du crate).
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(constructor))]
    pub fn new(
        cdn_base: Option<String>,
        width: u32,
        height: u32,
    ) -> Result<NieClientRuntime, String> {
        let cdn = cdn_base
            .filter(|c| !c.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_CDN_BASE.to_owned())
            .trim_end_matches('/')
            .to_owned();
        let mut scenes = BTreeMap::new();
        for id in ["loading", "autosave", "start", "title-menu"]
            .into_iter()
            .chain(AVATAR_TABS)
        {
            scenes.insert(id, parse_scene(&scene_json(id)?)?);
        }
        let mut rt = Self {
            cdn,
            width: width.max(1),
            height: height.max(1),
            stage: Stage::EacLauncher { settled_for: 0.0 },
            compositor: SceneCompositor::new(),
            scenes,
            assets: BTreeMap::new(),
            next_id: 0,
            glb: [None, None, None],
            media: Vec::new(),
            events: Vec::new(),
            title_bgm: None,
            bgm_playing: false,
            gamepad: GamepadState::default(),
            raw_buttons: Vec::new(),
            raw_axes: Vec::new(),
            keyboard: 0,
            family: ControllerFamily::Keyboard,
            focus: None,
            avatar_focus: None,
            time: 0.0,
            session: None,
            models: None,
            stadium: Vec::new(),
            camera: MatchCamera::default(),
            render_scale: 0.5,
        };
        // Lot de démarrage : ce que la fenêtre EAC fait réellement attendre.
        let splash = format!("{}/static/nie/boot/SplashScreen.png", rt.cdn);
        rt.enqueue(
            Target::Atlas(EAC_SPLASH_KEY.to_owned()),
            Group::Boot,
            splash,
        );
        rt.enqueue_atlas(FONT_KEY, Group::Boot);
        let metrics = format!("{}/ui/font-metrics.json", rt.cdn);
        rt.enqueue(Target::FontMetrics, Group::Boot, metrics);
        rt.enqueue_scene_atlases(&["loading", "autosave", "start"], Group::Boot);
        Ok(rt)
    }

    /// Change la taille du canevas.
    pub fn resize(&mut self, width: u32, height: u32) {
        self.width = width.max(1);
        self.height = height.max(1);
    }

    /// Largeur du canevas.
    #[must_use]
    pub fn width(&self) -> u32 {
        self.width
    }

    /// Hauteur du canevas.
    #[must_use]
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Fraction de la résolution du canevas à laquelle la 3D du match est rastérisée
    /// (`0.25..=1`, défaut `0.5`), puis agrandie.
    pub fn set_match_render_scale(&mut self, scale: f32) {
        if scale.is_finite() {
            self.render_scale = scale.clamp(0.25, 1.0);
        }
    }

    /// Recopie l'état d'une manette (`Gamepad.buttons[i].value`, `Gamepad.axes`, `Gamepad.id`).
    pub fn set_gamepad(&mut self, buttons: &[f32], axes: &[f32], id: &str) {
        self.raw_buttons = buttons.to_vec();
        self.raw_axes = axes.to_vec();
        self.family = ControllerFamily::from_gamepad_id(id);
    }

    /// Plus de manette (déconnexion) : tout est relâché, les glyphes repassent au clavier.
    pub fn clear_gamepad(&mut self) {
        self.raw_buttons.clear();
        self.raw_axes.clear();
        self.gamepad.release_all();
        self.family = ControllerFamily::Keyboard;
    }

    /// Touche enfoncée (`KeyboardEvent.code` ou `.key`). Rend `true` si elle est utilisée, pour
    /// que l'hôte appelle `preventDefault`.
    pub fn key_down(&mut self, code: &str) -> bool {
        match Key::parse(code).and_then(pad_button_for_key) {
            Some(b) => {
                self.keyboard |= b.bit();
                true
            }
            None => false,
        }
    }

    /// Touche relâchée.
    pub fn key_up(&mut self, code: &str) {
        if let Some(b) = Key::parse(code).and_then(pad_button_for_key) {
            self.keyboard &= !b.bit();
        }
    }

    /// Fenêtre ou onglet inactif : relâche le clavier.
    pub fn blur(&mut self) {
        self.keyboard = 0;
        self.gamepad.release_all();
    }

    /// Avance le client de `dt_ms` millisecondes d'horloge (`requestAnimationFrame`).
    pub fn tick(&mut self, dt_ms: f64) {
        let dt = if dt_ms.is_finite() && dt_ms > 0.0 {
            (dt_ms / 1000.0).min(0.25) as f32
        } else {
            0.0
        };
        self.update(dt);
    }

    /// Peint l'image courante dans `out` (RGBA8, `width × height × 4` octets).
    pub fn render_into(&self, out: &mut [u8]) {
        let (w, h) = (self.width, self.height);
        if out.len() < (w as usize) * (h as usize) * 4 {
            return;
        }
        match self.stage {
            Stage::EacLauncher { .. } => {
                let (settled, total) = self.group_progress(Group::Boot);
                let progress = if total == 0 {
                    1.0
                } else {
                    settled as f32 / total as f32
                };
                render_eac_launcher(&self.compositor, progress, settled, total, out, w, h);
            }
            Stage::BootLogo { .. } => fill_solid(out, [0, 0, 0, 255]),
            Stage::Loading { .. } | Stage::MatchLoading => self.compose(&["loading"], &[], out),
            Stage::Autosave => {
                self.compose(&["autosave"], &["confirm"], out);
                self.footer(
                    &[FooterPrompt {
                        button: PromptButton::South,
                        label: "Continuer",
                    }],
                    out,
                );
            }
            Stage::Start => self.compose(&["start"], &["confirm"], out),
            Stage::TitleMenu => {
                let focused: Vec<&str> = self.focus.as_deref().into_iter().collect();
                self.compose(&["title-menu"], &focused, out);
                self.footer(
                    &[
                        FooterPrompt {
                            button: PromptButton::Dpad,
                            label: "Choisir",
                        },
                        FooterPrompt {
                            button: PromptButton::South,
                            label: "Valider",
                        },
                        FooterPrompt {
                            button: PromptButton::East,
                            label: "Retour",
                        },
                    ],
                    out,
                );
            }
            Stage::Avatar { tab } => {
                let focused: Vec<&str> = self.avatar_focus.as_deref().into_iter().collect();
                self.compose(&[AVATAR_TABS[tab]], &focused, out);
                self.footer(
                    &[
                        FooterPrompt {
                            button: PromptButton::L1,
                            label: "Onglet",
                        },
                        FooterPrompt {
                            button: PromptButton::R1,
                            label: "Onglet",
                        },
                        FooterPrompt {
                            button: PromptButton::East,
                            label: "Retour",
                        },
                    ],
                    out,
                );
            }
            Stage::Match => self.render_match(out),
        }
    }

    /// Requêtes d'assets pas encore transmises, en JSON `[{id, url, kind}]`. Chaque requête
    /// n'est rendue qu'une fois.
    pub fn poll_asset_requests(&mut self) -> String {
        let mut out = Vec::new();
        for (id, p) in self.assets.iter_mut().filter(|(_, p)| !p.issued) {
            p.issued = true;
            let kind = match p.target {
                Target::Atlas(_) => "image",
                Target::Glb(_) => "model",
                _ => "json",
            };
            out.push(AssetRequest {
                id: *id,
                url: p.url.clone(),
                kind,
            });
        }
        serde_json::to_string(&out).unwrap_or_else(|_| "[]".into())
    }

    /// Réponse d'une requête : les octets bruts du corps HTTP.
    ///
    /// # Errors
    ///
    /// Rend une erreur si l'identifiant est inconnu ou si les octets ne se décodent pas ; la
    /// requête est alors marquée en échec et ne bloque plus sa progression.
    pub fn provide_asset(&mut self, id: u32, bytes: &[u8]) -> Result<(), String> {
        let target = self
            .assets
            .get(&id)
            .map(|p| p.target.clone())
            .ok_or_else(|| format!("requête {id} inconnue"))?;
        let result = if bytes.len() > MAX_ASSET_BYTES {
            Err(format!("{} octets, au-delà du plafond", bytes.len()))
        } else {
            self.apply_asset(&target, bytes)
        };
        if let Some(p) = self.assets.get_mut(&id) {
            p.settled = true;
            if let Err(e) = &result {
                p.failed = Some(e.clone());
                self.events.push(ClientEvent::AssetError {
                    url: p.url.clone(),
                    reason: e.clone(),
                });
            }
        }
        result
    }

    /// Échec réseau ou HTTP d'une requête (`status` = 0 pour une erreur réseau).
    pub fn asset_failed(&mut self, id: u32, status: u16, reason: &str) {
        if let Some(p) = self.assets.get_mut(&id) {
            p.settled = true;
            let r = format!("HTTP {status} {reason}");
            p.failed = Some(r.clone());
            self.events.push(ClientEvent::AssetError {
                url: p.url.clone(),
                reason: r,
            });
        }
    }

    /// Ordres audio et vidéo en attente, en JSON.
    pub fn poll_media_commands(&mut self) -> String {
        serde_json::to_string(&std::mem::take(&mut self.media)).unwrap_or_else(|_| "[]".into())
    }

    /// Événements en attente, en JSON.
    pub fn poll_events(&mut self) -> String {
        serde_json::to_string(&std::mem::take(&mut self.events)).unwrap_or_else(|_| "[]".into())
    }

    /// L'hôte signale la fin (ou l'échec) de la vidéo de démarrage `name`.
    pub fn video_ended(&mut self, name: &str) {
        if let Stage::BootLogo { index, .. } = self.stage
            && BOOT_VIDEOS[index] == name
        {
            self.advance_boot_logo(index);
        }
    }

    /// L'écran courant attend-il que l'hôte peigne la vidéo de démarrage sous le canevas ?
    #[must_use]
    pub fn wants_video(&self) -> bool {
        matches!(self.stage, Stage::BootLogo { .. })
    }

    /// Nom de l'écran courant.
    #[must_use]
    pub fn stage(&self) -> String {
        self.stage.name().to_owned()
    }

    /// Entrée focalisée du menu principal (identifiant de contrôle de `title-menu`).
    #[must_use]
    pub fn focused_control(&self) -> Option<String> {
        self.focus.clone()
    }

    /// Assets en échec, en JSON `[{url, reason}]`.
    pub fn failed_assets(&self) -> String {
        let list: Vec<serde_json::Value> = self
            .assets
            .values()
            .filter_map(|p| {
                p.failed
                    .as_ref()
                    .map(|r| serde_json::json!({ "url": p.url, "reason": r }))
            })
            .collect();
        serde_json::to_string(&list).unwrap_or_else(|_| "[]".into())
    }

    /// Score du match en cours `[domicile, extérieur]`, vide hors match.
    #[must_use]
    pub fn match_score(&self) -> Vec<u32> {
        self.session
            .as_ref()
            .map(|s| s.world.score.to_vec())
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rt() -> NieClientRuntime {
        NieClientRuntime::new(None, 320, 180).unwrap()
    }

    fn requests(rt: &mut NieClientRuntime) -> Vec<(u32, String)> {
        let v: serde_json::Value = serde_json::from_str(&rt.poll_asset_requests()).unwrap();
        v.as_array()
            .unwrap()
            .iter()
            .map(|r| {
                (
                    r["id"].as_u64().unwrap() as u32,
                    r["url"].as_str().unwrap().to_owned(),
                )
            })
            .collect()
    }

    fn fail_all(rt: &mut NieClientRuntime) -> usize {
        let r = requests(rt);
        for (id, _) in &r {
            rt.asset_failed(*id, 404, "Not Found");
        }
        r.len()
    }

    fn press(rt: &mut NieClientRuntime, b: PadButton) {
        let mut buttons = [0.0f32; 16];
        buttons[b as usize] = 1.0;
        rt.set_gamepad(
            &buttons,
            &[0.0; 4],
            "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)",
        );
        rt.tick(16.0);
        rt.set_gamepad(&[0.0; 16], &[0.0; 4], "Xbox Wireless Controller");
        rt.tick(16.0);
    }

    /// Jusqu'au menu principal, en simulant un CDN qui répond 404 partout.
    fn jusquau_menu(rt: &mut NieClientRuntime) {
        fail_all(rt);
        for _ in 0..100 {
            rt.tick(16.0);
        }
        assert_eq!(rt.stage(), "boot-logo");
        fail_all(rt);
        rt.video_ended("L5logo");
        rt.video_ended("IE_15th");
        assert_eq!(rt.stage(), "loading");
        for _ in 0..100 {
            rt.tick(16.0);
        }
        assert_eq!(rt.stage(), "autosave");
        press(rt, PadButton::South);
        assert_eq!(rt.stage(), "start");
        press(rt, PadButton::South);
        assert_eq!(rt.stage(), "title-menu");
    }

    #[test]
    fn toutes_les_urls_viennent_du_cdn_public_et_jamais_du_vfs() {
        let mut rt = rt();
        jusquau_menu(&mut rt);
        let action = rt
            .scene("title-menu")
            .unwrap()
            .controls
            .iter()
            .find(|c| c.host_action_id.as_deref() == Some("mode-competition"))
            .unwrap()
            .id
            .clone();
        rt.focus = Some(action);
        press(&mut rt, PadButton::South);
        assert_eq!(rt.stage(), "match-loading");
        let urls: Vec<String> = rt.assets.values().map(|p| p.url.clone()).collect();
        assert!(urls.len() > 10);
        for u in &urls {
            assert!(u.starts_with("https://cdn.rosegriffon.fr/"), "{u}");
            assert!(!u.contains("/vfs/") && !u.contains("/raw"), "{u}");
        }
        for attendu in [
            "/ui/font-metrics.json",
            "/tex/dx11/font/font_def/font.png",
            "/static/nie/boot/SplashScreen.png",
            "/model-full/c01000010.glb",
            "/model-full/c05000010.glb",
            "/model-chr/item/b000004.glb",
            "/audio-info/data/common/sound_asset/bgm_title.acb",
            "/tex-info/dx11/menu/50_title/title02/title02_00/title02_00.g4tx",
        ] {
            assert!(
                urls.iter().any(|u| u.ends_with(attendu)),
                "{attendu} absent"
            );
        }
    }

    #[test]
    fn la_progression_eac_suit_les_assets_recus() {
        let mut rt = rt();
        let r = requests(&mut rt);
        assert_eq!(rt.group_progress(Group::Boot), (0, r.len()));
        rt.asset_failed(r[0].0, 500, "x");
        assert_eq!(rt.group_progress(Group::Boot).0, 1);
        rt.tick(5000.0);
        assert_eq!(
            rt.stage(),
            "eac-launcher",
            "pas de passage tant que tout n'est pas reçu"
        );
        let mut img = vec![0u8; 320 * 180 * 4];
        rt.render_into(&mut img);
        assert!(img.iter().any(|&b| b != 0));
        assert!(rt.provide_asset(9999, b"").is_err());
        assert!(rt.provide_asset(r[1].0, b"pas un png").is_err());
        assert!(rt.failed_assets().contains("pas un png") || rt.failed_assets().contains("png"));
    }

    #[test]
    fn la_navigation_du_menu_parcourt_les_13_entrees() {
        let mut rt = rt();
        jusquau_menu(&mut rt);
        assert_eq!(rt.controls_of("title-menu").len(), 13);
        let mut vus = std::collections::BTreeSet::new();
        vus.extend(rt.focused_control());
        for b in [
            PadButton::DpadRight,
            PadButton::DpadRight,
            PadButton::DpadDown,
            PadButton::DpadLeft,
            PadButton::DpadDown,
            PadButton::DpadRight,
            PadButton::DpadUp,
            PadButton::DpadUp,
            PadButton::DpadUp,
        ] {
            press(&mut rt, b);
            vus.extend(rt.focused_control());
        }
        assert!(vus.len() >= 5, "{vus:?}");
        let mut img = vec![0u8; 320 * 180 * 4];
        rt.render_into(&mut img);
        press(&mut rt, PadButton::East);
        assert_eq!(rt.stage(), "start");
    }

    #[test]
    fn la_musique_de_titre_vient_du_cue_natif() {
        let mut rt = rt();
        rt.resolve_title_bgm(
            r#"{"cues":[{"name":"bg00020","awbId":1},{"name":"bg00010","awbId":7}]}"#,
        )
        .unwrap();
        assert_eq!(
            rt.title_bgm.as_deref(),
            Some("https://cdn.rosegriffon.fr/audio/data/common/sound_asset/bgm_title.acb?id=7")
        );
        assert!(rt.resolve_title_bgm(r#"{"cues":[]}"#).is_err());
        rt.set_stage(Stage::Start);
        let m = rt.poll_media_commands();
        assert!(
            m.contains("playAudio") && m.contains("?id=7") && m.contains("\"loop\":true"),
            "{m}"
        );
    }

    #[test]
    fn les_logos_se_passent_a_la_manette_et_demandent_leur_video() {
        let mut rt = rt();
        fail_all(&mut rt);
        for _ in 0..100 {
            rt.tick(16.0);
        }
        assert!(rt.wants_video());
        let m = rt.poll_media_commands();
        assert!(m.contains("/static/nie/boot/L5logo.mp4"), "{m}");
        press(&mut rt, PadButton::Start);
        assert!(rt.poll_media_commands().contains("IE_15th"));
    }

    #[test]
    fn un_match_sans_modeles_revient_au_menu_avec_une_erreur() {
        let mut rt = rt();
        jusquau_menu(&mut rt);
        rt.set_stage(Stage::MatchLoading);
        fail_all(&mut rt);
        rt.poll_events();
        rt.tick(16.0);
        assert_eq!(rt.stage(), "title-menu");
        assert!(rt.poll_events().contains("assetError"));
    }

    #[test]
    fn lediteur_davatar_change_donglet() {
        let mut rt = rt();
        jusquau_menu(&mut rt);
        let avatar = rt
            .controls_of("title-menu")
            .into_iter()
            .find(|c| c.host_action_id.as_deref() == Some("avatar"))
            .unwrap()
            .id;
        rt.focus = Some(avatar);
        press(&mut rt, PadButton::South);
        assert_eq!(rt.stage, Stage::Avatar { tab: 0 });
        press(&mut rt, PadButton::R1);
        assert_eq!(rt.stage, Stage::Avatar { tab: 1 });
        press(&mut rt, PadButton::L1);
        press(&mut rt, PadButton::L1);
        assert_eq!(rt.stage, Stage::Avatar { tab: 5 });
        press(&mut rt, PadButton::East);
        assert_eq!(rt.stage(), "title-menu");
    }

    #[test]
    fn le_clavier_pilote_comme_une_manette() {
        let mut rt = rt();
        assert!(rt.key_down("Enter"));
        assert!(!rt.key_down("F13"));
        rt.key_up("Enter");
        assert_eq!(rt.keyboard, 0);
    }
}
