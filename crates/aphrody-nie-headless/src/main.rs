//! `aphrody-nie-headless` — runner CLI headless pour les formats IEVR et la simulation de match.
//!
//! ## Sous-commandes
//!
//! ```text
//! aphrody-nie-headless detect <FICHIER> [--indent N]
//! aphrody-nie-headless menu <FICHIER> [--indent N]
//! aphrody-nie-headless match [--home NOM] [--away NOM] [--seed N] [--home-stats Kc:Cr:Tc:Pr:Ps:Ag:It] [--away-stats ...]
//! ```
//!
//! ### `detect`
//!
//! Prend un fichier extrait du jeu, détecte son format et affiche un résumé JSON
//! sur stdout.
//!
//! ### `match`
//!
//! Simule un match de football complet (kickoff → 90 minutes → résultat) de façon
//! déterministe et affiche le score en 1 ligne terse (`clé=val`).
//!
//! ### `menu`
//!
//! Lit une définition `*_menu_setting.cfg.bin` ou son JSON `entries`, puis affiche les
//! compteurs et invariants de navigation issus de `aphrody-nie-data`. Le chemin peut être un fichier
//! local ou un chemin logique du VFS (`data/common/...`).
//!
//! Les stats par défaut sont les stats FW UR lv99 confirmées depuis les tables de
//! croissance embarquées de aphrody-nie-core (golden test `growth::golden_fw_ur`) :
//! `Kc=207 Cr=216 Tc=218 Pr=235 Ps=242 Ag=210 It=261`.

#![forbid(unsafe_code)]
#![allow(clippy::pedantic)]

use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use serde::Serialize;
use serde_json::Value;

use aphrody_nie_core::{
    match_sim::{TeamSetup, simulate_match},
    stats::StatBlock,
};
use aphrody_nie_formats::cfgbin;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/// Runner headless IEVR — détecte un format ou simule un match de football.
#[derive(Debug, Parser)]
#[command(name = "aphrody-nie-headless", version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    commande: Commande,
}

