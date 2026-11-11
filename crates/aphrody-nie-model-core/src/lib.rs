//! Offline character model catalogs and CPU menu composition for IEVR reverse engineering.
//!
//! This library contains only byte-backed catalog decoders and deterministic PNG composition.
//! It does not include the upstream live GLB HTTP service, filesystem mirror access, SQL/network
//! server, runtime game state, WASM host, or WGPU renderer.

#![forbid(unsafe_code)]
#![allow(clippy::pedantic)]

pub mod catalog;
pub mod menu;
