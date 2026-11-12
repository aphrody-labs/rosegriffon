//! Deterministic 60 Hz Open World & Kizuna Town simulation runtime for `nie`.
//!
//! Couples `aphrody_nie_core::world_move` (`CharaMoveCtrl`, `RpgScenePhase`,
//! `MapFuncPointConfig`, `MapPlacementConfig`) with `aphrody_nie_formats::navm::Navm`
//! ground/polygon queries, multi-zone world streaming (`w10` Nagumohara, `w20` Raimon,
//! `w30` Kizuna Station, `w40` Odaiba Stadium), NPC dialogue, Kizuna Town prop
//! customization, and seamless transition into 11v11 [`crate::World`] matches.

use aphrody_nie_core::world_move::{
    CharaMoveCtrl, MapFuncKind, MapFuncPointConfig, MapInterestPointConfig, MapNameTagConfig,
    MapPlacementConfig, MoveAnimState, RpgScenePhase,
};
use aphrody_nie_formats::navm::Navm;
use aphrody_nie_geom::Vec3;
use serde::{Deserialize, Serialize};

use crate::TICK_DT;

/// Canonical open-world zone identifier matching `nie.exe` map prefixes (`w10`, `w20`, `w30`, `w40`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorldZoneId {
    /// `w10` — Nagumohara (South Cirrus Junior High & Kyushu Seaside).
    #[default]
    Nagumohara,
    /// `w20` — Raimon Precinct (Inazuma Town Classic Campus & Riverbank).
    Raimon,
    /// `w30` — Kizuna Station (Customizable Avatar Town & Online Hub).
    KizunaTown,
    /// `w40` — Odaiba Football Frontier National Stadium.
    OdaibaStadium,
}

impl WorldZoneId {
    /// All 4 playable interconnected open-world zones.
    pub const ALL: [Self; 4] = [
        Self::Nagumohara,
        Self::Raimon,
        Self::KizunaTown,
        Self::OdaibaStadium,
    ];

    /// Internal `nie.exe` map numeric ID (`current_map_id_`).
    #[must_use]
    pub const fn map_id(self) -> u32 {
        match self {
            Self::Nagumohara => 1001,
            Self::Raimon => 2001,
            Self::KizunaTown => 3001,
            Self::OdaibaStadium => 4001,
        }
    }

    /// Canonical Level-5 VFS map code (`data/common/map/<code >/`).
    #[must_use]
    pub const fn map_code(self) -> &'static str {
        match self {
            Self::Nagumohara => "w10i000",
            Self::Raimon => "w20i000",
            Self::KizunaTown => "w30k000",
            Self::OdaibaStadium => "w40s000",
        }
    }

    /// French localized zone name displayed in the `-10deg` skewed RPG header bar.
    #[must_use]
    pub const fn title_fr(self) -> &'static str {
        match self {
            Self::Nagumohara => "Nagumohara - Cote Sud & College",
            Self::Raimon => "Quartier Raimon - Terrain de la Riviere",
            Self::KizunaTown => "Ville Kizuna - Hub & Personnalisation",
            Self::OdaibaStadium => "Odaiba - Stade Football Frontier",
        }
    }

    /// Half-extent `(half_w, half_d)` in meters of the walkable zone bounds.
    #[must_use]
    pub const fn half_extents(self) -> (f32, f32) {
        match self {
            Self::Nagumohara => (60.0, 60.0),
            Self::Raimon => (55.0, 55.0),
            Self::KizunaTown => (48.0, 48.0),
            Self::OdaibaStadium => (64.0, 64.0),
        }
    }
}

/// Element affinity badge matching `aphrody_nie_ui::surfaces` (`--screen-elem-*`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ElementBadge {
    /// Wind (`#8ED5FF`).
    Wind,
    /// Forest (`#ABFF38`).
    Forest,
    /// Fire (`#FF7155`).
    Fire,
    /// Mountain (`#FFB936`).
    Mountain,
}