/// Sous-commandes disponibles.
#[derive(Debug, Subcommand)]
enum Commande {
    /// Détecte le format d'un fichier et affiche un résumé JSON.
    ///
    /// Formats reconnus : CRILAYLA, @UTF, CPK, cfg.bin (RDBN).
    Detect {
        /// Chemin vers le fichier à analyser.
        fichier: PathBuf,
        /// Indentation JSON (0 = compact, N = lisible avec N espaces de base).
        #[arg(long, default_value = "2")]
        indent: usize,
    },
    /// Résume une définition typée d'écran de menu (`cfg.bin` ou JSON `entries`).
    Menu {
        /// Fichier local, ou chemin logique VFS, `*_menu_setting.cfg.bin` / JSON `entries`.
        fichier: PathBuf,
        /// Indentation JSON (0 = compact, N = lisible avec N espaces de base).
        #[arg(long, default_value = "2")]
        indent: usize,
    },
    /// Simule un match de football complet (headless, déterministe).
    ///
    /// Affiche sur stdout : `home=<NOM> away=<NOM> résultat=<H>-<A> horloge=<CLOCK>`
    /// (1 ligne terse). Les détails sont accessibles via `RUST_LOG=debug`.
    ///
    /// Les stats par défaut sont FW UR lv99 — confirmées sur les vraies tables
    /// de croissance IEVR embarquées dans aphrody-nie-core (voir `growth::golden_fw_ur`).
    #[command(name = "match")]
    SimulerMatch {
        /// Nom de l'équipe domicile.
        #[arg(long, default_value = "Equipe-A")]
        home: String,
        /// Nom de l'équipe visiteuse.
        #[arg(long, default_value = "Equipe-B")]
        away: String,
        /// Graine PRNG pour le déterminisme (même graine → même résultat).
        #[arg(long, default_value = "42")]
        seed: u64,
        /// Stats domicile au format `Kc:Cr:Tc:Pr:Ps:Ag:It` (7 entiers séparés par `:`).
        ///
        /// Si absent, utilise les stats FW UR lv99 des tables réelles IEVR.
        #[arg(long)]
        home_stats: Option<String>,
        /// Stats visiteur au format `Kc:Cr:Tc:Pr:Ps:Ag:It`.
        ///
        /// Si absent, utilise les stats FW UR lv99 des tables réelles IEVR.
        #[arg(long)]
        away_stats: Option<String>,
    },
    /// Edits or boots an IEVR save file headlessly.
    SaveEdit {
        /// Input save file path.
        #[arg(long, default_value = "002AB8F4-USERDATALIVE")]
        file: PathBuf,
        /// Output save file path.
        #[arg(long)]
        out: Option<PathBuf>,
        /// Slot name.
        #[arg(long, default_value = "002AB8F4-USERDATALIVE")]
        slot: String,
        /// Set player level.
        #[arg(long)]
        level: Option<u32>,
        /// Set coins amount.
        #[arg(long)]
        coins: Option<u32>,
        /// Mock genuine container if input is missing.
        #[arg(long, default_value_t = true)]
        mock_if_missing: bool,
    },
    /// Captures all game menu screens (boot, title, main_menu, save_editor, match_ui, formation) as PNG sequence + timeline manifest.
    CaptureMenus {
        /// Directory where frames and timeline.json will be written.
        #[arg(long, default_value = "capture_frames")]
        out_dir: PathBuf,
        /// Frame width in pixels.
        #[arg(long, default_value = "1280")]
        width: u32,
        /// Frame height in pixels.
        #[arg(long, default_value = "720")]
        height: u32,
        /// Number of animation frames per screen.
        #[arg(long, default_value = "10")]
        frames_per_menu: u32,
        /// Sequence framerate (FPS).
        #[arg(long, default_value = "30")]
        fps: u32,
    },
    /// Dumps memory map and raw binary core of nie.exe / save manager runtime.
    MemoryDump {
        /// Binary dump output path.
        #[arg(long, default_value = "nie_memory_dump.bin")]
        out_bin: PathBuf,
        /// Structured JSON memory map output path.
        #[arg(long, default_value = "nie_memory_map.json")]
        out_json: PathBuf,
        /// Slot name for SaveManager simulation.
        #[arg(long, default_value = "002AB8F4-USERDATALIVE")]
        slot: String,
    },
    /// Runs full headless pipeline: save editor run + memory dump + menu frame capture.
    Pipeline {
        /// Working / output directory.
        #[arg(long, default_value = "headless_out")]
        out_dir: PathBuf,
        /// Slot name.
        #[arg(long, default_value = "002AB8F4-USERDATALIVE")]
        slot: String,
    },
    /// Starts the cross-platform open world simulation with pixel-perfect design system rendering.
    OpenWorld {
        /// Initial zone (nagumohara, raimon, kizuna-town, odaiba-stadium).
        #[arg(long, default_value = "nagumohara")]
        zone: String,
        /// Number of simulation ticks to run (at 60 Hz).
        #[arg(long, default_value = "120")]
        ticks: u32,
        /// Output directory for rendered frames and session state.
        #[arg(long, default_value = "target/open_world_sim")]
        out_dir: PathBuf,
    },
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.commande {
        Commande::Detect { fichier, indent } => cmd_detect(fichier, indent),
        Commande::Menu { fichier, indent } => cmd_menu(fichier, indent),
        Commande::SimulerMatch {
            home,
            away,
            seed,
            home_stats,
            away_stats,
        } => cmd_match(home, away, seed, home_stats, away_stats),
        Commande::SaveEdit {
            file,
            out,
            slot,
            level,
            coins,
            mock_if_missing,
        } => cmd_save_edit(file, out, slot, level, coins, mock_if_missing),
        Commande::CaptureMenus {
            out_dir,
            width,
            height,
            frames_per_menu,
            fps,
        } => cmd_capture_menus(out_dir, width, height, frames_per_menu, fps),
        Commande::MemoryDump {
            out_bin,
            out_json,
            slot,
        } => cmd_memory_dump(out_bin, out_json, slot),
        Commande::Pipeline { out_dir, slot } => cmd_pipeline(out_dir, slot),
        Commande::OpenWorld {
            zone,
            ticks,
            out_dir,
        } => cmd_open_world(zone, ticks, out_dir),
    }
}

