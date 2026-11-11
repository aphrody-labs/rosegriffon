//! Open-world character movement, RPG scene progression, map block lists, and
//! GDS map placement configurations ported from `nie.exe` (`game::CCharaMoveCtrl`,
//! `game::CSceneRpg`, `GDSMapPlacementConfig`, `iecode::level5::MapBlockList`).
//!
//! Coordinate convention in `aphrody-nie-core`: `y` is vertical height, `(x, z)` is
//! the horizontal ground plane — matching `game::CCharaMoveCtrl` in `nie.exe`.

use alloc::string::{String, ToString};
use alloc::vec::Vec;
use crate::Vec3;

/// Animation state driven by horizontal character velocity (`game::MoveAnimState`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[repr(u8)]
pub enum MoveAnimState {
    /// Stationary (`speed < 0.1`).
    #[default]
    Idle = 0,
    /// Walking (`speed < walk_speed * 0.9`).
    Walk = 1,
    /// Running (`speed < run_speed * 0.9`).
    Run = 2,
    /// Sprinting / Dashing (`speed >= run_speed * 0.9`).
    Dash = 3,
}

/// Action speed parameters (`game::CCharaActParam`).
#[derive(Debug, Clone, Copy, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CharaActParam {
    /// Base walking speed (m/s).
    pub walk_speed: f32,
    /// Standard running speed (m/s).
    pub run_speed: f32,
    /// Dash / sprint speed (m/s).
    pub sprint_speed: f32,
    /// Yaw turn rate in degrees per second.
    pub turn_speed: f32,
}

impl Default for CharaActParam {
    fn default() -> Self {
        Self {
            walk_speed: 3.0,
            run_speed: 6.0,
            sprint_speed: 9.0,
            turn_speed: 180.0,
        }
    }
}

/// Physical movement parameters (`game::CCharaMoveParam`).
#[derive(Debug, Clone, Copy, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CharaMoveParam {
    /// Horizontal acceleration factor.
    pub acceleration: f32,
    /// Horizontal deceleration rate (m/s^2).
    pub deceleration: f32,
    /// Vertical jump impulse (m/s).
    pub jump_force: f32,
    /// Vertical gravity (m/s^2, negative downward).
    pub gravity: f32,
}

impl Default for CharaMoveParam {
    fn default() -> Self {
        Self {
            acceleration: 10.0,
            deceleration: 15.0,
            jump_force: 5.0,
            gravity: -9.81,
        }
    }
}

/// Pathfinding waypoint (`game::Waypoint`).
#[derive(Debug, Clone, Copy, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Waypoint {
    /// World target position (`y` = height).
    pub position: Vec3,
    /// Validation radius in meters.
    pub radius: f32,
}

impl Waypoint {
    /// Creates a waypoint at `(x, y, z)` with default 0.5m radius.
    #[must_use]
    pub const fn new(x: f32, y: f32, z: f32) -> Self {
        Self {
            position: Vec3::new(x, y, z),
            radius: 0.5,
        }
    }
}

/// 3D character locomotion controller (`game::CCharaMoveCtrl`).
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CharaMoveCtrl {
    /// Current world position (`y` = height).
    pub position: Vec3,
    /// Current velocity vector (`m/s`).
    pub velocity: Vec3,
    /// Unit forward facing direction on the `(x, z)` plane.
    pub direction: Vec3,
    /// Current horizontal scalar speed (`m/s`).
    pub speed: f32,
    /// Maximum allowed speed (`m/s`).
    pub max_speed: f32,
    /// Whether the character is touching the ground/navmesh.
    pub is_grounded: bool,
    /// Whether active movement input or pathing is driving the character.
    pub is_moving: bool,
    /// Action speed thresholds.
    pub act_param: CharaActParam,
    /// Physics parameters.
    pub move_param: CharaMoveParam,
    /// Sequential path waypoints.
    pub waypoints: Vec<Waypoint>,
    /// Active index in `waypoints`.
    pub current_waypoint: usize,
    /// Direct target position when `has_target` is set.
    pub target_position: Vec3,
    /// Whether a target destination is active.
    pub has_target: bool,
    /// Current locomotion animation state.
    pub anim_state: MoveAnimState,
}