/// Interactive NPC actor in the open world.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorldNpc {
    /// Character identifier.
    pub chara_id: u32,
    /// Display name.
    pub name: String,
    /// Role / affiliation tag.
    pub role: String,
    /// Character element badge.
    pub element: ElementBadge,
    /// Locomotion state (`CCharaMoveCtrl`).
    pub ctrl: CharaMoveCtrl,
    /// Dialogue lines spoken when interacted with.
    pub dialogue: Vec<String>,
    /// Whether this NPC initiates a playable soccer battle after talking.
    pub triggers_battle: bool,
    /// Rival team name if `triggers_battle` is true.
    pub battle_team: Option<String>,
}

/// Interactive proximity prompt shown in the bottom-right HUD when near an NPC or `MapFuncPointConfig`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ProximityAction {
    /// Talk to a nearby NPC (`[E] / [Entree] Parler`).
    TalkNpc {
        npc_index: usize,
        speaker: String,
        triggers_battle: bool,
    },
    /// Travel through a zone portal (`[E] / [Entree] Voyager`).
    ZoneTransition {
        target_zone: WorldZoneId,
        label: String,
    },
    /// Launch a playable 11v11 / 5v5 match (`[E] / [Entree] Defi Football`).
    StartBattle { opponent_name: String },
    /// Place or cycle a Kizuna Town monument (`[E] / [Entree] Amenager Kizuna`).
    KizunaCustomize { socket_id: u32 },
}

/// Result of executing [`OpenWorldState::interact`] on the active proximity prompt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum InteractionOutcome {
    /// Nothing within interaction radius.
    None,
    /// Opened or advanced an NPC dialogue line.
    Dialogue {
        speaker: String,
        line: String,
        line_index: usize,
        total_lines: usize,
    },
    /// Closed dialogue.
    DialogueEnded,
    /// Transitioned to another zone.
    ZoneChanged { zone: WorldZoneId },
    /// Triggered a playable soccer match against `opponent_name`.
    LaunchMatch { opponent_name: String },
    /// Placed or upgraded a Kizuna Town prop.
    KizunaPropUpdated {
        socket_id: u32,
        object_name: String,
        kizuna_power: u32,
    },
}

/// Chase camera state tracking the player in 3D space.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct WorldCamera {
    /// Camera eye position (`y` = height).
    pub eye: Vec3,
    /// Look-at target (`y` = height).
    pub target: Vec3,
    /// Orbit yaw angle in radians.
    pub yaw: f32,
    /// Pitch angle in radians.
    pub pitch: f32,
    /// Distance behind player in meters.
    pub distance: f32,
    /// Vertical field of view in degrees (`45.0` RPG exploration, `28.0` FC-style tactical).
    pub fov_deg: f32,
}

impl Default for WorldCamera {
    fn default() -> Self {
        Self {
            eye: Vec3::new(0.0, 5.5, -10.5),
            target: Vec3::new(0.0, 1.4, 0.0),
            yaw: 0.0,
            pitch: 0.36,
            distance: 10.5,
            fov_deg: 45.0,
        }
    }
}

impl WorldCamera {
    /// Smoothly updates the chase camera toward `player_pos` over `dt` seconds.
    pub fn follow(&mut self, player_pos: Vec3, dt: f32) {
        let desired_target = Vec3::new(player_pos.x, player_pos.y + 1.4, player_pos.z);
        let horiz = self.distance * self.pitch.cos();
        let height = self.distance * self.pitch.sin();
        let desired_eye = Vec3::new(
            desired_target.x - self.yaw.sin() * horiz,
            desired_target.y + height,
            desired_target.z - self.yaw.cos() * horiz,
        );
        let alpha = (dt * 10.0).clamp(0.0, 1.0);
        self.target = Vec3::new(
            self.target.x + (desired_target.x - self.target.x) * alpha,
            self.target.y + (desired_target.y - self.target.y) * alpha,
            self.target.z + (desired_target.z - self.target.z) * alpha,
        );
        self.eye = Vec3::new(
            self.eye.x + (desired_eye.x - self.eye.x) * alpha,
            self.eye.y + (desired_eye.y - self.eye.y) * alpha,
            self.eye.z + (desired_eye.z - self.eye.z) * alpha,
        );
    }
}