// ---------------------------------------------------------------------------
// Sous-commande `menu`
// ---------------------------------------------------------------------------

/// Résumé stable d'une définition d'écran de menu.
#[derive(Debug, Serialize)]
struct MenuSummary {
    /// Chemin du fichier tel que passé en argument.
    path: String,
    /// Taille du fichier lu.
    bytes: usize,
    /// Nombre de layers composant l'écran.
    layers: usize,
    /// Nombre de ressources g4tx partagées.
    resources: usize,
    /// Nombre de commandes liées aux layers.
    commands: usize,
    /// Nombre d'états de groupe par layer.
    layer_groups: usize,
    /// Nombre de groupes nommés.
    groups: usize,
    /// Nombre d'éléments focusables.
    focus: usize,
    /// Identifiant CRC du layer interactif, s'il est déclaré.
    interactive_layer_id: Option<u32>,
    /// Invariant CRC32 des noms de layers.
    layer_hashes_consistent: bool,
    /// Invariant CRC32 des noms de groupes.
    group_hashes_consistent: bool,
}

/// Lit un fichier local, ou un chemin logique du VFS, et rend son nom et ses octets.
fn read_menu_source(path: &std::path::Path) -> Result<(String, Vec<u8>)> {
    if path.is_file() {
        let name = path.display().to_string();
        let bytes = std::fs::read(path).with_context(|| format!("impossible de lire '{name}'"))?;
        return Ok((name, bytes));
    }

    let requested = path.to_string_lossy().replace('\\', "/");
    let logical = if requested.starts_with("data/") {
        requested
    } else {
        format!("data/{requested}")
    };
    let vfs = aphrody_nie_formats::vfs::open_game()
        .with_context(|| format!("impossible de monter le VFS pour '{logical}'"))?;
    let bytes = vfs
        .read(&logical)
        .with_context(|| format!("fichier absent du VFS : '{logical}'"))?;
    Ok((logical, bytes))
}

/// Lit une définition menu binaire ou JSON et la résume avec le parseur typé.
fn cmd_menu(fichier: PathBuf, indent: usize) -> Result<()> {
    let (path, bytes) = read_menu_source(&fichier)?;
    let root = if fichier
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("json"))
    {
        serde_json::from_slice(&bytes).with_context(|| format!("JSON menu invalide : {path}"))?
    } else {
        cfgbin::to_iecode_json(&bytes)
            .ok_or_else(|| anyhow::anyhow!("cfg.bin menu invalide ou non T2B/RDBN : {path}"))?
    };
    let setting = aphrody_nie_data::menu_setting::parse(&root);
    let summary = MenuSummary {
        path,
        bytes: bytes.len(),
        layers: setting.layers.len(),
        resources: setting.resources.len(),
        commands: setting.commands.len(),
        layer_groups: setting.layer_groups.len(),
        groups: setting.groups.len(),
        focus: setting.focus_base_infos.len(),
        interactive_layer_id: setting.interactive_layer_id().map(|id| id.0),
        layer_hashes_consistent: setting.layer_hashes_consistent(),
        group_hashes_consistent: setting.group_hashes_consistent(),
    };
    let json = if indent == 0 {
        serde_json::to_string(&summary).context("sérialisation JSON")?
    } else {
        let formatter = serde_json::ser::PrettyFormatter::with_indent(b"  ");
        let mut output = Vec::new();
        let mut serializer = serde_json::Serializer::with_formatter(&mut output, formatter);
        summary
            .serialize(&mut serializer)
            .context("sérialisation JSON")?;
        String::from_utf8(output).context("UTF-8 JSON")?
    };
    println!("{json}");
    Ok(())
}

