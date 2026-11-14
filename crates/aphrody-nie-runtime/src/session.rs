//! Une session de match pilotée à la manette, au-dessus de [`World`].
//!
//! [`World`] simule le football (22 joueurs, ballon, possession, buts). Cette couche y ajoute ce
//! que la joueuse commande et ce que l'écran montre : sprint et endurance, passe dirigée, tir
//! chargé, techniques Hissatsu payées en Tension, changement de joueur, duel Focus, Zone au
//! ralenti, pause, mi-temps et fin de match. Tout avance par pas fixe de [`TICK_DT`] et ne lit
//! que des [`PadFrame`] : deux sessions qui reçoivent les mêmes images restent identiques bit à
//! bit ([`MatchSession::state_hash`]).
//!
//! # Ce qui est une règle locale
//!
//! Les valeurs (coût d'une technique, durée de la Zone, règle du duel) sont celles de ce moteur.
//! Elles reproduisent la **forme** des mécaniques d'IEVR (une jauge qui se remplit en gardant le
//! ballon et se dépense en techniques, un duel à choix simultané, un ralenti devant les cages),
//! pas des constantes extraites de `nie.exe` : aucune n'a été mesurée dans le binaire.

use aphrody_nie_core::geom::{Vec2 as V2, Vec3 as V3};

use crate::open_world::{InteractionOutcome, OpenWorldState};
use crate::pad::{PadButton, PadFrame};
use crate::{FixedStep, GOAL_HALF, HALF_LEN, Role, TICK_DT, World};

/// Tension maximale d'une équipe.
pub const TENSION_MAX: f32 = 100.0;
/// Coût d'une frappe Hissatsu (`X` / Carré).
pub const HISSATSU_SHOT_COST: f32 = 50.0;
/// Coût d'une technique défensive Hissatsu (`Y` / Triangle).
pub const HISSATSU_BLOCK_COST: f32 = 30.0;
/// Tension gagnée par seconde de possession.
const TENSION_PER_POSSESSION_S: f32 = 6.0;
/// Tension gagnée par passe réussie.
const TENSION_PER_PASS: f32 = 8.0;
/// Tension gagnée en remportant un duel Focus.
const TENSION_PER_FOCUS_WIN: f32 = 15.0;
/// Multiplicateur de vitesse en sprint.
const SPRINT_SCALE: f32 = 1.4;
/// Endurance dépensée par seconde de sprint (sur 1.0).
const STAMINA_DRAIN_S: f32 = 0.22;
/// Endurance récupérée par seconde sans sprint.
const STAMINA_REGEN_S: f32 = 0.10;
/// Durée de la Zone, en temps de simulation.
pub const ZONE_DURATION_S: f32 = 6.0;
/// Facteur de ralenti du monde pendant la Zone.
pub const ZONE_TIME_SCALE: f32 = 0.5;
/// Fenêtre de choix d'un duel Focus.
pub const FOCUS_WINDOW_S: f32 = 2.5;
/// Distance d'engagement d'un duel Focus entre le porteur et un défenseur.
const FOCUS_TRIGGER_RADIUS: f32 = 2.2;
/// Délai minimal entre deux duels.
const FOCUS_COOLDOWN_S: f32 = 6.0;
/// Charge maximale d'un tir.
const SHOT_CHARGE_MAX_S: f32 = 1.0;
/// Puissance d'un tir à charge nulle et à charge pleine (m/s).
const SHOT_POWER: (f32, f32) = (20.0, 30.0);
/// Puissance d'une frappe Hissatsu (m/s).
const HISSATSU_POWER: f32 = 36.0;
/// Durée pendant laquelle une frappe Hissatsu réduit la parade du gardien.
const HISSATSU_KEEPER_S: f32 = 1.4;
/// Portée de parade restante face à une frappe Hissatsu.
const HISSATSU_KEEPER_REACH: f32 = 0.35;
/// Distance au but adverse en deçà de laquelle une frappe Hissatsu est permise.
const HISSATSU_RANGE: f32 = 32.0;
/// Portée d'une technique défensive Hissatsu.
const HISSATSU_BLOCK_RADIUS: f32 = 3.5;
/// Verrou de reprise du frappeur après une passe ou un tir.
const KICK_RELEASE_S: f32 = 0.30;
/// Durée d'une mi-temps par défaut, en secondes de simulation.
pub const DEFAULT_HALF_LENGTH_S: f32 = 300.0;
/// Pause de mi-temps.
const HALF_TIME_BREAK_S: f32 = 3.0;
/// Durée d'affichage du bandeau de but.
const GOAL_BANNER_S: f32 = 2.5;
/// Nombre d'entrées du menu Pause (cf. `aphrody_nie_ui::match_hud`).
pub const PAUSE_ITEMS: u8 = 4;

/// Choix d'un duel Focus, lu sur le stick au moment de valider.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FocusChoice {
    /// Déborder par la gauche.
    Left,
    /// Passer en force, droit devant.
    Through,
    /// Déborder par la droite.
    Right,
}

impl FocusChoice {
    /// Choix correspondant à une direction de stick (`x` dominant = côté, sinon force).
    #[must_use]
    pub fn from_stick(x: f32, y: f32) -> Self {
        if x.abs() > 0.5 && x.abs() >= y.abs() {
            if x < 0.0 { Self::Left } else { Self::Right }
        } else {
            Self::Through
        }
    }

    fn from_seed(seed: u32) -> Self {
        match seed % 3 {
            0 => Self::Left,
            1 => Self::Through,
            _ => Self::Right,
        }
    }
}