/// Customizable Kizuna Town (`w30k000`) state integrated into the open world.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KizunaTownState {
    /// Total Kizuna Power score (`--jeu-or` badge).
    pub kizuna_power: u32,
    /// Kizuna coins / tokens earned from matches and exploration.
    pub kizuna_coins: u32,
    /// Placed objects on Kizuna sockets (`GDSMapPlacementConfig`).
    pub placements: Vec<MapPlacementConfig>,
    /// Catalog of unlockable Kizuna structures (`(mesh_hash, label, power_bonus)`).
    pub catalog_index: usize,
}

impl Default for KizunaTownState {
    fn default() -> Self {
        Self {
            kizuna_power: 1250,
            kizuna_coins: 3500,
            placements: vec![
                MapPlacementConfig {
                    map_id: WorldZoneId::KizunaTown.map_id(),
                    object_id: 1,
                    mesh_hash: 0xA101_0001,
                    pos: Vec3::new(-10.0, 0.0, 12.0),
                    rot: Vec3::new(0.0, 25.0, 0.0),
                    scale: 1.0,
                },
                MapPlacementConfig {
                    map_id: WorldZoneId::KizunaTown.map_id(),
                    object_id: 2,
                    mesh_hash: 0xA101_0002,
                    pos: Vec3::new(10.0, 0.0, 12.0),
                    rot: Vec3::new(0.0, -25.0, 0.0),
                    scale: 1.0,
                },
            ],
            catalog_index: 0,
        }
    }
}

const KIZUNA_CATALOG: &[(u32, &str, u32)] = &[
    (0xA101_0010, "Tour de l'Eclair Raimon", 250),
    (0xA101_0020, "Terrain Cotier Nagumohara", 320),
    (0xA101_0030, "Fontaine Celeste Aphrody", 450),
    (0xA101_0040, "Statue Mains Celestes", 380),
    (0xA101_0050, " Club-House Victory Road", 500),
];

/// Complete cross-platform Open World simulation state (`nie.exe` `CSceneRpg` + `KizunaTown`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenWorldState {
    /// Current streamed zone (`w10`, `w20`, `w30`, `w40`).
    pub zone: WorldZoneId,
    /// Current `CSceneRpg` story progression phase.
    pub phase: RpgScenePhase,
    /// Player leader name.
    pub leader_name: String,
    /// Player party level (synced with Save Editor).
    pub party_level: u32,
    /// Player locomotion controller (`CCharaMoveCtrl`).
    pub player: CharaMoveCtrl,
    /// Third-person chase camera.
    pub camera: WorldCamera,
    /// Zone NPCs.
    pub npcs: Vec<WorldNpc>,
    /// Functional map triggers (`MAP_FUNC_POINT_CONFIG`).
    pub func_points: Vec<MapFuncPointConfig>,
    /// Map interest markers (`MAP_INTEREST_POINT_CONFIG`).
    pub interest_points: Vec<MapInterestPointConfig>,
    /// Floating zone name tags (`MAP_NAME_TAG_CONFIG`).
    pub name_tags: Vec<MapNameTagConfig>,
    /// Kizuna Town customization state.
    pub kizuna: KizunaTownState,
    /// Active dialogue state `(npc_idx, line_idx)`.
    pub active_dialogue: Option<(usize, usize)>,
    /// Elapsed world ticks at 60 Hz.
    pub tick_count: u64,
    /// Matches won during this open-world session.
    pub matches_won: u32,
}

impl Default for OpenWorldState {
    fn default() -> Self {
        Self::new(WorldZoneId::Nagumohara)
    }
}