impl Default for CharaMoveCtrl {
    fn default() -> Self {
        Self {
            position: Vec3::new(0.0, 0.0, 0.0),
            velocity: Vec3::new(0.0, 0.0, 0.0),
            direction: Vec3::new(0.0, 0.0, 1.0),
            speed: 0.0,
            max_speed: 6.0,
            is_grounded: true,
            is_moving: false,
            act_param: CharaActParam::default(),
            move_param: CharaMoveParam::default(),
            waypoints: Vec::new(),
            current_waypoint: 0,
            target_position: Vec3::new(0.0, 0.0, 0.0),
            has_target: false,
            anim_state: MoveAnimState::Idle,
        }
    }
}

impl CharaMoveCtrl {
    /// Creates a character controller spawned at `pos`.
    #[must_use]
    pub fn at(pos: Vec3) -> Self {
        Self {
            position: pos,
            ..Self::default()
        }
    }

    /// Sets a direct target destination without intermediate waypoints.
    pub fn move_to(&mut self, target: Vec3) {
        self.target_position = target;
        self.has_target = true;
        self.waypoints.clear();
        self.current_waypoint = 0;
    }

    /// Assigns a sequential waypoint path.
    pub fn set_path(&mut self, path: Vec<Waypoint>) {
        self.waypoints = path;
        self.current_waypoint = 0;
        if !self.waypoints.is_empty() {
            self.has_target = true;
        }
    }

    /// Applies direct normalized stick/keyboard directional input `(dx, dz)` on the ground plane.
    pub fn apply_input(&mut self, dx: f32, dz: f32, sprinting: bool, dt: f32) {
        if dt <= 0.0 {
            return;
        }
        self.waypoints.clear();
        self.current_waypoint = 0;
        self.has_target = false;

        let mag = (dx * dx + dz * dz).sqrt();
        if mag > 0.01 {
            self.direction = Vec3::new(dx / mag, 0.0, dz / mag);
            self.is_moving = true;
            self.max_speed = if sprinting {
                self.act_param.sprint_speed
            } else {
                self.act_param.run_speed
            };
            self.speed += self.act_param.walk_speed * self.move_param.acceleration * dt;
            if self.speed > self.max_speed {
                self.speed = self.max_speed;
            }
        } else {
            self.is_moving = false;
        }
        self.integrate(dt, 0.0);
    }

    /// Integrates waypoint following, acceleration/deceleration, and ground clamping (`CCharaMoveCtrl::update`).
    pub fn update(&mut self, dt: f32) {
        self.update_with_ground(dt, 0.0);
    }

    /// Same as [`Self::update`], clamping vertical position against `ground_y` (from `.g4nv` navmesh).
    pub fn update_with_ground(&mut self, dt: f32, ground_y: f32) {
        if dt <= 0.0 {
            return;
        }

        if !self.waypoints.is_empty() && self.current_waypoint < self.waypoints.len() {
            let wp = self.waypoints[self.current_waypoint];
            self.target_position = wp.position;
            self.has_target = true;

            let dx = self.target_position.x - self.position.x;
            let dz = self.target_position.z - self.position.z;
            let dist = (dx * dx + dz * dz).sqrt();
            if dist < wp.radius {
                self.current_waypoint += 1;
                if self.current_waypoint >= self.waypoints.len() {
                    self.has_target = false;
                    self.is_moving = false;
                }
            }
        }

        if self.has_target {
            let dx = self.target_position.x - self.position.x;
            let dz = self.target_position.z - self.position.z;
            let horiz_dist = (dx * dx + dz * dz).sqrt();
            if horiz_dist > 0.01 {
                self.direction = Vec3::new(dx / horiz_dist, 0.0, dz / horiz_dist);
                self.is_moving = true;
                self.speed += self.act_param.walk_speed * self.move_param.acceleration * dt;
                if self.speed > self.max_speed {
                    self.speed = self.max_speed;
                }
            } else {
                self.has_target = false;
                self.is_moving = false;
            }
        }

        self.integrate(dt, ground_y);
    }