/// Un duel Focus en cours : le monde est figé jusqu'à sa résolution.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FocusBattle {
    /// Porteur du ballon.
    pub attacker: usize,
    /// Défenseur engagé.
    pub defender: usize,
    /// Temps restant pour choisir.
    pub remaining: f32,
    /// Choix de la joueuse, une fois validé.
    pub user_choice: Option<FocusChoice>,
    /// Choix de l'IA adverse, tiré au déclenchement (déterministe).
    pub ai_choice: FocusChoice,
}

impl FocusBattle {
    /// La joueuse attaque-t-elle (son équipe porte le ballon) ?
    #[must_use]
    pub fn user_attacks(&self, world: &World) -> bool {
        world
            .players
            .get(self.attacker)
            .is_some_and(|p| p.team == 0)
    }
}

/// Phase de la session.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MatchPhase {
    /// Jeu en cours.
    Playing,
    /// Menu Pause ouvert, `index` = entrée surlignée.
    Paused {
        /// Entrée surlignée (`0..PAUSE_ITEMS`).
        index: u8,
    },
    /// Duel Focus en cours.
    Focus(FocusBattle),
    /// Pause de mi-temps.
    HalfTime {
        /// Temps restant avant la reprise.
        remaining: f32,
    },
    /// Match terminé.
    FullTime,
}

/// Technique déclenchée, pour le bandeau du HUD et la file audio de l'hôte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HissatsuKind {
    /// Frappe spéciale.
    Shot,
    /// Technique défensive.
    Block,
}

/// Ce qui vient de se produire, consommé par l'hôte (sons, bandeaux, retour au menu).
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MatchEvent {
    /// But de `team`.
    Goal {
        /// Équipe qui marque.
        team: u8,
    },
    /// Passe de `from` vers `to`.
    Pass {
        /// Passeur.
        from: usize,
        /// Receveur visé.
        to: usize,
    },
    /// Tir de `team` à `power` m/s.
    Shot {
        /// Équipe qui tire.
        team: u8,
        /// Vitesse imprimée au ballon.
        power: f32,
    },
    /// Technique Hissatsu de `team`.
    Hissatsu {
        /// Équipe.
        team: u8,
        /// Nature de la technique.
        kind: HissatsuKind,
        /// Réussite (une technique défensive peut échouer, hors de portée).
        success: bool,
    },
    /// La joueuse contrôle désormais `index`.
    PlayerSwitched {
        /// Index du joueur.
        index: usize,
    },
    /// Un duel Focus commence.
    FocusStart,
    /// Le duel est résolu.
    FocusResolved {
        /// L'attaquant garde le ballon.
        attacker_won: bool,
    },
    /// La Zone commence.
    ZoneStart,
    /// La Zone se termine.
    ZoneEnd,
    /// Menu Pause ouvert.
    Paused,
    /// Menu Pause fermé.
    Resumed,
    /// Changement d'angle de caméra demandé depuis la pause.
    CameraCycled,
    /// Coup d'envoi relancé depuis la pause.
    KickoffRestarted,
    /// Retour au menu principal demandé depuis la pause.
    QuitRequested,
    /// Mi-temps.
    HalfTime,
    /// Fin du match.
    FullTime,
}

/// Session de match complète.
#[derive(Debug, Clone)]
pub struct MatchSession {
    /// Le monde simulé.
    pub world: World,
    /// Phase courante.
    pub phase: MatchPhase,
    /// Tension `[domicile, extérieur]`, `0..=TENSION_MAX`.
    pub tension: [f32; 2],
    /// Endurance de chaque joueur, `0..=1`, indexée comme `world.players`.
    pub stamina: Vec<f32>,
    /// Mi-temps courante (`1` ou `2`).
    pub half: u8,
    /// Durée d'une mi-temps (s).
    pub half_length_s: f32,
    /// Temps de Zone restant (`0` = hors Zone).
    pub zone_remaining: f32,
    /// Charge du tir en cours (`None` = bouton relâché).
    pub shot_charge: Option<f32>,
    /// Technique affichée et son temps d'affichage restant.
    pub hissatsu_banner: Option<(HissatsuKind, f32)>,
    /// Temps d'affichage restant du bandeau de but, et l'équipe qui a marqué.
    pub goal_banner: Option<(u8, f32)>,
    focus_cooldown: f32,
    hissatsu_keeper: f32,
    pending_pass: Option<usize>,
    clock: FixedStep,
    events: Vec<MatchEvent>,
}

impl Default for MatchSession {
    fn default() -> Self {
        Self::new(DEFAULT_HALF_LENGTH_S)
    }
}

impl MatchSession {
    /// Nouvelle session au coup d'envoi, mi-temps de `half_length_s` secondes.
    #[must_use]
    pub fn new(half_length_s: f32) -> Self {
        let world = World::kickoff();
        let n = world.players.len();
        Self {
            world,
            phase: MatchPhase::Playing,
            tension: [0.0, 0.0],
            stamina: vec![1.0; n],
            half: 1,
            half_length_s: if half_length_s.is_finite() && half_length_s > 0.0 {
                half_length_s
            } else {
                DEFAULT_HALF_LENGTH_S
            },
            zone_remaining: 0.0,
            shot_charge: None,
            hissatsu_banner: None,
            goal_banner: None,
            focus_cooldown: FOCUS_COOLDOWN_S,
            hissatsu_keeper: 0.0,
            pending_pass: None,
            clock: FixedStep::default(),
            events: Vec::new(),
        }
    }

