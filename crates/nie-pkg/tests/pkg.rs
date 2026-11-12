use std::fs;

use nie_pkg::{Feature, Platform, Registry, RegistryError, Store, StoreError, Support};

#[test]
fn embedded_registry_is_valid_and_covers_every_platform() {
    let reg = Registry::embedded();
    assert!(reg.games.len() >= 11);
    for p in Platform::ALL {
        assert!(reg.on_platform(p).next().is_some(), "no game on {p}");
    }
    for g in &reg.games {
        for f in Feature::ALL {
            assert!(
                g.features.contains_key(&f),
                "{} misses feature {}",
                g.id,
                f.as_str()
            );
        }
        assert!(
            g.support(Feature::DumpVerify) >= Support::Partial,
            "{}",
            g.id
        );
    }
}

#[test]
fn lookup_by_alias_and_steam_id() {
    let reg = Registry::embedded();
    let vr = reg.get("ares").expect("alias");
    assert_eq!(vr.id, "ievr");
    assert_eq!(
        vr.release(Platform::Pc).and_then(|r| r.steam_app_id),
        Some(2799860)
    );
    assert!(reg.get("nope").is_none());
}

#[test]
fn registry_roundtrips_through_toml() {
    let reg = Registry::embedded();
    let again = Registry::from_toml(&reg.to_toml()).unwrap();
    assert_eq!(reg, again);
}

#[test]
fn registry_rejects_duplicates_and_bad_schema() {
    let dup = r#"
schema = 1
[[game]]
id = "a"
title = "A"
series = "x"
revision = 1
releases = [{ platform = "ds", year = 2008, format = "nds-rom" }]
[[game]]
id = "b"
aliases = ["a"]
title = "B"
series = "x"
revision = 1
releases = [{ platform = "ds", year = 2008, format = "nds-rom" }]
"#;
    assert!(matches!(Registry::from_toml(dup), Err(RegistryError::Duplicate(k)) if k == "a"));
    assert!(matches!(
        Registry::from_toml("schema = 9\ngame = []"),
        Err(RegistryError::Schema(9))
    ));
    let twice = r#"
schema = 1
[[game]]
id = "a"
title = "A"
series = "x"
revision = 1
releases = [{ platform = "ds", year = 2008, format = "f" }, { platform = "ds", year = 2009, format = "f" }]
"#;
    assert!(matches!(
        Registry::from_toml(twice),
        Err(RegistryError::DuplicatePlatform(_, Platform::Ds))
    ));
}

#[test]
fn matrix_has_one_row_per_game() {
    let reg = Registry::embedded();
    let md = reg.feature_matrix_markdown();
    assert_eq!(md.lines().count(), reg.games.len() + 2);
    assert!(
        md.contains("| Inazuma Eleven: Victory Road (`ievr`) | pc, switch, switch2, ps4, ps5 |")
    );
}

#[test]
fn install_verify_update_remove_cycle() {
    let tmp = tempfile::tempdir().unwrap();
    let dump = tmp.path().join("dump");
    fs::create_dir_all(dump.join("data")).unwrap();
    fs::write(dump.join("data/a.cpk"), b"alpha").unwrap();
    fs::write(dump.join("game.exe"), b"beta").unwrap();
    let store = Store::new(tmp.path().join("root"));
    let reg = Registry::embedded();

    let rec = store.install(&reg, "ievr", Platform::Pc, &dump).unwrap();
    assert_eq!(
        rec.files
            .iter()
            .map(|f| f.path.as_str())
            .collect::<Vec<_>>(),
        ["data/a.cpk", "game.exe"]
    );
    assert_eq!(rec.files[0].blake3, blake3_hex(b"alpha"));
    assert_eq!(store.list().unwrap().len(), 1);
    assert!(store.verify("ievr").unwrap().is_clean());

    fs::write(dump.join("game.exe"), b"tampered").unwrap();
    fs::remove_file(dump.join("data/a.cpk")).unwrap();
    let rep = store.verify("ievr").unwrap();
    assert_eq!(rep.changed, ["game.exe"]);
    assert_eq!(rep.missing, ["data/a.cpk"]);

    assert_eq!(store.update(&reg, "ievr").unwrap(), None);
    let mut newer = reg.clone();
    newer
        .games
        .iter_mut()
        .find(|g| g.id == "ievr")
        .unwrap()
        .revision = 2;
    assert_eq!(store.update(&newer, "ievr").unwrap(), Some(2));
    assert_eq!(store.get("ievr").unwrap().revision, 2);

    store.remove("ievr").unwrap();
    assert!(matches!(
        store.verify("ievr"),
        Err(StoreError::NotInstalled(_))
    ));
    assert!(
        dump.join("game.exe").exists(),
        "remove must not touch the dump"
    );
}

#[test]
fn install_single_file_and_rejects_wrong_platform() {
    let tmp = tempfile::tempdir().unwrap();
    let rom = tmp.path().join("ie1.nds");
    fs::write(&rom, b"rom").unwrap();
    let store = Store::new(tmp.path().join("root"));
    let reg = Registry::embedded();
    assert!(matches!(
        store.install(&reg, "ie1", Platform::Ps5, &rom),
        Err(StoreError::NoRelease(..))
    ));
    assert!(matches!(
        store.install(&reg, "zzz", Platform::Ds, &rom),
        Err(StoreError::UnknownGame(_))
    ));
    store.install(&reg, "ie1", Platform::Ds, &rom).unwrap();
    assert!(store.verify("ie1").unwrap().is_clean());
}

fn blake3_hex(data: &[u8]) -> String {
    blake3::hash(data).to_hex().to_string()
}
