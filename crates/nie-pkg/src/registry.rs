use std::collections::BTreeSet;
use std::fmt::Write as _;

use serde::{Deserialize, Serialize};

use crate::model::{Feature, Game, Platform};

const EMBEDDED: &str = include_str!("../registry/games.toml");
const SCHEMA: u32 = 1;

#[derive(Debug, thiserror::Error)]
pub enum RegistryError {
    #[error("registry parse error: {0}")]
    Parse(#[from] toml::de::Error),
    #[error("unsupported registry schema {0}, expected {SCHEMA}")]
    Schema(u32),
    #[error("duplicate game id or alias `{0}`")]
    Duplicate(String),
    #[error("game `{0}` has no release")]
    NoRelease(String),
    #[error("game `{0}` lists platform `{1}` twice")]
    DuplicatePlatform(String, Platform),
}

/// All known games.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Registry {
    pub schema: u32,
    #[serde(rename = "game")]
    pub games: Vec<Game>,
}

impl Registry {
    /// The registry compiled into the binary.
    pub fn embedded() -> Registry {
        Registry::from_toml(EMBEDDED).expect("embedded registry is validated by tests")
    }

    pub fn from_toml(src: &str) -> Result<Registry, RegistryError> {
        let reg: Registry = toml::from_str(src)?;
        reg.validate()?;
        Ok(reg)
    }

    pub fn to_toml(&self) -> String {
        toml::to_string(self).expect("registry types always serialize")
    }

    fn validate(&self) -> Result<(), RegistryError> {
        if self.schema != SCHEMA {
            return Err(RegistryError::Schema(self.schema));
        }
        let mut keys = BTreeSet::new();
        for g in &self.games {
            for k in std::iter::once(&g.id).chain(&g.aliases) {
                if !keys.insert(k.as_str()) {
                    return Err(RegistryError::Duplicate(k.clone()));
                }
            }
            if g.releases.is_empty() {
                return Err(RegistryError::NoRelease(g.id.clone()));
            }
            let mut seen = BTreeSet::new();
            for r in &g.releases {
                if !seen.insert(r.platform) {
                    return Err(RegistryError::DuplicatePlatform(g.id.clone(), r.platform));
                }
            }
        }
        Ok(())
    }

    /// Lookup by id or alias.
    pub fn get(&self, key: &str) -> Option<&Game> {
        self.games.iter().find(|g| g.matches(key))
    }

    pub fn on_platform(&self, platform: Platform) -> impl Iterator<Item = &Game> {
        self.games
            .iter()
            .filter(move |g| g.release(platform).is_some())
    }

    /// Markdown feature matrix: one row per game, one column per feature,
    /// plus the platform list.
    pub fn feature_matrix_markdown(&self) -> String {
        let mut out = String::from("| Game | Platforms |");
        for f in Feature::ALL {
            let _ = write!(out, " {} |", f.as_str());
        }
        out.push_str("\n|---|---|");
        for _ in Feature::ALL {
            out.push_str("---|");
        }
        out.push('\n');
        for g in &self.games {
            let plats: Vec<&str> = g.platforms().map(Platform::as_str).collect();
            let _ = write!(out, "| {} (`{}`) | {} |", g.title, g.id, plats.join(", "));
            for f in Feature::ALL {
                let _ = write!(out, " {} |", g.support(f).as_str());
            }
            out.push('\n');
        }
        out
    }
}