// ---------------------------------------------------------------------------
// Sous-commande `detect`
// ---------------------------------------------------------------------------

/// Résumé d'analyse d'un fichier.
#[derive(Debug, Serialize)]
struct Resume {
    /// Chemin du fichier tel que passé en argument.
    chemin: String,
    /// Taille en octets.
    taille_octets: u64,
    /// Nom court du format détecté (ex. `"CPK"`, `"CRILAYLA"`, `"?"`).
    format: String,
    /// Détails supplémentaires, spécifiques au format.
    detail: Value,
}

fn cmd_detect(fichier: PathBuf, indent: usize) -> Result<()> {
    let chemin_str = fichier.display().to_string();
    let donnees =
        std::fs::read(&fichier).with_context(|| format!("impossible de lire '{chemin_str}'"))?;

    let inspection = aphrody_nie_headless::inspect_bytes(&donnees)?;
    let format = inspection.format;
    let detail = legacy_detection_detail(&format, inspection.detail);

    let resume = Resume {
        chemin: chemin_str,
        taille_octets: inspection.byte_length as u64,
        format,
        detail,
    };

    let json = if indent == 0 {
        serde_json::to_string(&resume).context("sérialisation JSON")?
    } else {
        let formatter = serde_json::ser::PrettyFormatter::with_indent(b"  ");
        let mut buf = Vec::new();
        let mut ser = serde_json::Serializer::with_formatter(&mut buf, formatter);
        resume.serialize(&mut ser).context("sérialisation JSON")?;
        String::from_utf8(buf).context("UTF-8 JSON")?
    };

    println!("{json}");
    Ok(())
}

/// Keeps the established CLI JSON keys while the reusable library stays English.
fn legacy_detection_detail(format: &str, detail: Value) -> Value {
    match format {
        "CRILAYLA" => serde_json::json!({
            "taille_decompresse": detail["decompressedBytes"],
        }),
        "@UTF" | "CPK" => serde_json::json!({
            "nom_table": detail["tableName"],
            "colonnes": detail["columnCount"],
            "lignes": detail["rowCount"],
        }),
        "cfg.bin" => serde_json::json!({
            "version": detail["version"],
            "types": detail["typeCount"],
            "champs": detail["fieldCount"],
            "racines": detail["rootCount"],
        }),
        _ => serde_json::json!({}),
    }
}

// ---------------------------------------------------------------------------
// Sous-commande `match`
// ---------------------------------------------------------------------------

/// Stats FW UR lv99 par défaut — confirmées par `growth::tests::golden_fw_ur`
/// sur les tables de croissance réelles IEVR embarquées dans aphrody-nie-core.
///
/// `[Kc=207, Cr=216, Tc=218, Pr=235, Ps=242, Ag=210, It=261]`
fn stats_par_defaut() -> StatBlock {
    StatBlock::from_array([207, 216, 218, 235, 242, 210, 261])
}

/// Parse une chaîne `Kc:Cr:Tc:Pr:Ps:Ag:It` (7 entiers séparés par `:`) en `StatBlock`.
fn parse_stats(s: &str) -> Result<StatBlock> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 7 {
        anyhow::bail!(
            "format stats invalide : '{s}' — attendu 7 valeurs séparées par ':' (ex. 207:216:218:235:242:210:261)"
        );
    }
    let mut arr = [0u16; 7];
    for (i, part) in parts.iter().enumerate() {
        arr[i] = part
            .trim()
            .parse::<u16>()
            .with_context(|| format!("stat#{i} invalide : '{part}'"))?;
    }
    Ok(StatBlock::from_array(arr))
}