    /// Joueur que la joueuse contrôle.
    #[must_use]
    pub fn controlled(&self) -> Option<usize> {
        self.world.controlled()
    }

    /// Événements produits depuis le dernier appel, dans l'ordre.
    pub fn drain_events(&mut self) -> Vec<MatchEvent> {
        std::mem::take(&mut self.events)
    }

    /// La Zone est-elle active ?
    #[must_use]
    pub fn in_zone(&self) -> bool {
        self.zone_remaining > 0.0
    }

    /// Endurance du joueur contrôlé (`1.0` si aucun).
    #[must_use]
    pub fn controlled_stamina(&self) -> f32 {
        self.controlled()
            .and_then(|i| self.stamina.get(i).copied())
            .unwrap_or(1.0)
    }

    /// Secondes de jeu écoulées depuis le début du match.
    #[must_use]
    pub fn match_seconds(&self) -> f32 {
        self.world.time
    }

    /// Absorbe `wall_dt` secondes d'horloge et exécute les pas fixes correspondants.
    ///
    /// Les fronts de `pad` ne sont appliqués qu'au **premier** pas : un appui ne doit pas être lu
    /// deux fois parce que l'image d'affichage a duré deux pas. Rend le nombre de pas exécutés.
    pub fn frame(&mut self, wall_dt: f32, pad: &PadFrame) -> u32 {
        let steps = self.clock.advance(wall_dt);
        for k in 0..steps {
            if k == 0 {
                self.tick(pad);
            } else {
                self.tick(&pad.held_only());
            }
        }
        steps
    }

    /// Un pas de simulation de [`TICK_DT`], déterministe.
    pub fn tick(&mut self, pad: &PadFrame) {
        match self.phase {
            MatchPhase::Playing => self.tick_playing(pad),
            MatchPhase::Paused { index } => self.tick_paused(index, pad),
            MatchPhase::Focus(battle) => self.tick_focus(battle, pad),
            MatchPhase::HalfTime { remaining } => {
                let r = remaining - TICK_DT;
                if r <= 0.0 {
                    self.half = 2;
                    self.world.restart_kickoff();
                    self.phase = MatchPhase::Playing;
                } else {
                    self.phase = MatchPhase::HalfTime { remaining: r };
                }
            }
            MatchPhase::FullTime => {
                if pad.just_pressed(PadButton::Start) || pad.just_pressed(PadButton::South) {
                    self.events.push(MatchEvent::QuitRequested);
                }
            }
        }
        self.tick_banners();
    }

    fn tick_banners(&mut self) {
        if let Some((k, t)) = self.hissatsu_banner {
            self.hissatsu_banner = (t > TICK_DT).then_some((k, t - TICK_DT));
        }
        if let Some((team, t)) = self.goal_banner {
            self.goal_banner = (t > TICK_DT).then_some((team, t - TICK_DT));
        }
    }

    fn tick_paused(&mut self, index: u8, pad: &PadFrame) {
        if pad.just_pressed(PadButton::Start) || pad.just_pressed(PadButton::East) {
            self.phase = MatchPhase::Playing;
            self.events.push(MatchEvent::Resumed);
            return;
        }
        let mut index = index;
        if pad.just_pressed(PadButton::DpadUp) {
            index = (index + PAUSE_ITEMS - 1) % PAUSE_ITEMS;
        }
        if pad.just_pressed(PadButton::DpadDown) {
            index = (index + 1) % PAUSE_ITEMS;
        }
        if pad.just_pressed(PadButton::South) {
            match index {
                0 => {
                    self.phase = MatchPhase::Playing;
                    self.events.push(MatchEvent::Resumed);
                    return;
                }
                1 => self.events.push(MatchEvent::CameraCycled),
                2 => {
                    self.world.restart_kickoff();
                    self.phase = MatchPhase::Playing;
                    self.events.push(MatchEvent::KickoffRestarted);
                    return;
                }
                _ => {
                    self.events.push(MatchEvent::QuitRequested);
                    return;
                }
            }
        }
        self.phase = MatchPhase::Paused { index };
    }

