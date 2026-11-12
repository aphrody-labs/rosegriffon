//! NIE game package manager.
//!
//! - [`Registry`]: every Inazuma Eleven game, its releases per platform, its
//!   feature support and its ecosystem, loaded from TOML (an embedded default
//!   ships in `registry/games.toml`).
//! - [`Store`]: a local install root. `install` registers a dump the user owns
//!   and records a BLAKE3 hash per file; `verify` rehashes; `update` moves the
//!   recorded manifest revision to the registry one. No game content is ever
//!   downloaded or copied.

mod model;
mod registry;
mod store;

pub use model::{Ecosystem, Feature, Game, Platform, Release, Support};
pub use registry::{Registry, RegistryError};
pub use store::{FileRecord, Installed, Store, StoreError, VerifyReport};