fn cmd_match(
    home_name: String,
    away_name: String,
    seed: u64,
    home_stats_str: Option<String>,
    away_stats_str: Option<String>,
) -> Result<()> {
    let home_stats = match home_stats_str {
        Some(s) => parse_stats(&s)?,
        None => stats_par_defaut(),
    };
    let away_stats = match away_stats_str {
        Some(s) => parse_stats(&s)?,
        None => stats_par_defaut(),
    };

    let home = TeamSetup::new(&home_name, home_stats);
    let away = TeamSetup::new(&away_name, away_stats);

    let res = simulate_match(home, away, seed);

    // Sortie terse (convention CLAUDE.md : 1 ligne clé=val)
    println!(
        "home={home_name} away={away_name} résultat={}-{} horloge={}",
        res.home_score, res.away_score, res.final_clock
    );
    Ok(())
}

// ---------------------------------------------------------------------------
// Sous-commandes headless pipeline (save, capture, memory dump)
// ---------------------------------------------------------------------------

fn cmd_save_edit(
    file: PathBuf,
    out: Option<PathBuf>,
    slot: String,
    level: Option<u32>,
    coins: Option<u32>,
    mock_if_missing: bool,
) -> Result<()> {
    let options = aphrody_nie_headless::SaveEditOptions {
        input_path: file,
        output_path: out,
        slot,
        player_level: level,
        coins,
        mock_if_missing,
    };
    let report = aphrody_nie_headless::execute_save_edit(&options)?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}

fn cmd_capture_menus(
    out_dir: PathBuf,
    width: u32,
    height: u32,
    frames_per_menu: u32,
    fps: u32,
) -> Result<()> {
    let options = aphrody_nie_headless::MenuCaptureOptions {
        output_dir: out_dir,
        width,
        height,
        frames_per_menu,
        fps,
        screens: aphrody_nie_headless::GameScreen::all().to_vec(),
    };
    let manifest = aphrody_nie_headless::capture_all_menus(&options)?;
    println!("{}", serde_json::to_string_pretty(&manifest)?);
    Ok(())
}

fn cmd_memory_dump(out_bin: PathBuf, out_json: PathBuf, slot: String) -> Result<()> {
    let options = aphrody_nie_headless::MemoryDumpOptions {
        output_bin: out_bin,
        output_json: Some(out_json),
        live_pid: None,
        target_pe: None,
        slot_name: slot,
    };
    let map = aphrody_nie_headless::execute_memory_dump(&options)?;
    println!("{}", serde_json::to_string_pretty(&map)?);
    Ok(())
}

fn cmd_pipeline(out_dir: PathBuf, slot: String) -> Result<()> {
    std::fs::create_dir_all(&out_dir)?;

    // 1. Save edit
    let save_path = out_dir.join(format!("{slot}.bin"));
    let save_report =
        aphrody_nie_headless::execute_save_edit(&aphrody_nie_headless::SaveEditOptions {
            input_path: save_path.clone(),
            output_path: Some(save_path.clone()),
            slot: slot.clone(),
            player_level: Some(99),
            coins: Some(999_999),
            mock_if_missing: true,
        })?;

    // 2. Memory dump
    let mem_bin = out_dir.join("nie_memory_dump.bin");
    let mem_json = out_dir.join("nie_memory_map.json");
    let mem_map =
        aphrody_nie_headless::execute_memory_dump(&aphrody_nie_headless::MemoryDumpOptions {
            output_bin: mem_bin,
            output_json: Some(mem_json),
            live_pid: None,
            target_pe: None,
            slot_name: slot.clone(),
        })?;

    // 3. Menu capture
    let frames_dir = out_dir.join("frames");
    let menu_manifest =
        aphrody_nie_headless::capture_all_menus(&aphrody_nie_headless::MenuCaptureOptions {
            output_dir: frames_dir,
            width: 1280,
            height: 720,
            frames_per_menu: 5,
            fps: 30,
            screens: aphrody_nie_headless::GameScreen::all().to_vec(),
        })?;

    let summary = serde_json::json!({
        "status": "success",
        "pipeline": "headless_nie_save_editor_and_menu_capture",
        "save_report": save_report,
        "memory_dump": {
            "base_address": format!("0x{:X}", mem_map.base_address),
            "entry_point": format!("0x{:X}", mem_map.entry_point),
            "total_dump_bytes": mem_map.total_dump_bytes,
            "region_count": mem_map.regions.len(),
            "save_manager_address": format!("0x{:X}", mem_map.save_manager.address),
        },
        "menu_capture": {
            "total_frames": menu_manifest.total_frames,
            "duration_seconds": menu_manifest.duration_seconds,
            "screens": menu_manifest.screens_captured,
            "clips_count": menu_manifest.filmcraft_clips.len(),
        }
    });

    println!("{}", serde_json::to_string_pretty(&summary)?);
    Ok(())
}