    fn tick_playing(&mut self, pad: &PadFrame) {
        if pad.just_pressed(PadButton::Start) {
            self.phase = MatchPhase::Paused { index: 0 };
            self.shot_charge = None;
            self.events.push(MatchEvent::Paused);
            return;
        }

        let (mx, my) = pad.movement();
        // Écran : x vers la droite = vers le but adverse (+x monde) ; y vers le haut = -y monde
        // (la caméra de retransmission regarde le terrain depuis la touche +y, cf. `match3d`).
        let dir = V2::new(mx, -my);
        self.world.input.dir = if dir.len() > 1.0 { dir.norm() } else { dir };
        self.world.input.shoot = false;

        if pad.just_pressed(PadButton::L1) {
            self.switch_player();
        }
        if pad.just_pressed(PadButton::R1) {
            self.try_start_zone();
        }

        let controlled = self.controlled();
        let has_ball = controlled.is_some() && self.world.possessor() == controlled;

        // Sprint et endurance.
        let sprinting = pad.is_held(PadButton::R2)
            && controlled.is_some_and(|i| self.stamina.get(i).is_some_and(|s| *s > 0.0))
            && self.world.input.dir.len() > 0.01;
        for (i, s) in self.stamina.iter_mut().enumerate() {
            if sprinting && Some(i) == controlled {
                *s = (*s - STAMINA_DRAIN_S * TICK_DT).max(0.0);
            } else {
                *s = (*s + STAMINA_REGEN_S * TICK_DT).min(1.0);
            }
        }
        let zone_boost = if self.in_zone() {
            1.0 / ZONE_TIME_SCALE
        } else {
            1.0
        };
        self.world.speed_scale[0] = if sprinting { SPRINT_SCALE } else { 1.0 } * zone_boost;

        // Actions balle au pied.
        if let Some(c) = controlled.filter(|_| has_ball) {
            if pad.just_pressed(PadButton::South) {
                self.pass_from(c);
            } else if pad.just_pressed(PadButton::West) {
                self.hissatsu_shot(c);
            } else {
                self.handle_shot_charge(c, pad);
            }
        } else if let Some(c) = controlled.filter(|_| self.shot_charge.is_some()) {
            // Le ballon dribblé peut sortir un instant du rayon de contrôle : la charge tient tant
            // que l'adversaire ne l'a pas pris, et le tir part si le ballon est encore au pied.
            let lost = self
                .world
                .possessor()
                .is_some_and(|p| self.world.players[p].team != 0);
            let near = (self.world.players[c].pos - self.world.ball.pos.ground()).len() < 2.5;
            if lost || (!near && !pad.is_held(PadButton::East)) {
                self.shot_charge = None;
            } else {
                self.handle_shot_charge(c, pad);
            }
        } else {
            self.shot_charge = None;
            if pad.just_pressed(PadButton::North) {
                self.hissatsu_block();
            }
        }

        // Simulation, au ralenti pendant la Zone.
        let score_before = self.world.score;
        let possessor_before = self.world.possessor();
        let dt = if self.in_zone() {
            TICK_DT * ZONE_TIME_SCALE
        } else {
            TICK_DT
        };
        self.world.step(dt);

        self.after_step(score_before, possessor_before);
    }

    fn after_step(&mut self, score_before: [u32; 2], possessor_before: Option<usize>) {
        // Buts.
        for team in 0..2u8 {
            if self.world.score[team as usize] > score_before[team as usize] {
                self.events.push(MatchEvent::Goal { team });
                self.goal_banner = Some((team, GOAL_BANNER_S));
                self.end_zone();
                self.world.control_override = [None, None];
                self.pending_pass = None;
                self.shot_charge = None;
            }
        }

        // Passe reçue : la Tension récompense la passe arrivée, pas la passe tentée.
        let possessor = self.world.possessor();
        if let (Some(target), Some(p)) = (self.pending_pass, possessor) {
            if p == target {
                self.add_tension(0, TENSION_PER_PASS);
                self.pending_pass = None;
            } else if self.world.players.get(p).is_some_and(|q| q.team != 0) {
                self.pending_pass = None;
            }
        }
        // Le joueur imposé n'a plus de raison d'être si l'adversaire récupère le ballon.
        if possessor != possessor_before
            && let Some(p) = possessor
        {
            let team = self.world.players[p].team;
            self.world.control_override[usize::from(1 - team)] = None;
        }

        // Tension de possession.
        if let Some(p) = possessor {
            let team = self.world.players[p].team;
            if !(team == 0 && self.in_zone()) {
                self.add_tension(team, TENSION_PER_POSSESSION_S * TICK_DT);
            }
        }

        // Zone : la jauge se vide sur sa durée.
        if self.in_zone() {
            self.zone_remaining -= TICK_DT;
            self.tension[0] = (TENSION_MAX * self.zone_remaining / ZONE_DURATION_S).max(0.0);
            if self.zone_remaining <= 0.0 {
                self.end_zone();
            }
        }

        // Fin de l'effet Hissatsu sur le gardien.
        if self.hissatsu_keeper > 0.0 {
            self.hissatsu_keeper -= TICK_DT;
            if self.hissatsu_keeper <= 0.0 {
                self.world.keeper_reach = [1.0, 1.0];
            }
        }

        // Duel Focus.
        if self.focus_cooldown > 0.0 {
            self.focus_cooldown -= TICK_DT;
        } else if let Some(battle) = self.detect_focus() {
            self.phase = MatchPhase::Focus(battle);
            self.shot_charge = None;
            self.events.push(MatchEvent::FocusStart);
            return;
        }

        // Horloge de match.
        let limit = self.half_length_s * f32::from(self.half);
        if self.world.time >= limit {
            self.end_zone();
            if self.half == 1 {
                self.phase = MatchPhase::HalfTime {
                    remaining: HALF_TIME_BREAK_S,
                };
                self.events.push(MatchEvent::HalfTime);
            } else {
                self.phase = MatchPhase::FullTime;
                self.events.push(MatchEvent::FullTime);
            }
        }
    }

    fn add_tension(&mut self, team: u8, amount: f32) {
        let t = &mut self.tension[usize::from(team.min(1))];
        *t = (*t + amount).clamp(0.0, TENSION_MAX);
    }

    fn end_zone(&mut self) {
        if self.zone_remaining > 0.0 {
            self.zone_remaining = 0.0;
            self.tension[0] = 0.0;
            self.world.speed_scale[0] = 1.0;
            self.events.push(MatchEvent::ZoneEnd);
        }
    }

    fn try_start_zone(&mut self) {
        if !self.in_zone() && self.tension[0] >= TENSION_MAX {
            self.zone_remaining = ZONE_DURATION_S;
            self.events.push(MatchEvent::ZoneStart);
        }
    }