impl OpenWorldState {
    /// Initializes the open world in the requested `zone` with authentic `nie.exe` NPCs and map points.
    #[must_use]
    pub fn new(zone: WorldZoneId) -> Self {
        let mut state = Self {
            zone,
            phase: RpgScenePhase::Phase025,
            leader_name: "Unmei Sasanami".to_string(),
            party_level: 28,
            player: CharaMoveCtrl::at(Vec3::new(0.0, 0.0, -8.0)),
            camera: WorldCamera::default(),
            npcs: Vec::new(),
            func_points: Vec::new(),
            interest_points: Vec::new(),
            name_tags: Vec::new(),
            kizuna: KizunaTownState::default(),
            active_dialogue: None,
            tick_count: 0,
            matches_won: 0,
        };
        state.populate_zone(zone);
        state.camera.follow(state.player.position, 1.0);
        state
    }

    /// Switches to `zone`, spawning the player at the zone entry plaza and loading its entities.
    pub fn travel_to(&mut self, zone: WorldZoneId) {
        self.zone = zone;
        self.active_dialogue = None;
        self.player = CharaMoveCtrl::at(Vec3::new(0.0, 0.0, -12.0));
        self.populate_zone(zone);
        self.camera.follow(self.player.position, 1.0);
    }

    fn populate_zone(&mut self, zone: WorldZoneId) {
        let map_id = zone.map_id();
        self.npcs.clear();
        self.func_points.clear();
        self.interest_points.clear();
        self.name_tags.clear();

        match zone {
            WorldZoneId::Nagumohara => {
                self.npcs = vec![
                    WorldNpc {
                        chara_id: 101,
                        name: "Haru Endo".to_string(),
                        role: "Capitaine Raimon".to_string(),
                        element: ElementBadge::Fire,
                        ctrl: CharaMoveCtrl::at(Vec3::new(8.0, 0.0, 14.0)),
                        dialogue: vec![
                            "Unmei ! La brise marine de Nagumohara est parfaite pour s'entrainer."
                                .to_string(),
                            "Montre-moi la tactique de ton club sur un match complet !".to_string(),
                        ],
                        triggers_battle: true,
                        battle_team: Some("College Raimon".to_string()),
                    },
                    WorldNpc {
                        chara_id: 102,
                        name: "Sakurazaki Joji".to_string(),
                        role: "Attaquant Nagumohara".to_string(),
                        element: ElementBadge::Wind,
                        ctrl: CharaMoveCtrl::at(Vec3::new(-9.0, 0.0, 6.0)),
                        dialogue: vec![
                            "Le terrain cotier est libre. Mes frappes sont pretes.".to_string(),
                            "Direction la gare si tu veux rejoindre la Ville Kizuna ou Raimon."
                                .to_string(),
                        ],
                        triggers_battle: false,
                        battle_team: None,
                    },
                    WorldNpc {
                        chara_id: 103,
                        name: "Raika Shinohara".to_string(),
                        role: "Milieu Nagumohara".to_string(),
                        element: ElementBadge::Forest,
                        ctrl: CharaMoveCtrl::at(Vec3::new(11.0, 0.0, -3.0)),
                        dialogue: vec!["J'ai mis a jour nos formations sur Inacord.".to_string()],
                        triggers_battle: false,
                        battle_team: None,
                    },
                ];
                self.func_points = vec![
                    MapFuncPointConfig {
                        map_id,
                        point_id: 1,
                        func_type: MapFuncKind::ZonePortal as u32,
                        pos: Vec3::new(0.0, 0.0, 32.0),
                        radius: 4.5,
                    },
                    MapFuncPointConfig {
                        map_id,
                        point_id: 2,
                        func_type: MapFuncKind::FastTravel as u32,
                        pos: Vec3::new(-24.0, 0.0, 0.0),
                        radius: 4.5,
                    },
                    MapFuncPointConfig {
                        map_id,
                        point_id: 3,
                        func_type: MapFuncKind::SoccerBattle as u32,
                        pos: Vec3::new(22.0, 0.0, 10.0),
                        radius: 5.0,
                    },
                ];
                self.interest_points = vec![
                    MapInterestPointConfig {
                        map_id,
                        point_id: 10,
                        label_key: "Escalier Marin de Nagumohara".to_string(),
                        pos: Vec3::new(0.0, 0.0, -20.0),
                    },
                    MapInterestPointConfig {
                        map_id,
                        point_id: 11,
                        label_key: "Local du Club de Football".to_string(),
                        pos: Vec3::new(-16.0, 0.0, 12.0),
                    },
                ];
                self.name_tags = vec![MapNameTagConfig {
                    map_id,
                    tag_key: "Gare vers Ville Kizuna".to_string(),
                    pos: Vec3::new(0.0, 2.5, 32.0),
                }];
            }
            WorldZoneId::Raimon => {
                self.npcs = vec![
                    WorldNpc {
                        chara_id: 201,
                        name: "Mamoru Endo".to_string(),
                        role: "Legende Raimon".to_string(),
                        element: ElementBadge::Mountain,
                        ctrl: CharaMoveCtrl::at(Vec3::new(0.0, 0.0, 15.0)),
                        dialogue: vec![
                            "Bienvenue sur le terrain de la riviere ! Jouons au football !"
                                .to_string(),
                        ],
                        triggers_battle: true,
                        battle_team: Some("Raimon Legendes".to_string()),
                    },
                    WorldNpc {
                        chara_id: 202,
                        name: "Shuuya Gouenji".to_string(),
                        role: "Buteur de Feu".to_string(),
                        element: ElementBadge::Fire,
                        ctrl: CharaMoveCtrl::at(Vec3::new(14.0, 0.0, 8.0)),
                        dialogue: vec![
                            "La Tornade de Feu ne pardonne aucune hesitation.".to_string(),
                        ],
                        triggers_battle: false,
                        battle_team: None,
                    },
                ];
                self.func_points = vec![
                    MapFuncPointConfig {
                        map_id,
                        point_id: 1,
                        func_type: MapFuncKind::ZonePortal as u32,
                        pos: Vec3::new(0.0, 0.0, 30.0),
                        radius: 4.5,
                    },
                    MapFuncPointConfig {
                        map_id,
                        point_id: 2,
                        func_type: MapFuncKind::SoccerBattle as u32,
                        pos: Vec3::new(-18.0, 0.0, 12.0),
                        radius: 5.0,
                    },
                ];
                self.name_tags = vec![MapNameTagConfig {
                    map_id,
                    tag_key: "Portail Stade Odaiba".to_string(),
                    pos: Vec3::new(0.0, 2.5, 30.0),
                }];
            }
            WorldZoneId::KizunaTown => {
                self.npcs = vec![WorldNpc {
                    chara_id: 301,
                    name: "Terumi Afuro (Aphrody)".to_string(),
                    role: "Architecte Celeste".to_string(),
                    element: ElementBadge::Wind,
                    ctrl: CharaMoveCtrl::at(Vec3::new(0.0, 0.0, 8.0)),
                    dialogue: vec![
                        "La Ville Kizuna reflete l'harmonie de ton equipe.".to_string(),
                        "Place des monuments sur les socles lumineux ou affronte Zeus !"
                            .to_string(),
                    ],
                    triggers_battle: true,
                    battle_team: Some("College Zeus".to_string()),
                }];
                self.func_points = vec![
                    MapFuncPointConfig {
                        map_id,
                        point_id: 1,
                        func_type: MapFuncKind::KizunaSocket as u32,
                        pos: Vec3::new(-14.0, 0.0, 4.0),
                        radius: 4.5,
                    },
                    MapFuncPointConfig {
                        map_id,
                        point_id: 2,
                        func_type: MapFuncKind::KizunaSocket as u32,
                        pos: Vec3::new(14.0, 0.0, 4.0),
                        radius: 4.5,
                    },
                    MapFuncPointConfig {
                        map_id,
                        point_id: 3,
                        func_type: MapFuncKind::ZonePortal as u32,
                        pos: Vec3::new(0.0, 0.0, 28.0),
                        radius: 4.5,
                    },
                ];
                self.name_tags = vec![MapNameTagConfig {
                    map_id,
                    tag_key: "Retour Nagumohara".to_string(),
                    pos: Vec3::new(0.0, 2.5, 28.0),
                }];
            }
            WorldZoneId::OdaibaStadium => {
                self.npcs = vec![WorldNpc {
                    chara_id: 401,
                    name: "Yuuto Kidou".to_string(),
                    role: "Stratege Royal Academy".to_string(),
                    element: ElementBadge::Wind,
                    ctrl: CharaMoveCtrl::at(Vec3::new(0.0, 0.0, 16.0)),
                    dialogue: vec![
                        "Bienvenue au Stade National Football Frontier.".to_string(),
                        "Voyons si la vision tactique de Nagumohara surpasse la Royal Academy !"
                            .to_string(),
                    ],
                    triggers_battle: true,
                    battle_team: Some("Royal Academy".to_string()),
                }];
                self.func_points = vec![MapFuncPointConfig {
                    map_id,
                    point_id: 1,
                    func_type: MapFuncKind::ZonePortal as u32,
                    pos: Vec3::new(0.0, 0.0, -28.0),
                    radius: 4.5,
                }];
                self.name_tags = vec![MapNameTagConfig {
                    map_id,
                    tag_key: "Train vers Nagumohara".to_string(),
                    pos: Vec3::new(0.0, 2.5, -28.0),
                }];
            }
        }
    }

