// SPDX-License-Identifier: Apache-2.0
//! Read-only Steam install discovery and bounded local install mapping.

use std::{
    ffi::OsString,
    fs::{self, File},
    io::{BufWriter, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    process::ExitCode,
};

#[cfg(feature = "game-formats")]
use aphrody_nie_formats::{FormatError, cpk::CpkReader};
use bun_steam::{
    AppManifest, InstalledGame, SteamInstallation, SteamPlatform, find_steam_installations,
    list_installed_games, probe_steam_installation,
};
use serde_json::{Value, json};

const IEVR_APP_ID: u32 = 2_799_860;
const USAGE: &str = "usage: bunre steam <scan [--root <steam-root>] [--appid <id>] | map <appid> [--out <json-file>] [--cpk-index]>";

fn usage() -> ExitCode {
    eprintln!("{USAGE}");
    ExitCode::from(2)
}

fn arg_value(args: &[OsString], flag: &str) -> Option<PathBuf> {
    args.windows(2)
        .find(|pair| pair[0] == flag)
        .map(|pair| PathBuf::from(&pair[1]))
}

fn appid_arg(args: &[OsString]) -> Result<Option<u32>, String> {
    let Some(value) = args.windows(2).find(|pair| pair[0] == "--appid") else {
        return Ok(None);
    };
    let value = value[1].to_str().ok_or("--appid must be valid Unicode")?;
    let app_id = value
        .parse::<u32>()
        .map_err(|_| "--appid must be a positive integer")?;
    Ok(Some(app_id))
}

fn steam_roots(explicit: Option<PathBuf>) -> Vec<SteamInstallation> {
    if let Some(root) = explicit {
        return probe_steam_installation(root, SteamPlatform::Custom)
            .into_iter()
            .collect();
    }
    find_steam_installations()
}

fn scan(args: &[OsString]) -> Result<Value, String> {
    let roots = steam_roots(arg_value(args, "--root"));
    let filter = appid_arg(args)?;
    let mut installations = Vec::new();
    for root in roots {
        let games = list_installed_games(&root.root_path)
            .map_err(|error| format!("{}: {error}", root.root_path.display()))?;
        let apps = games
            .iter()
            .filter(|game| filter.is_none_or(|id| game.manifest.app_id == id))
            .map(|game| {
                json!({
                    "appId": game.manifest.app_id,
                    "name": game.manifest.name,
                    "installDir": game.manifest.install_dir,
                    "buildId": game.manifest.build_id,
                    "stateFlags": game.manifest.state_flag_descriptions(),
                    "installed": game.manifest.is_installed(),
                    "existsOnDisk": game.exists_on_disk,
                    "sizeOnDiskBytes": game.manifest.size_on_disk,
                    "installPath": game.install_path,
                })
            })
            .collect::<Vec<_>>();
        installations.push(json!({
            "platform": format!("{:?}", root.platform),
            "root": root.root_path,
            "steamapps": root.steamapps_path,
            "libraryFoldersVdf": root.libraryfolders_vdf,
            "apps": apps,
        }));
    }
    Ok(json!({ "installations": installations }))
}

fn path_text(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn relative_to(root: &Path, path: &Path) -> Result<String, String> {
    path.strip_prefix(root).map(path_text).map_err(|_| {
        format!(
            "{} is outside expected root {}",
            path.display(),
            root.display()
        )
    })
}

fn default_map_path() -> Result<PathBuf, String> {
    let base = if let Some(config) = std::env::var_os("NIE_CONFIG_DIR") {
        PathBuf::from(config)
    } else {
        std::env::var_os("LOCALAPPDATA")
            .or_else(|| std::env::var_os("APPDATA"))
            .or_else(|| std::env::var_os("HOME"))
            .map(PathBuf::from)
            .ok_or("set NIE_CONFIG_DIR or LOCALAPPDATA to choose a local Steam map location")?
            .join("Aphrody")
            .join("NIE")
    };
    Ok(base.join("steam").join("ievr-install-map.json"))
}

fn default_cpk_index_path() -> Result<PathBuf, String> {
    Ok(default_map_path()?
        .parent()
        .ok_or("could not determine local Steam map directory")?
        .join("ievr-cpk-index.jsonl"))
}

fn safe_member_path(directory: &str, filename: &str) -> String {
    let raw = if directory.is_empty() {
        filename.to_owned()
    } else {
        format!("{}/{}", directory, filename)
    };
    let normalized = raw.replace('\\', "/");
    normalized
        .split('/')
        .filter(|component| {
            !component.is_empty()
                && *component != "."
                && *component != ".."
                && !(component.len() == 2
                    && component.as_bytes()[1] == b':'
                    && component.as_bytes()[0].is_ascii_alphabetic())
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn find_game(app_id: u32) -> Result<(InstalledGame, PathBuf), String> {
    for root in find_steam_installations() {
        let games = list_installed_games(&root.root_path)
            .map_err(|error| format!("{}: {error}", root.root_path.display()))?;
        if let Some(game) = games
            .into_iter()
            .find(|game| game.manifest.app_id == app_id)
        {
            if !game.exists_on_disk {
                return Err(format!(
                    "Steam app {app_id} manifest exists but install directory is missing"
                ));
            }
            return Ok((game, root.root_path));
        }
    }

    // The configured IEVR path is a local fallback, but accept it only for the known IEVR app ID
    // and only when the sibling Steam manifest independently confirms the same app ID.
    if app_id == IEVR_APP_ID
        && let Some(game_dir) = std::env::var_os("NIE_GAME_DIR").map(PathBuf::from)
        && game_dir.is_dir()
        && let Some(steamapps) = game_dir.parent().and_then(Path::parent)
        && let Some(steam_root) = steamapps.parent().map(Path::to_path_buf)
    {
        let manifest_path = steamapps.join(format!("appmanifest_{app_id}.acf"));
        let raw = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
        let manifest = AppManifest::parse(&raw).map_err(|e| e.to_string())?;
        if manifest.app_id == app_id {
            return Ok((
                InstalledGame {
                    manifest,
                    library_path: steam_root.clone(),
                    install_path: game_dir,
                    exists_on_disk: true,
                },
                steam_root,
            ));
        }
    }
    Err(format!(
        "Steam app {app_id} is not installed in a discovered library"
    ))
}

fn ievr_map(game: &InstalledGame) -> Result<Value, String> {
    let install = &game.install_path;
    let mut cpk_files = Vec::new();
    let packs = install.join("data").join("packs");
    if packs.is_dir() {
        for entry in fs::read_dir(&packs).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file()
                && path
                    .extension()
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("cpk"))
            {
                let metadata = entry.metadata().map_err(|e| e.to_string())?;
                cpk_files.push(json!({
                    "path": relative_to(install, &path)?,
                    "sizeBytes": metadata.len(),
                }));
            }
        }
    }
    cpk_files.sort_by(|left, right| left["path"].as_str().cmp(&right["path"].as_str()));
    let cpk_bytes: u64 = cpk_files
        .iter()
        .filter_map(|file| file["sizeBytes"].as_u64())
        .sum();

    let data_path = install.join("data");
    let data_entries = fs::read_dir(&data_path)
        .map_err(|e| format!("{}: {e}", data_path.display()))?
        .map(|entry| {
            let entry = entry.map_err(|e| e.to_string())?;
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            Ok(json!({
                "path": relative_to(install, &entry.path())?,
                "kind": if metadata.is_dir() { "directory" } else { "file" },
                "sizeBytes": if metadata.is_file() { metadata.len() } else { 0 },
            }))
        })
        .collect::<Result<Vec<_>, String>>()?;

    let exe_path = install.join("nie.exe");
    let exe_bytes = fs::read(&exe_path).map_err(|error| format!("nie.exe: {error}"))?;
    let triage = bun_re::triage(&exe_bytes).map_err(|error| format!("nie.exe triage: {error}"))?;
    let relevant_imports: Vec<_> = triage
        .imports
        .iter()
        .filter(|symbol| {
            symbol.starts_with("SteamAPI_")
                || symbol.starts_with("EOS_")
                || symbol.contains("AntiCheat")
                || symbol.contains("D3D11CreateDevice")
        })
        .cloned()
        .collect();
    let sections: Vec<_> = triage
        .sections
        .iter()
        .map(|section| {
            json!({
                "name": section.name,
                "virtualAddress": section.vaddr,
                "sizeBytes": section.size,
                "entropy": section.entropy,
            })
        })
        .collect();

    // The tracked map stores only library-relative/install-relative paths, not this machine's
    // absolute Steam directory or account/owner metadata.
    Ok(json!({
        "schemaVersion": 1,
        "kind": "inazuma-eleven-victory-road-steam-install-map",
        "appId": game.manifest.app_id,
        "name": game.manifest.name,
        "installDir": game.manifest.install_dir,
        "installPathRelativeToLibrary": relative_to(&game.library_path, install)?,
        "manifestPathRelativeToLibrary": format!("steamapps/appmanifest_{}.acf", game.manifest.app_id),
        "buildId": game.manifest.build_id,
        "lastUpdatedUnix": game.manifest.last_updated,
        "stateFlags": game.manifest.state_flag_descriptions(),
        "installedDepots": game.manifest.installed_depots,
        "sizeOnDiskBytes": game.manifest.size_on_disk,
        "nieGameDirConfigured": std::env::var_os("NIE_GAME_DIR").is_some_and(|value| PathBuf::from(value) == *install),
        "gameRootFiles": [
            {"path":"nie.exe","sizeBytes":triage.size},
            {"path":"GameBootstrapper.exe","exists":install.join("GameBootstrapper.exe").is_file()},
            {"path":"EACLauncher.exe","exists":install.join("EACLauncher.exe").is_file()}
        ],
        "nieExeTriage": {
            "format": triage.format.display_name(),
            "architecture": triage.arch,
            "sha256": triage.sha256,
            "sizeBytes": triage.size,
            "entryPoint": triage.entry_point,
            "subsystem": triage.subsystem,
            "sections": sections,
            "steamAndRuntimeImports": relevant_imports,
            "libraries": triage.libraries,
        },
        "dataEntries": data_entries,
        "cpkSummary": {
            "directory": "data/packs",
            "archiveCount": cpk_files.len(),
            "totalBytes": cpk_bytes,
        },
        "cpkListIndex": {
            "path": "data/cpk_list.cfg.bin",
            "present": install.join("data/cpk_list.cfg.bin").is_file(),
            "status": "presence recorded; cpk-index is an optional per-archive TOC index",
        },
        "cpkArchives": cpk_files,
        "notes": [
            "Paths in this file are relative; absolute paths and Steam owner identifiers are omitted.",
            "CPK TOC entries are expanded only when `steam map <appid> --cpk-index` is requested.",
        ],
    }))
}

#[cfg(feature = "game-formats")]
fn write_cpk_toc_index(install: &Path, output: &Path) -> Result<Value, String> {
    let packs = install.join("data").join("packs");
    let mut paths = fs::read_dir(&packs)
        .map_err(|error| format!("{}: {error}", packs.display()))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("cpk"))
        })
        .collect::<Vec<_>>();
    paths.sort();

    if let Some(parent) = output
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|error| format!("{}: {error}", parent.display()))?;
    }
    let file = File::create(output).map_err(|error| format!("{}: {error}", output.display()))?;
    let mut writer = BufWriter::new(file);
    let mut parsed = 0usize;
    let mut failed = 0usize;
    let mut member_count = 0usize;
    let mut errors = Vec::new();

    for archive_path in &paths {
        let relative = relative_to(install, archive_path)?;
        let archive_name = archive_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown.cpk");
        let parsed_archive = (|| -> Result<CpkReader, String> {
            let mut file = File::open(archive_path).map_err(|error| error.to_string())?;
            CpkReader::from_reader(archive_name, |offset, size| {
                let offset = offset;
                let mut bytes = vec![0; size];
                file.seek(SeekFrom::Start(offset)).map_err(|error| {
                    FormatError::Malformed(format!("seek at {offset}: {error}"))
                })?;
                file.read_exact(&mut bytes).map_err(|error| {
                    FormatError::Malformed(format!("read at {offset} ({} bytes): {error}", size))
                })?;
                Ok(bytes)
            })
            .map_err(|error| error.to_string())
        })();

        match parsed_archive {
            Ok(reader) => {
                parsed += 1;
                member_count += reader.entries.len();
                serde_json::to_writer(
                    &mut writer,
                    &json!({
                        "recordType": "archive",
                        "archive": relative,
                        "memberCount": reader.entries.len(),
                        "encrypted": reader.is_encrypted,
                    }),
                )
                .map_err(|error| error.to_string())?;
                writer.write_all(b"\n").map_err(|error| error.to_string())?;
                for entry in reader.entries {
                    let member_path =
                        safe_member_path(entry.directory.trim_end_matches('/'), &entry.filename);
                    serde_json::to_writer(
                        &mut writer,
                        &json!({
                            "recordType": "member",
                            "archive": relative,
                            "path": member_path,
                            "offset": entry.offset,
                            "storedSize": entry.size,
                            "extractSize": entry.extract_size,
                            "compressed": entry.is_compressed,
                        }),
                    )
                    .map_err(|error| error.to_string())?;
                    writer.write_all(b"\n").map_err(|error| error.to_string())?;
                }
            }
            Err(error) => {
                failed += 1;
                if errors.len() < 12 {
                    errors.push(json!({ "archive": relative, "error": error }));
                }
                serde_json::to_writer(
                    &mut writer,
                    &json!({
                        "recordType": "error",
                        "archive": relative,
                        "error": error,
                    }),
                )
                .map_err(|error| error.to_string())?;
                writer.write_all(b"\n").map_err(|error| error.to_string())?;
            }
        }
    }
    writer.flush().map_err(|error| error.to_string())?;
    Ok(json!({
        "requested": true,
        "outputFile": "steam/ievr-cpk-index.jsonl",
        "archiveCount": paths.len(),
        "parsedArchives": parsed,
        "errorArchives": failed,
        "memberCount": member_count,
        "errors": errors,
    }))
}