    /// Passe le contrôle au coéquipier suivant, par distance croissante au ballon.
    ///
    /// Sans effet quand l'équipe porte le ballon : le porteur reste contrôlé.
    fn switch_player(&mut self) {
        let possessor = self.world.possessor();
        if possessor.is_some_and(|p| self.world.players[p].team == 0) {
            return;
        }
        let ball = self.world.ball.pos.ground();
        let mut team: Vec<(usize, f32)> = self
            .world
            .players
            .iter()
            .enumerate()
            .filter(|(_, p)| p.team == 0 && p.role != Role::Goalkeeper)
            .map(|(i, p)| (i, (p.pos - ball).len()))
            .collect();
        team.sort_by(|a, b| a.1.total_cmp(&b.1).then(a.0.cmp(&b.0)));
        if team.is_empty() {
            return;
        }
        let current = self.controlled();
        let pos = current.and_then(|c| team.iter().position(|(i, _)| *i == c));
        let next = team[pos.map_or(0, |p| (p + 1) % team.len())].0;
        self.world.control_override[0] = Some(next);
        self.events.push(MatchEvent::PlayerSwitched { index: next });
    }

    /// Choisit le receveur dans la direction du stick (celle de l'attaque si le stick est neutre).
    fn pass_target(&self, from: usize) -> Option<usize> {
        let p = self.world.players.get(from)?;
        let attack = if p.team == 0 { 1.0 } else { -1.0 };
        let aim = if self.world.input.dir.len() > 0.2 {
            self.world.input.dir.norm()
        } else {
            V2::new(attack, 0.0)
        };
        let mut best: Option<(f32, usize)> = None;
        for (i, q) in self.world.players.iter().enumerate() {
            if i == from || q.team != p.team {
                continue;
            }
            let v = q.pos - p.pos;
            let d = v.len();
            if !(2.0..=45.0).contains(&d) {
                continue;
            }
            let cos = (v.x * aim.x + v.y * aim.y) / d;
            if cos < 0.3 {
                continue;
            }
            let score = d * (1.6 - cos);
            if best.is_none_or(|(s, _)| score < s) {
                best = Some((score, i));
            }
        }
        best.map(|(_, i)| i)
    }

    fn pass_from(&mut self, from: usize) {
        let Some(to) = self.pass_target(from) else {
            return;
        };
        let a = self.world.ball.pos.ground();
        // Passe en avant du receveur : il court vers sa cible, la balle doit l'y retrouver.
        let b = self.world.players[to].pos + self.world.players[to].vel * 0.3;
        let v = b - a;
        let d = v.len().max(0.01);
        let speed = (d * 1.4 + 6.0).clamp(9.0, 24.0);
        let dir = v * (1.0 / d);
        self.world.kick_from(
            from,
            V3::new(dir.x * speed, dir.y * speed, 0.6),
            KICK_RELEASE_S,
        );
        self.world.control_override[0] = Some(to);
        self.pending_pass = Some(to);
        self.events.push(MatchEvent::Pass { from, to });
    }

    fn handle_shot_charge(&mut self, from: usize, pad: &PadFrame) {
        if pad.just_pressed(PadButton::East) {
            self.shot_charge = Some(0.0);
        } else if let Some(c) = self.shot_charge {
            if pad.is_held(PadButton::East) {
                self.shot_charge = Some((c + TICK_DT).min(SHOT_CHARGE_MAX_S));
            } else {
                let t = c / SHOT_CHARGE_MAX_S;
                let power = SHOT_POWER.0 + (SHOT_POWER.1 - SHOT_POWER.0) * t;
                self.shoot(from, power, 2.0 + 3.0 * t);
                self.shot_charge = None;
            }
        }
    }

    /// Vise le but adverse, décalé latéralement par le stick.
    fn shot_velocity(&self, from: usize, power: f32, loft: f32) -> V3 {
        let p = &self.world.players[from];
        let goal_x = if p.team == 0 { HALF_LEN } else { -HALF_LEN };
        let side = self.world.input.dir.y.clamp(-1.0, 1.0);
        let target = V2::new(goal_x, side * GOAL_HALF * 0.8);
        let dir = (target - self.world.ball.pos.ground()).norm();
        V3::new(dir.x * power, dir.y * power, loft)
    }

    fn shoot(&mut self, from: usize, power: f32, loft: f32) {
        let vel = self.shot_velocity(from, power, loft);
        let team = self.world.players[from].team;
        self.world.kick_from(from, vel, KICK_RELEASE_S);
        self.pending_pass = None;
        self.events.push(MatchEvent::Shot { team, power });
    }

    fn hissatsu_shot(&mut self, from: usize) {
        let team = self.world.players[from].team;
        let goal_x = if team == 0 { HALF_LEN } else { -HALF_LEN };
        let in_range = (self.world.ball.pos.x - goal_x).abs() < HISSATSU_RANGE;
        if self.tension[usize::from(team)] < HISSATSU_SHOT_COST || !in_range {
            return;
        }
        self.add_tension(team, -HISSATSU_SHOT_COST);
        let vel = self.shot_velocity(from, HISSATSU_POWER, 1.2);
        self.world.kick_from(from, vel, KICK_RELEASE_S);
        self.world.keeper_reach[usize::from(1 - team)] = HISSATSU_KEEPER_REACH;
        self.hissatsu_keeper = HISSATSU_KEEPER_S;
        self.hissatsu_banner = Some((HissatsuKind::Shot, 2.0));
        self.events.push(MatchEvent::Hissatsu {
            team,
            kind: HissatsuKind::Shot,
            success: true,
        });
        self.events.push(MatchEvent::Shot {
            team,
            power: HISSATSU_POWER,
        });
    }

