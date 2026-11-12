// SPDX-License-Identifier: Apache-2.0
//! `steam-index`: read-only Steam install indexer.
//!
//! - `scan <steam_root>`: one JSON document on stdout (libraries, apps, depots, depotcache,
//!   appinfo/packageinfo summaries, workshop, compat tools, controller configs, userdata file
//!   names, credential artifacts by path/size/blake3 only).
//! - `hash`: reads absolute paths (one per line) on stdin, writes NDJSON
//!   `{"path","size","blake3"}` or `{"path","error"}` per line, streaming 1 MiB reads.
//! - `account <steam_root>`: the most recent `loginusers.vdf` account (identifiers only) as JSON.
//!
//! Credential artifacts are never parsed, except `loginusers.vdf` for `account`.

use bun_steam::config::{library_folders, login_users};
use bun_steam::install::scan_steam_libraries;
use bun_steam::vdf::{BinValue, VdfValue, parse_appinfo, parse_packageinfo, parse_vdf};
use serde_json::{Value, json};
use std::fs;
use std::io::{self, BufRead, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let code = match args.get(1).map(String::as_str) {
        Some("scan") => args.get(2).map_or(2, |r| emit(&scan(Path::new(r)))),
        Some("account") => args.get(2).map_or(2, |r| emit(&account(Path::new(r)))),
        Some("hash") => hash_stdin(),
        _ => {
            eprintln!("usage: steam-index scan <root> | account <root> | hash < paths");
            2
        }
    };
    std::process::exit(code);
}

fn emit(v: &Value) -> i32 {
    println!("{v}");
    0
}

fn blake3_file(path: &Path) -> io::Result<(u64, String)> {
    let mut f = fs::File::open(path)?;
    let mut h = blake3::Hasher::new();
    let mut buf = vec![0u8; 1 << 20];
    let mut total = 0u64;
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        total += n as u64;
        h.update(&buf[..n]);
    }
    Ok((total, h.finalize().to_hex().to_string()))
}

fn hash_stdin() -> i32 {
    let stdin = io::stdin();
    let mut out = BufWriter::new(io::stdout().lock());
    for line in stdin.lock().lines() {
        let Ok(p) = line else { break };
        let p = p.trim_end_matches('\r');
        if p.is_empty() {
            continue;
        }
        let v = match blake3_file(Path::new(p)) {
            Ok((size, hex)) => json!({"path": p, "size": size, "blake3": hex}),
            Err(e) => json!({"path": p, "error": e.to_string()}),
        };
        if writeln!(out, "{v}").and_then(|()| out.flush()).is_err() {
            return 1;
        }
    }
    0
}

fn read_text(p: &Path) -> Option<VdfValue> {
    parse_vdf(&fs::read_to_string(p).ok()?).ok()
}

fn list_dir(p: &Path) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = fs::read_dir(p)
        .map(|rd| rd.filter_map(|e| e.ok().map(|e| e.path())).collect())
        .unwrap_or_default();
    v.sort();
    v
}

fn walk_files(root: &Path, out: &mut Vec<PathBuf>) {
    for p in list_dir(root) {
        if p.is_dir() {
            walk_files(&p, out);
        } else {
            out.push(p);
        }
    }
}

