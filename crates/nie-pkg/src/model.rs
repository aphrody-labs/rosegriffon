use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

/// Hardware or distribution target a game shipped on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Ds,
    #[serde(rename = "3ds")]
    N3ds,
    Wii,
    Switch,
    Switch2,
    Ps4,
    Ps5,
    Pc,
    Mobile,
}

impl Platform {
    pub const ALL: [Platform; 9] = [
        Platform::Ds,
        Platform::N3ds,
        Platform::Wii,
        Platform::Switch,
        Platform::Switch2,
        Platform::Ps4,
        Platform::Ps5,
        Platform::Pc,
        Platform::Mobile,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Platform::Ds => "ds",
            Platform::N3ds => "3ds",
            Platform::Wii => "wii",
            Platform::Switch => "switch",
            Platform::Switch2 => "switch2",
            Platform::Ps4 => "ps4",
            Platform::Ps5 => "ps5",
            Platform::Pc => "pc",
            Platform::Mobile => "mobile",
        }
    }

    pub fn parse(s: &str) -> Option<Platform> {
        Platform::ALL.into_iter().find(|p| p.as_str() == s)
    }
}

impl fmt::Display for Platform {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// A capability NIE can offer for a game.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Feature {
    DumpVerify,
    AssetExtract,
    TextExtract,
    TranslationPatch,
    SaveEdit,
    TeamBuilder,
    WikiData,
    NieRuntime,
    Netplay,
    ModLoader,
}

impl Feature {
    pub const ALL: [Feature; 10] = [
        Feature::DumpVerify,
        Feature::AssetExtract,
        Feature::TextExtract,
        Feature::TranslationPatch,
        Feature::SaveEdit,
        Feature::TeamBuilder,
        Feature::WikiData,
        Feature::NieRuntime,
        Feature::Netplay,
        Feature::ModLoader,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Feature::DumpVerify => "dump_verify",
            Feature::AssetExtract => "asset_extract",
            Feature::TextExtract => "text_extract",
            Feature::TranslationPatch => "translation_patch",
            Feature::SaveEdit => "save_edit",
            Feature::TeamBuilder => "team_builder",
            Feature::WikiData => "wiki_data",
            Feature::NieRuntime => "nie_runtime",
            Feature::Netplay => "netplay",
            Feature::ModLoader => "mod_loader",
        }
    }
}

/// Support level of a feature for one game.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default, Serialize, Deserialize,
)]
#[serde(rename_all = "lowercase")]
pub enum Support {
    #[default]
    None,
    Planned,
    Partial,
    Full,
}

impl Support {
    pub fn as_str(self) -> &'static str {
        match self {
            Support::None => "none",
            Support::Planned => "planned",
            Support::Partial => "partial",
            Support::Full => "full",
        }
    }
}

/// One release of a game on one platform.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Release {
    pub platform: Platform,
    pub year: u16,
    #[serde(default)]
    pub regions: Vec<String>,
    /// Dump format the store expects (`nds-rom`, `3ds-cart`, `wii-disc`, `steam-depot`, ...).
    pub format: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steam_app_id: Option<u32>,
    /// `false` until the release data is checked against a primary source.
    #[serde(default)]
    pub verified: bool,
}

/// A tool, emulator, wiki or store around a game.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ecosystem {
    pub kind: String,
    pub name: String,
    pub url: String,
}

/// Per-game manifest.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub title: String,
    pub series: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    /// Bumped whenever the manifest changes; drives `update`.
    pub revision: u32,
    #[serde(default)]
    pub features: BTreeMap<Feature, Support>,
    pub releases: Vec<Release>,
    #[serde(default)]
    pub ecosystem: Vec<Ecosystem>,
}

impl Game {
    pub fn support(&self, feature: Feature) -> Support {
        self.features.get(&feature).copied().unwrap_or_default()
    }

    pub fn release(&self, platform: Platform) -> Option<&Release> {
        self.releases.iter().find(|r| r.platform == platform)
    }

    pub fn platforms(&self) -> impl Iterator<Item = Platform> + '_ {
        self.releases.iter().map(|r| r.platform)
    }

    pub fn matches(&self, key: &str) -> bool {
        self.id == key || self.aliases.iter().any(|a| a == key)
    }
}