#[cfg(not(feature = "game-formats"))]
fn write_cpk_toc_index(_install: &Path, _output: &Path) -> Result<Value, String> {
    Err("CPK TOC indexing requires bunre built with the game-formats feature".to_string())
}

fn map(args: &[OsString]) -> Result<(Value, PathBuf), String> {
    let Some(app_id) = args
        .first()
        .and_then(|value| value.to_str())
        .and_then(|value| value.parse::<u32>().ok())
    else {
        return Err("steam map requires a numeric app ID".to_string());
    };
    let output = arg_value(args, "--out").map_or_else(default_map_path, Ok)?;
    let cpk_index_requested = args.iter().any(|arg| arg == "--cpk-index");
    let (game, _steam_root) = find_game(app_id)?;
    let mut report = ievr_map(&game)?;
    let cpk_index_path = if cpk_index_requested {
        let path = default_cpk_index_path()?;
        let index_summary = write_cpk_toc_index(&game.install_path, &path)?;
        report["cpkTocIndex"] = index_summary;
        Some(path)
    } else {
        report["cpkTocIndex"] = json!({ "requested": false });
        None
    };
    if let Some(parent) = output
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
    }
    let content = serde_json::to_vec_pretty(&report).map_err(|e| e.to_string())?;
    fs::write(&output, content).map_err(|e| format!("{}: {e}", output.display()))?;
    let summary = json!({
        "appId": report["appId"],
        "name": report["name"],
        "buildId": report["buildId"],
        "installPathRelativeToLibrary": report["installPathRelativeToLibrary"],
        "nieExeTriage": {
            "format": report["nieExeTriage"]["format"],
            "architecture": report["nieExeTriage"]["architecture"],
            "sizeBytes": report["nieExeTriage"]["sizeBytes"],
            "sha256": report["nieExeTriage"]["sha256"],
            "steamAndRuntimeImportCount": report["nieExeTriage"]["steamAndRuntimeImports"].as_array().map_or(0, Vec::len),
        },
        "cpkSummary": report["cpkSummary"],
        "cpkListIndex": report["cpkListIndex"],
        "cpkTocIndex": report["cpkTocIndex"],
        "cpkIndexFile": cpk_index_path,
        "detailedMapSaved": true,
    });
    Ok((summary, output))
}

pub fn main(args: impl Iterator<Item = OsString>) -> ExitCode {
    let args: Vec<_> = args.collect();
    let Some(command) = args.first().and_then(|value| value.to_str()) else {
        return usage();
    };
    let result = match command {
        "scan" => scan(&args[1..]).map(|report| (report, None)),
        "map" => map(&args[1..]).map(|(report, path)| (report, Some(path))),
        _ => return usage(),
    };
    match result {
        Ok((report, output_path)) => {
            let mut stdout = json!({"report": report});
            if let Some(path) = output_path {
                stdout["mapFile"] = json!(path);
            }
            match serde_json::to_string_pretty(&stdout) {
                Ok(text) => {
                    println!("{text}");
                    ExitCode::SUCCESS
                }
                Err(error) => {
                    eprintln!("bunre steam: {error}");
                    ExitCode::FAILURE
                }
            }
        }
        Err(error) => {
            eprintln!("bunre steam: {error}\n{USAGE}");
            ExitCode::FAILURE
        }
    }
}