    fn integrate(&mut self, dt: f32, ground_y: f32) {
        if !self.is_moving && self.speed > 0.0 {
            self.speed = (self.speed - self.move_param.deceleration * dt).max(0.0);
        }

        self.velocity.x = self.direction.x * self.speed;
        self.velocity.z = self.direction.z * self.speed;

        if !self.is_grounded {
            self.velocity.y += self.move_param.gravity * dt;
        } else {
            self.velocity.y = 0.0;
        }

        self.position.x += self.velocity.x * dt;
        self.position.y += self.velocity.y * dt;
        self.position.z += self.velocity.z * dt;

        if self.position.y <= ground_y {
            self.position.y = ground_y;
            self.velocity.y = 0.0;
            self.is_grounded = true;
        }

        self.anim_state = self.compute_anim_state();
    }

    /// Triggers a vertical jump when grounded.
    pub fn jump(&mut self) {
        if self.is_grounded {
            self.velocity.y = self.move_param.jump_force;
            self.is_grounded = false;
        }
    }

    /// Halts movement and clears active waypoints (`CCharaMoveCtrl::stop`).
    pub fn stop(&mut self) {
        self.has_target = false;
        self.is_moving = false;
        self.speed = 0.0;
        self.velocity = Vec3::new(0.0, 0.0, 0.0);
        self.waypoints.clear();
        self.current_waypoint = 0;
        self.anim_state = MoveAnimState::Idle;
    }

    /// Computes the animation state matching current horizontal speed.
    #[must_use]
    pub fn compute_anim_state(&self) -> MoveAnimState {
        if self.speed < 0.1 {
            MoveAnimState::Idle
        } else if self.speed < self.act_param.walk_speed * 0.9 {
            MoveAnimState::Walk
        } else if self.speed < self.act_param.run_speed * 0.9 {
            MoveAnimState::Run
        } else {
            MoveAnimState::Dash
        }
    }

    /// Returns `true` when all targets and waypoints have been reached.
    #[must_use]
    pub fn has_reached_destination(&self) -> bool {
        if self.has_target {
            return false;
        }
        if !self.waypoints.is_empty() && self.current_waypoint < self.waypoints.len() {
            return false;
        }
        !self.is_moving
    }

    /// Yaw angle in radians on the `(x, z)` plane (`0` = `+z`).
    #[must_use]
    pub fn yaw_radians(&self) -> f32 {
        self.direction.x.atan2(self.direction.z)
    }
}

/// All 33 RPG story progression phases extracted from `game::CSceneRpg*` RTTI in `nie.exe`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[repr(u32)]
pub enum RpgScenePhase {
    /// Opening arrival at Nagumohara (South Cirrus).
    #[default]
    Phase010 = 10,
    /// School orientation & clubroom discovery.
    Phase020 = 20,
    /// First seaside pitch encounter.
    Phase025 = 25,
    /// Recruiting first members.
    Phase030 = 30,
    /// Baseball club turf negotiation.
    Phase040 = 40,
    /// Practice match preparation.
    Phase070 = 70,
    /// First Football Frontier preliminary notice.
    Phase080 = 80,
    /// Training camp unlock.
    Phase085 = 85,
    /// Regional qualifier kickoff.
    Phase090 = 90,
    /// Raimon Jr. High observation.
    Phase100 = 100,
    /// Mid-qualifier tactical briefing.
    Phase105 = 105,
    /// Kyushu bracket semifinals.
    Phase110 = 110,
    /// Kyushu bracket finals.
    Phase120 = 120,
    /// Interlude & Kizuna Link unlock.
    Phase125 = 125,
    /// National tournament departure.
    Phase130 = 130,
    /// Odaiba Harbor arrival.
    Phase140 = 140,
    /// National opening ceremony.
    Phase150 = 150,
    /// Group stage round 1.
    Phase160 = 160,
    /// Rival reconnaissance.
    Phase165 = 165,
    /// Group stage round 2.
    Phase170 = 170,
    /// Special hissatsu awakening.
    Phase175 = 175,
    /// Knockout round of 16.
    Phase180 = 180,
    /// Quarterfinal preparation.
    Phase190 = 190,
    /// Quarterfinal clash.
    Phase200 = 200,
    /// Semifinal eve at Nagumohara.
    Phase210 = 210,
    /// Semifinal match.
    Phase250 = 250,
    /// Final stadium entrenamiento.
    Phase300 = 300,
    /// Victory Road final pre-match.
    Phase310 = 310,
    /// Football Frontier Grand Final vs Raimon.
    Phase320 = 320,
    /// Epilogue chapter.
    Phase900 = 900,
    /// Credits & free-roam unlock.
    Phase910 = 910,
    /// Post-game Chronicle / Kizuna expansion.
    Post100 = 1100,
    /// Prologue flashback phase.
    Prev100 = 1200,
}