    fn hissatsu_block(&mut self) {
        if self.tension[0] < HISSATSU_BLOCK_COST {
            return;
        }
        let Some(me) = self.controlled() else {
            return;
        };
        let Some(carrier) = self.world.possessor() else {
            return;
        };
        if self.world.players[carrier].team == 0 {
            return;
        }
        self.add_tension(0, -HISSATSU_BLOCK_COST);
        let d = (self.world.players[carrier].pos - self.world.players[me].pos).len();
        let success = d <= HISSATSU_BLOCK_RADIUS;
        if success {
            self.world.award_ball(me);
        }
        self.hissatsu_banner = Some((HissatsuKind::Block, 2.0));
        self.events.push(MatchEvent::Hissatsu {
            team: 0,
            kind: HissatsuKind::Block,
            success,
        });
    }

    /// Un défenseur adverse au contact du porteur engage un duel, une seule paire à la fois.
    fn detect_focus(&self) -> Option<FocusBattle> {
        let carrier = self.world.possessor()?;
        let cp = self.world.players[carrier];
        // Seuls les duels qui impliquent la joueuse sont joués ; l'IA contre l'IA reste à la
        // simulation, sinon le match se figerait sans que personne ne puisse choisir.
        let user = self.controlled()?;
        let (defender, d) = self
            .world
            .players
            .iter()
            .enumerate()
            .filter(|(_, p)| p.team != cp.team && p.role != Role::Goalkeeper)
            .map(|(i, p)| (i, (p.pos - cp.pos).len()))
            .min_by(|a, b| a.1.total_cmp(&b.1))?;
        if d > FOCUS_TRIGGER_RADIUS || (carrier != user && defender != user) {
            return None;
        }
        Some(FocusBattle {
            attacker: carrier,
            defender,
            remaining: FOCUS_WINDOW_S,
            user_choice: None,
            ai_choice: FocusChoice::from_seed(self.world.state_hash()),
        })
    }

    fn tick_focus(&mut self, mut battle: FocusBattle, pad: &PadFrame) {
        if battle.user_choice.is_none() && pad.just_pressed(PadButton::South) {
            let (x, y) = pad.movement();
            battle.user_choice = Some(FocusChoice::from_stick(x, y));
        }
        battle.remaining -= TICK_DT;
        if battle.user_choice.is_none() && battle.remaining > 0.0 {
            self.phase = MatchPhase::Focus(battle);
            return;
        }
        // Règle du duel : l'attaquant passe si le défenseur ne lit pas son choix. Ne pas choisir
        // à temps, c'est perdre son duel.
        let user_attacks = battle.user_attacks(&self.world);
        let read = battle.user_choice == Some(battle.ai_choice);
        let attacker_won = if user_attacks {
            battle.user_choice.is_some() && !read
        } else {
            !read
        };
        let winner = if attacker_won {
            battle.attacker
        } else {
            battle.defender
        };
        let loser = if attacker_won {
            battle.defender
        } else {
            battle.attacker
        };
        self.world.award_ball(winner);
        // Le perdant est écarté de deux mètres : sans cela il reprendrait le duel au pas suivant.
        let push = self.world.players[loser].pos - self.world.players[winner].pos;
        let push = if push.len() > 0.01 {
            push.norm()
        } else {
            V2::new(0.0, 1.0)
        };
        self.world.players[loser].pos = self.world.players[loser].pos + push * 2.0;
        let winner_team = self.world.players[winner].team;
        self.add_tension(winner_team, TENSION_PER_FOCUS_WIN);
        self.focus_cooldown = FOCUS_COOLDOWN_S;
        self.phase = MatchPhase::Playing;
        self.events.push(MatchEvent::FocusResolved { attacker_won });
    }

    /// Hachage de l'état complet : monde, jauges, phase.
    #[must_use]
    pub fn state_hash(&self) -> u32 {
        let mut h = self.world.state_hash();
        let mut feed = |v: u32| {
            h ^= v;
            h = h.wrapping_mul(0x0100_0193);
        };
        feed(self.tension[0].to_bits());
        feed(self.tension[1].to_bits());
        feed(self.zone_remaining.to_bits());
        feed(self.focus_cooldown.to_bits());
        feed(u32::from(self.half));
        for s in &self.stamina {
            feed(s.to_bits());
        }
        feed(match self.phase {
            MatchPhase::Playing => 1,
            MatchPhase::Paused { index } => 0x100 | u32::from(index),
            MatchPhase::Focus(b) => 0x200 | (b.attacker as u32) << 4 | b.defender as u32,
            MatchPhase::HalfTime { remaining } => remaining.to_bits(),
            MatchPhase::FullTime => 4,
        });
        h
    }
}

