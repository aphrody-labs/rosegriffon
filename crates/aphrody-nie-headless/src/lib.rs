//! Portable inspection core used by the `aphrody-nie-headless` binding and WebAssembly.

#![forbid(unsafe_code)]

use anyhow::Result;
use aphrody_nie_formats::{FileFormat, cfgbin, cpk, crilayla, detect};
use serde::Serialize;
use serde_json::Value;

#[cfg(feature = "host")]
pub mod memory_dump;
#[cfg(feature = "host")]
pub mod menu_capture;
#[cfg(feature = "host")]
pub mod save_runner;

#[cfg(feature = "host")]
pub use memory_dump::{MemoryDumpOptions, ProcessMemoryMap, execute_memory_dump};
#[cfg(feature = "host")]
pub use menu_capture::{CaptureSequenceManifest, GameScreen, MenuCaptureOptions, capture_all_menus};
#[cfg(feature = "host")]
pub use save_runner::{SaveEditOptions, SaveEditReport, create_mock_save_container, execute_save_edit};

/// Largest byte buffer accepted by the interactive detailed detector.
pub const MAX_INSPECTION_BYTES: usize = 128 * 1024 * 1024;

/// Canonical detailed format report. Field names are English while format and VFS tokens remain
/// byte-exact (`CPK`, `@UTF`, `CRILAYLA`, `G4TX`, and related names).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionSummary {
    pub byte_length: usize,
    pub format: String,
    pub detail: Value,
}

/// Detects RDBN `cfg.bin` in addition to the shared magic detector.
#[must_use]
pub fn detect_extended(bytes: &[u8]) -> FileFormat {
    let format = detect(bytes);
    if format == FileFormat::Unknown && cfgbin::is_rdbn(bytes) {
        FileFormat::CfgBin
    } else {
        format
    }
}

/// Inspects caller-provided bytes without filesystem or process access.
pub fn inspect_bytes(bytes: &[u8]) -> Result<DetectionSummary> {
    anyhow::ensure!(
        bytes.len() <= MAX_INSPECTION_BYTES,
        "inspection input {} exceeds {} bytes",
        bytes.len(),
        MAX_INSPECTION_BYTES
    );
    let format = detect_extended(bytes);
    let detail = match format {
        FileFormat::CriLayla => {
            let decompressed = crilayla::decompress(bytes)
                .map_err(|error| anyhow::anyhow!("CRILAYLA: {error}"))?;
            serde_json::json!({ "decompressedBytes": decompressed.len() })
        }
        FileFormat::Utf => {
            let table = cpk::parse_utf(bytes).map_err(|error| anyhow::anyhow!("@UTF: {error}"))?;
            serde_json::json!({
                "tableName": table.name,
                "columnCount": table.column_count(),
                "rowCount": table.row_count(),
            })
        }
        FileFormat::Cpk => {
            let header = cpk::parse_cpk(bytes).map_err(|error| anyhow::anyhow!("CPK: {error}"))?;
            serde_json::json!({
                "tableName": header.utf.name,
                "columnCount": header.utf.column_count(),
                "rowCount": header.utf.row_count(),
            })
        }
        FileFormat::CfgBin => {
            let rdbn =
                cfgbin::parse(bytes).map_err(|error| anyhow::anyhow!("RDBN/cfg.bin: {error}"))?;
            serde_json::json!({
                "version": rdbn.header.version,
                "typeCount": rdbn.types.len(),
                "fieldCount": rdbn.fields.len(),
                "rootCount": rdbn.roots.len(),
            })
        }
        _ => serde_json::json!({}),
    };
    Ok(DetectionSummary {
        byte_length: bytes.len(),
        format: format.name().to_owned(),
        detail,
    })
}