impl RpgScenePhase {
    /// Canonical ordered array of all 33 `CSceneRpg` phases.
    pub const ALL: [Self; 33] = [
        Self::Phase010,
        Self::Phase020,
        Self::Phase025,
        Self::Phase030,
        Self::Phase040,
        Self::Phase070,
        Self::Phase080,
        Self::Phase085,
        Self::Phase090,
        Self::Phase100,
        Self::Phase105,
        Self::Phase110,
        Self::Phase120,
        Self::Phase125,
        Self::Phase130,
        Self::Phase140,
        Self::Phase150,
        Self::Phase160,
        Self::Phase165,
        Self::Phase170,
        Self::Phase175,
        Self::Phase180,
        Self::Phase190,
        Self::Phase200,
        Self::Phase210,
        Self::Phase250,
        Self::Phase300,
        Self::Phase310,
        Self::Phase320,
        Self::Phase900,
        Self::Phase910,
        Self::Post100,
        Self::Prev100,
    ];

    /// Numeric phase ID stored in `CSceneRpg::phase_`.
    #[must_use]
    pub const fn code(self) -> u32 {
        self as u32
    }

    /// Resolves a numeric phase ID from save data or `cfg.bin`.
    #[must_use]
    pub const fn from_code(code: u32) -> Option<Self> {
        match code {
            10 => Some(Self::Phase010),
            20 => Some(Self::Phase020),
            25 => Some(Self::Phase025),
            30 => Some(Self::Phase030),
            40 => Some(Self::Phase040),
            70 => Some(Self::Phase070),
            80 => Some(Self::Phase080),
            85 => Some(Self::Phase085),
            90 => Some(Self::Phase090),
            100 => Some(Self::Phase100),
            105 => Some(Self::Phase105),
            110 => Some(Self::Phase110),
            120 => Some(Self::Phase120),
            125 => Some(Self::Phase125),
            130 => Some(Self::Phase130),
            140 => Some(Self::Phase140),
            150 => Some(Self::Phase150),
            160 => Some(Self::Phase160),
            165 => Some(Self::Phase165),
            170 => Some(Self::Phase170),
            175 => Some(Self::Phase175),
            180 => Some(Self::Phase180),
            190 => Some(Self::Phase190),
            200 => Some(Self::Phase200),
            210 => Some(Self::Phase210),
            250 => Some(Self::Phase250),
            300 => Some(Self::Phase300),
            310 => Some(Self::Phase310),
            320 => Some(Self::Phase320),
            900 => Some(Self::Phase900),
            910 => Some(Self::Phase910),
            1100 => Some(Self::Post100),
            1200 => Some(Self::Prev100),
            _ => None,
        }
    }