/// Avance l'exploration d'un pas à partir d'une image manette.
///
/// Stick gauche (ou croix) pour marcher, `R2` pour courir, bouton sud pour interagir avec ce
/// que [`OpenWorldState::active_prompt`] propose. Rend l'issue de l'interaction s'il y en a une.
pub fn step_open_world(state: &mut OpenWorldState, pad: &PadFrame) -> Option<InteractionOutcome> {
    let (x, y) = pad.movement();
    // Écran → monde : haut du stick = vers l'avant de la caméra (-z dans `open_world`).
    state.step(x, -y, pad.is_held(PadButton::R2));
    if pad.just_pressed(PadButton::South) && state.active_prompt().is_some() {
        Some(state.interact())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn press(b: PadButton) -> PadFrame {
        PadFrame {
            held: b.bit(),
            pressed: b.bit(),
            ..PadFrame::default()
        }
    }

    fn hold(b: PadButton) -> PadFrame {
        PadFrame {
            held: b.bit(),
            ..PadFrame::default()
        }
    }

    /// Donne le ballon au joueur contrôlé, au milieu du terrain.
    fn porteur(s: &mut MatchSession) -> usize {
        let c = s
            .world
            .players
            .iter()
            .position(|p| p.team == 0 && p.role == Role::Midfielder)
            .unwrap();
        s.world.players[c].pos = V2::new(-30.0, 0.0);
        s.world.award_ball(c);
        s.world.control_override[0] = Some(c);
        s.focus_cooldown = 1000.0;
        c
    }

    #[test]
    fn deux_sessions_identiques_restent_identiques() {
        let script: Vec<PadFrame> = (0..600)
            .map(|i| PadFrame {
                left: (((i / 40) % 3) as f32 - 1.0, 0.3),
                held: if i % 90 < 30 { PadButton::R2.bit() } else { 0 },
                pressed: match i % 150 {
                    10 => PadButton::South.bit(),
                    70 => PadButton::L1.bit(),
                    _ => 0,
                },
                ..PadFrame::default()
            })
            .collect();
        let mut a = MatchSession::new(60.0);
        let mut b = MatchSession::new(60.0);
        for f in &script {
            a.tick(f);
            b.tick(f);
        }
        assert_eq!(a.state_hash(), b.state_hash());
        assert_eq!(a.drain_events(), b.drain_events());
    }

    #[test]
    fn le_sprint_accelere_et_vide_lendurance() {
        let mut s = MatchSession::new(600.0);
        let c = porteur(&mut s);
        s.world.ball.pos.z = 5.0; // pas de dribble : on mesure la course seule
        let pad = PadFrame {
            left: (0.0, 1.0),
            held: PadButton::R2.bit(),
            ..PadFrame::default()
        };
        let y0 = s.world.players[c].pos.y;
        s.tick(&pad);
        let sprint = y0 - s.world.players[c].pos.y;
        assert!(
            (sprint - 7.0 * SPRINT_SCALE * TICK_DT).abs() < 1e-4,
            "{sprint}"
        );
        assert!(s.stamina[c] < 1.0);
        s.stamina[c] = 0.0;
        let y1 = s.world.players[c].pos.y;
        s.tick(&pad);
        let marche = y1 - s.world.players[c].pos.y;
        assert!(
            (marche - 7.0 * TICK_DT).abs() < 1e-4,
            "sans endurance : {marche}"
        );
    }

    #[test]
    fn la_passe_part_vers_un_coequipier_et_le_controle_le_suit() {
        let mut s = MatchSession::new(600.0);
        let c = porteur(&mut s);
        s.tick(&press(PadButton::South));
        let ev = s.drain_events();
        let Some(MatchEvent::Pass { from, to }) = ev.first().copied() else {
            panic!("pas de passe : {ev:?}");
        };
        assert_eq!(from, c);
        assert_eq!(s.world.players[to].team, 0);
        assert_eq!(s.controlled(), Some(to), "le contrôle passe au receveur");
        // Le passeur ne reprend pas le ballon au pas suivant.
        s.tick(&PadFrame::default());
        assert_ne!(s.world.possessor(), Some(c));
    }

    #[test]
    fn le_tir_charge_frappe_plus_fort() {
        let mesurer = |charge_ticks: usize| {
            let mut s = MatchSession::new(600.0);
            porteur(&mut s);
            let stick = (1.0, 0.0);
            s.tick(&PadFrame {
                left: stick,
                ..press(PadButton::East)
            });
            for _ in 0..charge_ticks {
                s.tick(&PadFrame {
                    left: stick,
                    ..hold(PadButton::East)
                });
            }
            s.tick(&PadFrame {
                left: stick,
                released: PadButton::East.bit(),
                ..PadFrame::default()
            });
            s.drain_events()
                .into_iter()
                .find_map(|e| match e {
                    MatchEvent::Shot { power, .. } => Some(power),
                    _ => None,
                })
                .expect("tir")
        };
        let court = mesurer(1);
        let long = mesurer(90);
        assert!(long > court, "{long} > {court}");
        assert!((long - SHOT_POWER.1).abs() < 1e-3);
    }

    #[test]
    fn hissatsu_exige_la_tension_et_la_depense() {
        let mut s = MatchSession::new(600.0);
        let c = porteur(&mut s);
        s.world.players[c].pos = V2::new(30.0, 0.0);
        s.world.award_ball(c);
        s.tick(&press(PadButton::West));
        assert!(
            !s.drain_events()
                .iter()
                .any(|e| matches!(e, MatchEvent::Hissatsu { .. })),
            "sans tension, pas de technique"
        );
        s.world.award_ball(c);
        s.tension[0] = 80.0;
        s.tick(&press(PadButton::West));
        let ev = s.drain_events();
        assert!(ev.iter().any(|e| matches!(
            e,
            MatchEvent::Hissatsu {
                kind: HissatsuKind::Shot,
                ..
            }
        )));
        assert!(s.tension[0] < 80.0 - HISSATSU_SHOT_COST + 1.0);
        assert!(
            s.world.keeper_reach[1] < 1.0,
            "le gardien adverse est affaibli"
        );
        assert!(s.hissatsu_banner.is_some());
    }

    #[test]
    fn la_zone_ralentit_le_monde_et_vide_la_jauge() {
        let mut s = MatchSession::new(600.0);
        s.tension[0] = TENSION_MAX;
        s.focus_cooldown = 1000.0;
        let t0 = s.world.time;
        s.tick(&press(PadButton::R1));
        assert!(s.in_zone());
        assert!(s.drain_events().contains(&MatchEvent::ZoneStart));
        assert!((s.world.time - t0 - TICK_DT * ZONE_TIME_SCALE).abs() < 1e-6);
        for _ in 0..((ZONE_DURATION_S / TICK_DT) as usize + 2) {
            s.tick(&PadFrame::default());
        }
        assert!(!s.in_zone());
        assert_eq!(s.tension[0], 0.0);
    }

    #[test]
    fn la_pause_fige_le_monde_et_le_menu_se_parcourt() {
        let mut s = MatchSession::new(600.0);
        s.tick(&press(PadButton::Start));
        assert_eq!(s.phase, MatchPhase::Paused { index: 0 });
        let h = s.world.state_hash();
        s.tick(&press(PadButton::DpadDown));
        s.tick(&press(PadButton::DpadDown));
        s.tick(&press(PadButton::DpadDown));
        assert_eq!(s.phase, MatchPhase::Paused { index: 3 });
        assert_eq!(s.world.state_hash(), h, "rien ne bouge en pause");
        s.tick(&press(PadButton::South));
        assert!(s.drain_events().contains(&MatchEvent::QuitRequested));
    }

    #[test]
    fn changer_de_joueur_parcourt_lequipe_sans_le_gardien() {
        let mut s = MatchSession::new(600.0);
        s.world.ball.pos = V3::new(-20.0, 10.0, 3.0);
        let mut vus = std::collections::BTreeSet::new();
        for _ in 0..10 {
            s.tick(&press(PadButton::L1));
            if let Some(c) = s.controlled() {
                assert_eq!(s.world.players[c].team, 0);
                assert_ne!(s.world.players[c].role, Role::Goalkeeper);
                vus.insert(c);
            }
        }
        assert!(vus.len() >= 5, "{vus:?}");
    }

    #[test]
    fn un_duel_focus_se_declenche_et_se_resout() {
        let mut s = MatchSession::new(600.0);
        let c = porteur(&mut s);
        let def = s
            .world
            .players
            .iter()
            .position(|p| p.team == 1 && p.role == Role::Defender)
            .unwrap();
        s.world.players[def].pos = V2::new(-28.5, 0.0);
        s.focus_cooldown = 0.0;
        s.world.ball.pos.z = 0.11;
        s.tick(&PadFrame::default());
        let MatchPhase::Focus(b) = s.phase else {
            panic!("pas de duel : {:?}", s.phase);
        };
        assert_eq!(b.attacker, c);
        // Choix différent de celui de l'IA : l'attaquant passe.
        let choix = [FocusChoice::Left, FocusChoice::Through, FocusChoice::Right]
            .into_iter()
            .find(|x| *x != b.ai_choice)
            .unwrap();
        let stick = match choix {
            FocusChoice::Left => (-1.0, 0.0),
            FocusChoice::Right => (1.0, 0.0),
            FocusChoice::Through => (0.0, 1.0),
        };
        s.tick(&PadFrame {
            left: stick,
            held: PadButton::South.bit(),
            pressed: PadButton::South.bit(),
            ..PadFrame::default()
        });
        assert_eq!(s.phase, MatchPhase::Playing);
        assert!(
            s.drain_events()
                .contains(&MatchEvent::FocusResolved { attacker_won: true })
        );
        assert_eq!(s.world.possessor(), Some(c));
    }

    #[test]
    fn un_duel_sans_choix_est_perdu() {
        let mut s = MatchSession::new(600.0);
        let c = porteur(&mut s);
        let def = s
            .world
            .players
            .iter()
            .position(|p| p.team == 1 && p.role == Role::Defender)
            .unwrap();
        s.world.players[def].pos = V2::new(-28.5, 0.0);
        s.focus_cooldown = 0.0;
        s.tick(&PadFrame::default());
        assert!(matches!(s.phase, MatchPhase::Focus(_)));
        for _ in 0..((FOCUS_WINDOW_S / TICK_DT) as usize + 3) {
            s.tick(&PadFrame::default());
        }
        assert_eq!(s.phase, MatchPhase::Playing);
        assert_eq!(s.world.possessor(), Some(def));
        let _ = c;
    }

    #[test]
    fn mi_temps_puis_fin_de_match() {
        let mut s = MatchSession::new(1.0);
        s.focus_cooldown = 1e9;
        let mut ev = Vec::new();
        for _ in 0..(60 * 8) {
            s.tick(&PadFrame::default());
            ev.extend(s.drain_events());
        }
        assert!(ev.contains(&MatchEvent::HalfTime));
        assert!(ev.contains(&MatchEvent::FullTime));
        assert_eq!(s.phase, MatchPhase::FullTime);
        assert_eq!(s.half, 2);
    }

    #[test]
    fn frame_napplique_un_appui_quune_fois() {
        let mut s = MatchSession::new(600.0);
        let n = s.frame(TICK_DT * 3.0, &press(PadButton::Start));
        assert_eq!(n, 3);
        // Start au premier pas ouvre la pause ; les pas suivants ne la referment pas.
        assert!(matches!(s.phase, MatchPhase::Paused { .. }));
    }

    #[test]
    fn lexploration_se_pilote_a_la_manette() {
        let mut ow = OpenWorldState::default();
        let p0 = ow.player.position.x;
        for _ in 0..30 {
            step_open_world(
                &mut ow,
                &PadFrame {
                    left: (1.0, 0.0),
                    ..PadFrame::default()
                },
            );
        }
        assert!((ow.player.position.x - p0).abs() > 0.01);
    }
}