    /// Queries ground height `y` on a real `.g4nv` [`Navm`] mesh when loaded, falling back to `0.0`.
    #[must_use]
    pub fn sample_navmesh_height(navm: Option<&Navm>, x: f32, z: f32) -> f32 {
        let Some(mesh) = navm else {
            return 0.0;
        };
        let mut best_y = 0.0f32;
        let mut best_d2 = f32::MAX;
        for poly in &mesh.polygons {
            let dx = poly.center[0] - x;
            let dz = poly.center[2] - z;
            let d2 = dx * dx + dz * dz;
            if d2 <= poly.radius_sq.max(4.0) && d2 < best_d2 {
                best_d2 = d2;
                best_y = poly.center[1];
            }
        }
        best_y
    }

    /// Advances the open world by one deterministic 60 Hz tick (`TICK_DT`).
    pub fn step(&mut self, move_x: f32, move_z: f32, sprinting: bool) {
        self.step_with_navm(move_x, move_z, sprinting, None);
    }

    /// Advances the open world by one 60 Hz tick with optional `.g4nv` navmesh clamping.
    pub fn step_with_navm(
        &mut self,
        move_x: f32,
        move_z: f32,
        sprinting: bool,
        navm: Option<&Navm>,
    ) {
        self.tick_count += 1;

        // Freeze locomotion while reading a dialogue box
        if self.active_dialogue.is_some() {
            self.player.stop();
            self.camera.follow(self.player.position, TICK_DT);
            return;
        }

        // Camera-relative movement on the (x, z) ground plane
        let (sin_y, cos_y) = (self.camera.yaw.sin(), self.camera.yaw.cos());
        let world_dx = move_x * cos_y + move_z * sin_y;
        let world_dz = -move_x * sin_y + move_z * cos_y;

        self.player
            .apply_input(world_dx, world_dz, sprinting, TICK_DT);

        // Clamp to zone bounds & navmesh height
        let (half_w, half_d) = self.zone.half_extents();
        self.player.position.x = self.player.position.x.clamp(-half_w, half_w);
        self.player.position.z = self.player.position.z.clamp(-half_d, half_d);
        let ground_y =
            Self::sample_navmesh_height(navm, self.player.position.x, self.player.position.z);
        if self.player.position.y < ground_y {
            self.player.position.y = ground_y;
        }

        // Gentle idle facing for NPCs near the player
        for npc in &mut self.npcs {
            let dx = self.player.position.x - npc.ctrl.position.x;
            let dz = self.player.position.z - npc.ctrl.position.z;
            let d = (dx * dx + dz * dz).sqrt();
            if d > 0.2 && d < 8.0 {
                npc.ctrl.direction = Vec3::new(dx / d, 0.0, dz / d);
            }
            npc.ctrl.anim_state = MoveAnimState::Idle;
        }

        self.camera.follow(self.player.position, TICK_DT);
    }