fn file_name(p: &Path) -> String {
    p.file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn size_of(p: &Path) -> u64 {
    fs::metadata(p).map(|m| m.len()).unwrap_or(0)
}

fn bin_text(v: Option<&BinValue>) -> Option<String> {
    v.and_then(BinValue::as_text)
}

fn scan(root: &Path) -> Value {
    let steamapps = root.join("steamapps");
    let folders: Vec<Value> = read_text(&steamapps.join("libraryfolders.vdf"))
        .as_ref()
        .map(library_folders)
        .unwrap_or_default()
        .into_iter()
        .map(|f| {
            json!({"index": f.index, "path": f.path, "label": f.label,
                   "total_size": f.total_size, "app_count": f.apps.len()})
        })
        .collect();

    let mut apps = Vec::new();
    let mut depotcache = Vec::new();
    let mut workshop = Vec::new();
    let mut compat = Vec::new();
    let libs = scan_steam_libraries(root).unwrap_or_default();
    let mut lib_paths: Vec<PathBuf> = libs.iter().map(|l| l.path.clone()).collect();
    if !lib_paths.iter().any(|p| p == root) {
        lib_paths.push(root.to_path_buf());
    }
    for lib in &libs {
        for m in &lib.apps {
            let acf = lib
                .steamapps_path
                .join(format!("appmanifest_{}.acf", m.app_id));
            // Depot -> manifest gid / size come from the raw ACF (AppManifest keeps ids only).
            let mut depots = Vec::new();
            if let Some(doc) = read_text(&acf)
                && let Some(entries) = doc
                    .get_path(&["AppState", "InstalledDepots"])
                    .and_then(VdfValue::entries)
            {
                for (depot, node) in entries {
                    depots.push(json!({"depot": depot, "manifest": node.get_str("manifest"),
                                       "size": node.get_u64("size")}));
                }
            }
            let install_path = lib.steamapps_path.join("common").join(&m.install_dir);
            apps.push(json!({
                "library": lib.path, "appid": m.app_id, "name": m.name,
                "installdir": m.install_dir, "install_path": install_path,
                "exists": install_path.is_dir(), "size_on_disk": m.size_on_disk,
                "buildid": m.build_id, "state_flags": m.state_flags,
                "last_updated": m.last_updated, "depots": depots, "acf_path": acf,
            }));
        }
        for p in list_dir(&lib.steamapps_path.join("workshop")) {
            let name = file_name(&p);
            let Some(appid) = name
                .strip_prefix("appworkshop_")
                .and_then(|s| s.strip_suffix(".acf"))
            else {
                continue;
            };
            let doc = read_text(&p);
            let installed: Vec<(String, VdfValue)> = doc
                .as_ref()
                .and_then(|d| d.get_path(&["AppWorkshop", "WorkshopItemsInstalled"]))
                .and_then(VdfValue::entries)
                .map(<[_]>::to_vec)
                .unwrap_or_default();
            for (item, node) in installed {
                let dir = lib
                    .steamapps_path
                    .join("workshop")
                    .join("content")
                    .join(appid)
                    .join(&item);
                workshop.push(json!({"library": lib.path, "appid": appid, "item": item,
                    "size": node.get_u64("size"), "timeupdated": node.get_u64("timeupdated"),
                    "manifest": node.get_str("manifest"), "path": dir, "exists": dir.is_dir()}));
            }
        }
        // Proton and the Steam Linux Runtime ship as apps under common/.
        for p in list_dir(&lib.steamapps_path.join("common")) {
            let n = file_name(&p);
            if n.starts_with("Proton") || n.starts_with("SteamLinuxRuntime") {
                compat.push(json!({"name": n, "path": p, "source": "steamapps/common"}));
            }
        }
    }
    for lib in &lib_paths {
        for dir in [lib.join("depotcache"), lib.join("steamapps").join("depotcache")] {
            for p in list_dir(&dir) {
                let n = file_name(&p);
                let Some(stem) = n.strip_suffix(".manifest") else {
                    continue;
                };
                let (depot, gid) = stem.split_once('_').unwrap_or((stem, ""));
                depotcache
                    .push(json!({"path": p, "depot": depot, "gid": gid, "size": size_of(&p)}));
            }
        }
    }
    for p in list_dir(&root.join("compatibilitytools.d")) {
        if p.is_dir() {
            compat.push(
                json!({"name": file_name(&p), "path": p, "source": "compatibilitytools.d"}),
            );
        }
    }

    // PICS caches: summaries only (ids, names, types, package -> app/depot ids).
    let appinfo = fs::read(root.join("appcache").join("appinfo.vdf"))
        .ok()
        .and_then(|b| {
            parse_appinfo(&b)
                .map_err(|e| eprintln!("appinfo: {e}"))
                .ok()
        })
        .map(|f| {
            let rows: Vec<Value> = f
                .apps
                .iter()
                .map(|a| {
                    let common = a
                        .kv
                        .as_ref()
                        .and_then(|k| k.get("appinfo").or(Some(k)))
                        .and_then(|k| k.get("common"));
                    json!({"appid": a.app_id, "change": a.change_number,
                           "last_updated": a.last_updated,
                           "name": bin_text(common.and_then(|c| c.get("name"))),
                           "type": bin_text(common.and_then(|c| c.get("type")))})
                })
                .collect();
            json!({"version": f.version, "universe": f.universe, "apps": rows})
        });
    let packageinfo = fs::read(root.join("appcache").join("packageinfo.vdf"))
        .ok()
        .and_then(|b| {
            parse_packageinfo(&b)
                .map_err(|e| eprintln!("packageinfo: {e}"))
                .ok()
        })
        .map(|f| {
            let rows: Vec<Value> = f
                .packages
                .iter()
                .map(|p| {
                    let node = p.kv.get(&p.package_id.to_string()).unwrap_or(&p.kv);
                    let ids = |k: &str| -> Vec<String> {
                        node.get(k)
                            .and_then(BinValue::entries)
                            .map(|e| e.iter().filter_map(|(_, v)| v.as_text()).collect())
                            .unwrap_or_default()
                    };
                    json!({"packageid": p.package_id, "change": p.change_number,
                           "appids": ids("appids"), "depotids": ids("depotids")})
                })
                .collect();
            json!({"version": f.version, "universe": f.universe, "packages": rows})
        });

    let mut controller = Vec::new();
    for dir in [
        root.join("controller_config"),
        root.join("steamapps")
            .join("common")
            .join("Steam Controller Configs"),
    ] {
        let mut files = Vec::new();
        walk_files(&dir, &mut files);
        for p in files {
            controller.push(json!({"path": p, "size": size_of(&p)}));
        }
    }

    // userdata: config file names only; controller configs live under app 241100.
    let mut userdata = Vec::new();
    for acct in list_dir(&root.join("userdata")) {
        if !acct.is_dir() {
            continue;
        }
        let names: Vec<String> = list_dir(&acct.join("config"))
            .iter()
            .map(|p| file_name(p))
            .collect();
        let app_dirs = list_dir(&acct).iter().filter(|p| p.is_dir()).count();
        let mut ctl = Vec::new();
        walk_files(&acct.join("241100"), &mut ctl);
        for p in &ctl {
            controller.push(json!({"path": p, "size": size_of(p)}));
        }
        userdata.push(
            json!({"account_id": file_name(&acct), "config_files": names, "app_dirs": app_dirs}),
        );
    }

    // Credential artifacts: path, size, blake3 only. Contents are never parsed or copied.
    let mut cred_paths: Vec<PathBuf> = list_dir(root)
        .into_iter()
        .filter(|p| file_name(p).starts_with("ssfn"))
        .collect();
    for rel in ["loginusers.vdf", "local.vdf", "config.vdf"] {
        cred_paths.push(root.join("config").join(rel));
    }
    if let Some(la) = std::env::var_os("LOCALAPPDATA") {
        cred_paths.push(PathBuf::from(la).join("Steam").join("local.vdf"));
    }
    let creds: Vec<Value> = cred_paths
        .iter()
        .filter(|p| p.is_file())
        .map(|p| match blake3_file(p) {
            Ok((size, hex)) => json!({"path": p, "size": size, "blake3": hex}),
            Err(e) => json!({"path": p, "error": e.to_string()}),
        })
        .collect();

    json!({
        "steam_root": root, "libraries": folders, "apps": apps, "depotcache": depotcache,
        "appinfo": appinfo, "packageinfo": packageinfo, "workshop": workshop,
        "compat_tools": compat, "controller_configs": controller, "userdata": userdata,
        "credential_artifacts": creds,
    })
}

fn account(root: &Path) -> Value {
    let users = read_text(&root.join("config").join("loginusers.vdf"))
        .map(|d| login_users(&d))
        .unwrap_or_default();
    let pick = users
        .iter()
        .find(|u| u.most_recent)
        .or_else(|| users.iter().max_by_key(|u| u.timestamp.unwrap_or(0)));
    pick.map_or(Value::Null, |u| {
        json!({"account_name": u.account_name, "steam_id": u.steam_id})
    })
}