/// JSON adapter for the browser and other non-CLI bindings.
pub fn inspect_bytes_json(bytes: &[u8]) -> Result<String> {
    serde_json::to_string(&inspect_bytes(bytes)?).map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_rdbn() -> Vec<u8> {
        let mut bytes = vec![0_u8; 0x50];
        bytes[0..4].copy_from_slice(b"RDBN");
        bytes[4..6].copy_from_slice(&0x50_i16.to_le_bytes());
        bytes[6..10].copy_from_slice(&100_i32.to_le_bytes());
        bytes[10..12].copy_from_slice(&0x14_i16.to_le_bytes());
        bytes
    }

    #[test]
    fn rdbn_detail_uses_canonical_english_fields() {
        let report = inspect_bytes(&empty_rdbn()).expect("minimal RDBN should inspect");
        assert_eq!(report.format, "cfg.bin");
        assert_eq!(report.detail["version"], 100);
        assert_eq!(report.detail["typeCount"], 0);
        assert_eq!(report.detail["fieldCount"], 0);
        assert_eq!(report.detail["rootCount"], 0);
        assert!(report.detail.get("champs").is_none());
    }

    #[test]
    fn unknown_bytes_have_an_explicit_empty_detail() {
        let report = inspect_bytes(b"unknown").expect("unknown input should still inspect");
        assert_eq!(report.format, "?");
        assert_eq!(report.byte_length, 7);
        assert_eq!(report.detail, serde_json::json!({}));
    }

    #[test]
    fn inspection_is_bounded_before_parsing() {
        let bytes = vec![0_u8; MAX_INSPECTION_BYTES + 1];
        assert!(inspect_bytes(&bytes).is_err());
    }

    #[cfg(feature = "host")]
    #[test]
    fn test_save_runner_mock_and_edit() {
        let temp_dir = std::env::temp_dir().join(format!("nie_test_save_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let save_path = temp_dir.join("002AB8F4-USERDATALIVE");

        let options = SaveEditOptions {
            input_path: save_path.clone(),
            output_path: Some(save_path.clone()),
            slot: "002AB8F4-USERDATALIVE".to_string(),
            player_level: Some(99),
            coins: Some(50000),
            mock_if_missing: true,
        };

        let report = execute_save_edit(&options).expect("save edit should succeed");
        assert_eq!(report.slot, "002AB8F4-USERDATALIVE");
        assert_eq!(report.player_level_applied, Some(99));
        assert_eq!(report.coins_applied, Some(50000));
        assert!(report.crc32_valid);
        assert!(save_path.is_file());
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[cfg(feature = "host")]
    #[test]
    fn test_memory_dump_execution() {
        let temp_dir = std::env::temp_dir().join(format!("nie_test_mem_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let bin_path = temp_dir.join("nie_mem.bin");
        let json_path = temp_dir.join("nie_mem.json");

        let options = MemoryDumpOptions {
            output_bin: bin_path.clone(),
            output_json: Some(json_path.clone()),
            live_pid: None,
            target_pe: None,
            slot_name: "002AB8F4-USERDATALIVE".to_string(),
        };

        let map = execute_memory_dump(&options).expect("memory dump should succeed");
        assert_eq!(map.process_name, "nie.exe");
        assert_eq!(map.architecture, "x86_64");
        assert!(map.total_dump_bytes > 0);
        assert!(bin_path.is_file());
        assert!(json_path.is_file());
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[cfg(feature = "host")]
    #[test]
    fn test_menu_capture_execution() {
        let temp_dir = std::env::temp_dir().join(format!("nie_test_capture_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let out_dir = temp_dir.join("frames");

        let options = MenuCaptureOptions {
            output_dir: out_dir.clone(),
            width: 320,
            height: 180,
            frames_per_menu: 2,
            fps: 30,
            screens: vec![GameScreen::Boot, GameScreen::MainMenu],
        };

        let manifest = capture_all_menus(&options).expect("menu capture should succeed");
        assert_eq!(manifest.total_frames, 4);
        assert_eq!(manifest.filmcraft_clips.len(), 2);
        assert!(out_dir.join("timeline.json").is_file());
        assert!(out_dir.join(&manifest.frames[0].file_name).is_file());
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