    /// Computes the nearest actionable NPC or `MapFuncPointConfig` within interaction range.
    #[must_use]
    pub fn active_prompt(&self) -> Option<ProximityAction> {
        let px = self.player.position.x;
        let pz = self.player.position.z;

        // Check NPCs first (radius 3.8m)
        let mut best_npc: Option<(usize, f32)> = None;
        for (idx, npc) in self.npcs.iter().enumerate() {
            let dx = npc.ctrl.position.x - px;
            let dz = npc.ctrl.position.z - pz;
            let d = (dx * dx + dz * dz).sqrt();
            if d <= 3.8 && best_npc.is_none_or(|(_, b)| d < b) {
                best_npc = Some((idx, d));
            }
        }
        if let Some((idx, _)) = best_npc {
            let npc = &self.npcs[idx];
            return Some(ProximityAction::TalkNpc {
                npc_index: idx,
                speaker: npc.name.clone(),
                triggers_battle: npc.triggers_battle,
            });
        }

        // Check functional trigger points
        for fp in &self.func_points {
            let dx = fp.pos.x - px;
            let dz = fp.pos.z - pz;
            let d = (dx * dx + dz * dz).sqrt();
            if d <= fp.radius {
                return match fp.func_type {
                    x if x == MapFuncKind::ZonePortal as u32 => {
                        let next = match self.zone {
                            WorldZoneId::Nagumohara => WorldZoneId::KizunaTown,
                            WorldZoneId::KizunaTown => WorldZoneId::Nagumohara,
                            WorldZoneId::Raimon => WorldZoneId::OdaibaStadium,
                            WorldZoneId::OdaibaStadium => WorldZoneId::Nagumohara,
                        };
                        Some(ProximityAction::ZoneTransition {
                            target_zone: next,
                            label: next.title_fr().to_string(),
                        })
                    }
                    x if x == MapFuncKind::FastTravel as u32 => {
                        Some(ProximityAction::ZoneTransition {
                            target_zone: WorldZoneId::Raimon,
                            label: WorldZoneId::Raimon.title_fr().to_string(),
                        })
                    }
                    x if x == MapFuncKind::SoccerBattle as u32 => {
                        Some(ProximityAction::StartBattle {
                            opponent_name: "Selection Kyushu".to_string(),
                        })
                    }
                    x if x == MapFuncKind::KizunaSocket as u32 => {
                        Some(ProximityAction::KizunaCustomize {
                            socket_id: fp.point_id,
                        })
                    }
                    _ => None,
                };
            }
        }
        None
    }