    /// French chapter objective label displayed in the RPG top-right objective window.
    #[must_use]
    pub const fn objective_label(self) -> &'static str {
        match self {
            Self::Phase010 => "Chapitre 1 : Explorer le college de Nagumohara",
            Self::Phase020 => "Chapitre 1 : Inspecter l'ancien local du club",
            Self::Phase025 => "Chapitre 1 : Rejoindre le terrain cotier",
            Self::Phase030 => "Chapitre 2 : Recruter les membres fondateurs",
            Self::Phase040 => "Chapitre 2 : Defi sur le terrain principal",
            Self::Phase070 => "Chapitre 3 : Preparation du match amical",
            Self::Phase080 => "Chapitre 3 : Annonce du tournoi Football Frontier",
            Self::Phase085 => "Chapitre 3 : Camp d'entrainement intensif",
            Self::Phase090 => "Chapitre 4 : Qualifications regionales",
            Self::Phase100 => "Chapitre 4 : Observation du college Raimon",
            Self::Phase120 => "Chapitre 5 : Finale regionale de Kyushu",
            Self::Phase125 => "Interlude : Station Kizuna ouverte",
            Self::Phase140 => "Chapitre 6 : Arrivee au stade d'Odaiba",
            Self::Phase320 => "Finale : Nagumohara contre Raimon",
            Self::Post100 => "Exploration libre : Route de la Victoire",
            _ => "Mode Histoire : Poursuivre l'objectif actif",
        }
    }
}

/// Placed prop/building entry on an RPG map (`GDSMapPlacementConfig`, `MAP_PLACEMENT_CONFIG`).
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct MapPlacementConfig {
    /// Owning map identifier.
    pub map_id: u32,
    /// Instance identifier.
    pub object_id: u32,
    /// CRC32 hash of the `.g4md` mesh asset.
    pub mesh_hash: u32,
    /// World position (`y` = height).
    pub pos: Vec3,
    /// Euler rotation in degrees.
    pub rot: Vec3,
    /// Uniform scale factor.
    pub scale: f32,
}

/// Functional trigger Kind on an open-world map (`GDSMapFuncPointConfig::func_type`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[repr(u32)]
pub enum MapFuncKind {
    /// Zone transition portal (`func_type = 1`).
    ZonePortal = 1,
    /// Fast travel beacon (`func_type = 2`).
    FastTravel = 2,
    /// Street soccer 5v5 / 11v11 battle trigger (`func_type = 3`).
    SoccerBattle = 3,
    /// Shop / equipment vendor (`func_type = 4`).
    Shop = 4,
    /// Kizuna Town customizable prop socket (`func_type = 5`).
    KizunaSocket = 5,
}

/// Functional trigger point on a map (`GDSMapFuncPointConfig`, `MAP_FUNC_POINT_CONFIG`).
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct MapFuncPointConfig {
    /// Owning map identifier.
    pub map_id: u32,
    /// Trigger point ID.
    pub point_id: u32,
    /// Trigger type (`1` = portal, `2` = fast travel, `3` = soccer battle, `4` = shop, `5` = kizuna).
    pub func_type: u32,
    /// World trigger center (`y` = height).
    pub pos: Vec3,
    /// Activation radius in meters.
    pub radius: f32,
}

/// Point of interest marker (`GDSMapInterestPointConfig`, `MAP_INTEREST_POINT_CONFIG`).
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct MapInterestPointConfig {
    /// Owning map identifier.
    pub map_id: u32,
    /// Marker ID.
    pub point_id: u32,
    /// Localization key or display label.
    pub label_key: String,
    /// World position (`y` = height).
    pub pos: Vec3,
}

/// Floating map name tag (`GDSMapNameTagConfig`, `MAP_NAME_TAG_CONFIG`).
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct MapNameTagConfig {
    /// Owning map identifier.
    pub map_id: u32,
    /// Localization key or display tag.
    pub tag_key: String,
    /// World position (`y` = height).
    pub pos: Vec3,
}

/// Single block entry inside a Level-5 map block script (`BLOCK CRC("bk01_w10i000"),0,21;`).
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct MapBlock {
    /// Name inside `CRC("...")`, e.g. `"bk01_w10i000"`.
    pub crc_name: String,
    /// First integer parameter.
    pub unk0: i32,
    /// Second integer parameter.
    pub unk1: i32,
}