fn cmd_open_world(zone_str: String, ticks: u32, out_dir: PathBuf) -> Result<()> {
    use aphrody_nie_app::render::{Font, H, W, render_open_world};
    use aphrody_nie_runtime::open_world::{OpenWorldState, WorldZoneId};

    let zone = match zone_str.to_lowercase().as_str() {
        "raimon" | "w20" => WorldZoneId::Raimon,
        "kizuna" | "kizuna-town" | "kizuna_town" | "w30" => WorldZoneId::KizunaTown,
        "odaiba" | "odaiba-stadium" | "odaiba_stadium" | "w40" => WorldZoneId::OdaibaStadium,
        _ => WorldZoneId::Nagumohara,
    };

    std::fs::create_dir_all(&out_dir)?;

    let mut state = OpenWorldState::new(zone);
    let font = Font::default();

    // Run simulation ticks with active player movement and NPC interaction check
    let mut interactions = Vec::new();
    for i in 0..ticks {
        state.step(0.0, 1.0, false);
        if i == ticks / 3 || i == (2 * ticks) / 3 {
            let outcome = state.interact();
            if outcome != aphrody_nie_runtime::open_world::InteractionOutcome::None {
                interactions.push(format!("tick {i}: {outcome:?}"));
            }
        }
    }

    // Render frame with authentic pixel-perfect design system
    let frame = render_open_world(&state, &font);

    // Save PNG frame
    let frame_png_path = out_dir.join("open_world_frame.png");
    {
        let file = std::fs::File::create(&frame_png_path)?;
        let w = std::io::BufWriter::new(file);
        let mut encoder = png::Encoder::new(w, W as u32, H as u32);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header()?;
        writer.write_image_data(&frame.buf)?;
    }

    let summary = serde_json::json!({
        "status": "success",
        "action": "open_world_started",
        "zone": format!("{:?}", state.zone),
        "zone_title": state.zone.title_fr(),
        "map_code": state.zone.map_code(),
        "player": {
            "leader": state.leader_name,
            "party_level": state.party_level,
            "position": {
                "x": state.player.position.x,
                "y": state.player.position.y,
                "z": state.player.position.z,
            },
            "speed": state.player.speed,
            "anim_state": format!("{:?}", state.player.anim_state),
        },
        "camera": {
            "eye": {
                "x": state.camera.eye.x,
                "y": state.camera.eye.y,
                "z": state.camera.eye.z,
            },
            "yaw": state.camera.yaw,
            "pitch": state.camera.pitch,
            "fov": state.camera.fov_deg,
        },
        "simulation": {
            "ticks_run": ticks,
            "total_ticks": state.tick_count,
            "matches_won": state.matches_won,
            "npcs_in_zone": state.npcs.len(),
            "func_points_in_zone": state.func_points.len(),
            "kizuna_power": state.kizuna.kizuna_power,
            "interactions_recorded": interactions,
        },
        "frame_output": {
            "png_path": frame_png_path.display().to_string(),
            "width": W,
            "height": H,
            "bytes": frame.buf.len(),
        }
    });

    let json_path = out_dir.join("open_world_session.json");
    std::fs::write(&json_path, serde_json::to_string_pretty(&summary)?)?;

    println!("{}", serde_json::to_string_pretty(&summary)?);
    Ok(())
}