    /// Executes the primary context interaction (`CMD_ENTER` / `E` / `A` button).
    pub fn interact(&mut self) -> InteractionOutcome {
        // Advance active dialogue if open
        if let Some((npc_idx, line_idx)) = self.active_dialogue {
            let Some(npc) = self.npcs.get(npc_idx) else {
                self.active_dialogue = None;
                return InteractionOutcome::DialogueEnded;
            };
            let next_line = line_idx + 1;
            if next_line < npc.dialogue.len() {
                self.active_dialogue = Some((npc_idx, next_line));
                return InteractionOutcome::Dialogue {
                    speaker: npc.name.clone(),
                    line: npc.dialogue[next_line].clone(),
                    line_index: next_line,
                    total_lines: npc.dialogue.len(),
                };
            }
            let battle_team = npc
                .triggers_battle
                .then(|| npc.battle_team.clone())
                .flatten();
            self.active_dialogue = None;
            if let Some(opponent_name) = battle_team {
                return InteractionOutcome::LaunchMatch { opponent_name };
            }
            return InteractionOutcome::DialogueEnded;
        }

        match self.active_prompt() {
            None => InteractionOutcome::None,
            Some(ProximityAction::TalkNpc { npc_index, .. }) => {
                if let Some(npc) = self.npcs.get(npc_index)
                    && let Some(first) = npc.dialogue.first()
                {
                    self.active_dialogue = Some((npc_index, 0));
                    return InteractionOutcome::Dialogue {
                        speaker: npc.name.clone(),
                        line: first.clone(),
                        line_index: 0,
                        total_lines: npc.dialogue.len(),
                    };
                }
                InteractionOutcome::None
            }
            Some(ProximityAction::ZoneTransition { target_zone, .. }) => {
                self.travel_to(target_zone);
                InteractionOutcome::ZoneChanged { zone: target_zone }
            }
            Some(ProximityAction::StartBattle { opponent_name }) => {
                InteractionOutcome::LaunchMatch { opponent_name }
            }
            Some(ProximityAction::KizunaCustomize { socket_id }) => {
                let (mesh_hash, label, bonus) =
                    KIZUNA_CATALOG[self.kizuna.catalog_index % KIZUNA_CATALOG.len()];
                self.kizuna.catalog_index = (self.kizuna.catalog_index + 1) % KIZUNA_CATALOG.len();
                let socket_pos = self
                    .func_points
                    .iter()
                    .find(|p| p.point_id == socket_id)
                    .map_or(self.player.position, |p| p.pos);
                if let Some(existing) = self
                    .kizuna
                    .placements
                    .iter_mut()
                    .find(|p| p.object_id == socket_id + 100)
                {
                    existing.mesh_hash = mesh_hash;
                } else {
                    self.kizuna.placements.push(MapPlacementConfig {
                        map_id: self.zone.map_id(),
                        object_id: socket_id + 100,
                        mesh_hash,
                        pos: socket_pos,
                        rot: Vec3::new(0.0, 0.0, 0.0),
                        scale: 1.0,
                    });
                }
                self.kizuna.kizuna_power += bonus;
                InteractionOutcome::KizunaPropUpdated {
                    socket_id,
                    object_name: label.trim().to_string(),
                    kizuna_power: self.kizuna.kizuna_power,
                }
            }
        }
    }