/// Parsed `BLOCK_LIST_BEG .. BLOCK_LIST_END` map streaming table (`iecode::level5::MapBlockList`).
#[derive(Debug, Clone, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct MapBlockList {
    /// Count declared on the `BLOCK_LIST_BEG <N>;` header line.
    pub declared_count: i32,
    /// Parsed `BLOCK` entries.
    pub blocks: Vec<MapBlock>,
}

impl MapBlockList {
    /// Parses the first `BLOCK_LIST_BEG .. BLOCK_LIST_END` section from a Level-5 `.cfg` map text.
    #[must_use]
    pub fn parse(text: &str) -> Option<Self> {
        let mut in_list = false;
        let mut declared_count = 0i32;
        let mut blocks = Vec::new();

        for raw_line in text.lines() {
            let line = raw_line.trim();
            if line.is_empty() || line.starts_with("//") || line.starts_with('#') {
                continue;
            }
            if !in_list {
                if let Some(rest) = line.strip_prefix("BLOCK_LIST_BEG") {
                    let num_str = rest.trim().trim_end_matches(';').trim();
                    declared_count = num_str.parse::<i32>().unwrap_or(0);
                    in_list = true;
                }
                continue;
            }
            if line.starts_with("BLOCK_LIST_END") {
                return Some(Self {
                    declared_count,
                    blocks,
                });
            }
            if let Some(rest) = line.strip_prefix("BLOCK") {
                let body = rest.trim().trim_end_matches(';').trim();
                if let Some(crc_start) = body.find("CRC(\"") {
                    let after_quote = &body[crc_start + 5..];
                    if let Some(crc_end) = after_quote.find("\")") {
                        let crc_name = after_quote[..crc_end].to_string();
                        let tail = after_quote[crc_end + 2..].trim().trim_start_matches(',');
                        let mut parts = tail.split(',').map(str::trim);
                        let unk0 = parts.next().and_then(|s| s.parse::<i32>().ok()).unwrap_or(0);
                        let unk1 = parts.next().and_then(|s| s.parse::<i32>().ok()).unwrap_or(0);
                        blocks.push(MapBlock {
                            crc_name,
                            unk0,
                            unk1,
                        });
                    }
                }
            }
        }

        in_list.then_some(Self {
            declared_count,
            blocks,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chara_move_ctrl_follows_waypoints_and_updates_anim_state() {
        let mut ctrl = CharaMoveCtrl::at(Vec3::new(0.0, 0.0, 0.0));
        ctrl.set_path(alloc::vec![
            Waypoint::new(0.0, 0.0, 3.0),
            Waypoint::new(3.0, 0.0, 3.0),
        ]);

        for _ in 0..120 {
            ctrl.update(1.0 / 60.0);
        }

        assert!(ctrl.has_reached_destination());
        assert!((ctrl.position.x - 3.0).abs() < 0.6);
        assert!((ctrl.position.z - 3.0).abs() < 0.6);
    }

    #[test]
    fn rpg_scene_phase_roundtrips_all_33_phases() {
        assert_eq!(RpgScenePhase::ALL.len(), 33);
        for phase in RpgScenePhase::ALL {
            assert_eq!(RpgScenePhase::from_code(phase.code()), Some(phase));
            assert!(!phase.objective_label().is_empty());
        }
    }

    #[test]
    fn map_block_list_parses_level5_script() {
        let src = r#"
            BLOCK_LIST_BEG 2;
                BLOCK   CRC("bk01_w10i000"),0,21;
                BLOCK   CRC("bk00_w10i024"),2,1;
            BLOCK_LIST_END;
        "#;
        let parsed = MapBlockList::parse(src).expect("valid block list");
        assert_eq!(parsed.declared_count, 2);
        assert_eq!(parsed.blocks.len(), 2);
        assert_eq!(parsed.blocks[0].crc_name, "bk01_w10i000");
        assert_eq!(parsed.blocks[0].unk1, 21);
        assert_eq!(parsed.blocks[1].crc_name, "bk00_w10i024");
        assert_eq!(parsed.blocks[1].unk0, 2);
    }
}
