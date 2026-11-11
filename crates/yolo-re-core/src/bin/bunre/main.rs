// SPDX-License-Identifier: Apache-2.0
//! `bunre`: the native half of the Bun OS `re` product. One binary, one subcommand per capability:
//! `pipeline` (cross-OS RE pipeline, feature `pipeline`), `recompile` (static recompilation of
//! console BIOS/ROM images to native executables and WebAssembly over the pipeline), `game`
//! (game-agnostic asset pipeline: detect, mount, index, export and serve any installed game,
//! feature `assets`) and `dbxv2` (Dragon Ball Xenoverse 2 inventory and archives). Steam depot
//! acquisition is `bun-steam-depot` (crate `bun-steam`).

mod dbxv2;
#[cfg(feature = "decompile")]
mod decompile;
#[cfg(feature = "game-formats")]
mod formats;
#[cfg(feature = "assets")]
mod game;
mod inspect;
#[cfg(feature = "nie")]
mod nie;
#[cfg(feature = "pipeline")]
mod pipeline;
mod steam_install;
#[cfg(feature = "assets")]
mod vfs;

use std::ffi::OsString;
use std::process::ExitCode;

const USAGE: &str = "usage: bunre <pipeline|recompile|game|vfs|dbxv2|nie|formats|steam|cpu|virtualization|disasm|strings|decompile> ...";

fn main() -> ExitCode {
    let mut args = std::env::args_os().skip(1);
    let Some(command) = args.next() else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    match command.to_str() {
        Some("cpu") => {
            let cpu_info = bun_re::cpu::detect_cpu();
            match serde_json::to_string_pretty(&cpu_info) {
                Ok(json) => {
                    println!("{json}");
                    ExitCode::SUCCESS
                }
                Err(e) => {
                    eprintln!("bunre cpu error: {e}");
                    ExitCode::from(1)
                }
            }
        }
        Some("virtualization") => {
            let virt_info = bun_re::virtualization::detect_virtualization();
            match serde_json::to_string_pretty(&virt_info) {
                Ok(json) => {
                    println!("{json}");
                    ExitCode::SUCCESS
                }
                Err(e) => {
                    eprintln!("bunre virtualization error: {e}");
                    ExitCode::from(1)
                }
            }
        }
        Some("dbxv2") => dbxv2::main(args),
        Some("steam") => steam_install::main(args),
        Some("disasm") => inspect::disasm(args),
        Some("strings") => inspect::strings(args),
        #[cfg(feature = "decompile")]
        Some("decompile") => decompile::main(args),
        #[cfg(not(feature = "decompile"))]
        Some("decompile") => {
            eprintln!(
                "bunre: this build lacks the `decompile` feature (build with --features decompile)"
            );
            ExitCode::from(2)
        }
        #[cfg(feature = "game-formats")]
        Some("formats") => formats::main(args),
        #[cfg(not(feature = "game-formats"))]
        Some("formats") => {
            eprintln!(
                "bunre: this build lacks the `game-formats` feature (build with --features game-formats)"
            );
            ExitCode::from(2)
        }
        #[cfg(feature = "nie")]
        Some("nie") => nie::main(args),
        #[cfg(not(feature = "nie"))]
        Some("nie") => {
            eprintln!("bunre: this build lacks the `nie` feature (build with --features nie)");
            ExitCode::from(2)
        }
        #[cfg(feature = "assets")]
        Some("vfs") => vfs::main(args),
        #[cfg(feature = "assets")]
        Some("game") => game::main(args),
        #[cfg(not(feature = "assets"))]
        Some("game") => {
            eprintln!(
                "bunre: this build lacks the `assets` feature (build with --features assets)"
            );
            ExitCode::from(2)
        }
        #[cfg(feature = "pipeline")]
        Some("pipeline") => match args
            .map(OsString::into_string)
            .collect::<Result<Vec<_>, _>>()
        {
            Ok(args) => pipeline::main(args),
            Err(_) => {
                eprintln!("bunre pipeline: arguments must be valid Unicode");
                ExitCode::from(2)
            }
        },
        #[cfg(feature = "pipeline")]
        Some("recompile") => match args
            .map(OsString::into_string)
            .collect::<Result<Vec<_>, _>>()
        {
            Ok(args) => pipeline::recompile(args),
            Err(_) => {
                eprintln!("bunre recompile: arguments must be valid Unicode");
                ExitCode::from(2)
            }
        },
        #[cfg(not(feature = "pipeline"))]
        Some("pipeline" | "recompile") => {
            eprintln!("bunre: this build lacks the `pipeline` feature");
            ExitCode::from(2)
        }
        _ => {
            eprintln!("{USAGE}");
            ExitCode::from(2)
        }
    }
}