    /// Applies match completion rewards when returning from an 11v11 [`crate::World`] match.
    pub fn record_match_result(&mut self, home_goals: u32, away_goals: u32) {
        if home_goals >= away_goals {
            self.matches_won += 1;
            self.party_level = (self.party_level + 1).min(99);
            self.kizuna.kizuna_coins += 250 + home_goals * 50;
            self.kizuna.kizuna_power += 100;
            if self.phase == RpgScenePhase::Phase025 {
                self.phase = RpgScenePhase::Phase040;
            } else if self.phase == RpgScenePhase::Phase040 {
                self.phase = RpgScenePhase::Phase125;
            }
        } else {
            self.kizuna.kizuna_coins += 80;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_world_walks_interacts_and_launches_match() {
        let mut world = OpenWorldState::new(WorldZoneId::Nagumohara);
        assert_eq!(world.zone, WorldZoneId::Nagumohara);

        // Move toward Haru Endo at (8.0, 0.0, 14.0) from (0.0, 0.0, -8.0)
        for _ in 0..240 {
            let dx = 8.0 - world.player.position.x;
            let dz = 14.0 - world.player.position.z;
            world.step(dx, dz, true);
            if matches!(world.active_prompt(), Some(ProximityAction::TalkNpc { .. })) {
                break;
            }
        }

        assert!(matches!(
            world.active_prompt(),
            Some(ProximityAction::TalkNpc {
                triggers_battle: true,
                ..
            })
        ));

        let first = world.interact();
        assert!(matches!(
            first,
            InteractionOutcome::Dialogue { line_index: 0, .. }
        ));
        let second = world.interact();
        assert!(matches!(
            second,
            InteractionOutcome::Dialogue { line_index: 1, .. }
        ));
        let third = world.interact();
        assert!(matches!(third, InteractionOutcome::LaunchMatch { .. }));
    }

    #[test]
    fn kizuna_town_customizes_sockets_and_increases_power() {
        let mut world = OpenWorldState::new(WorldZoneId::KizunaTown);
        let initial_power = world.kizuna.kizuna_power;
        world.player.position = Vec3::new(-14.0, 0.0, 4.0);
        let res = world.interact();
        assert!(matches!(res, InteractionOutcome::KizunaPropUpdated { .. }));
        assert!(world.kizuna.kizuna_power > initial_power);
    }
}
