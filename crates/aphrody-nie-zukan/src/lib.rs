//! Static Inagle encyclopedia data tools for reverse-engineering Inazuma Eleven assets.
//!
//! This port includes offline HTML parsing, query encoding/decoding, bounded JSON matching,
//! fuzzy matching against local Inagle records, and optional SQLite correlation. The live,
//! rate-limited pull of zukan.inazuma.jp ([`client`], [`pull`] and the `aphrody-nie-zukan` CLI)
//! sits behind the `pull` feature and delegates transport to the crates.io `aphrody-web-crawl`.

#![forbid(unsafe_code)]

pub mod api;
#[cfg(feature = "pull")]
pub mod client;
#[cfg(feature = "sqlite")]
pub mod cross;
pub mod forge;
pub mod matching;
pub mod models;
pub mod parser;
#[cfg(feature = "pull")]
pub mod pull;
