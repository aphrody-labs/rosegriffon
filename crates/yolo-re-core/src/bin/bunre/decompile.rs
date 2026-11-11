// SPDX-License-Identifier: Apache-2.0
//! Rust-native Ghidra decompiler port entry points.

use std::path::PathBuf;
use std::process::ExitCode;

const USAGE: &str =
    "usage: bunre decompile functions <binary> [--discover] | address <binary> <address>";

pub fn main(args: impl Iterator<Item = std::ffi::OsString>) -> ExitCode {
    let args = args.collect::<Vec<_>>();
    let Some(command) = args.first().and_then(|value| value.to_str()) else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    let Some(path) = args.get(1) else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    let path = PathBuf::from(path);
    let result = match command {
        "functions" if args.len() == 2 => list_functions(&path, false),
        "functions" if args.len() == 3 && args[2] == "--discover" => list_functions(&path, true),
        "address" if args.len() == 3 => match parse_address(args[2].to_str()) {
            Some(address) => decompile_address(&path, address),
            None => {
                eprintln!(
                    "bunre decompile: address must be an unsigned decimal or 0x-prefixed hexadecimal value"
                );
                return ExitCode::from(2);
            }
        },
        _ => {
            eprintln!("{USAGE}");
            return ExitCode::from(2);
        }
    };
    match result {
        Ok(json) => {
            println!("{json}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("bunre decompile: {error}");
            ExitCode::from(1)
        }
    }
}

fn list_functions(
    path: &std::path::Path,
    discover: bool,
) -> Result<String, Box<dyn std::error::Error>> {
    let functions = if discover {
        bun_re::decompile::discover_functions(path)?
    } else {
        bun_re::decompile::functions(path)?
    };
    let functions = functions
        .into_iter()
        .map(|function| {
            serde_json::json!({
                "name": function.name,
                "symbol": function.symbol,
                "address": format!("0x{:x}", function.address),
                "source": format!("{:?}", function.source),
            })
        })
        .collect::<Vec<_>>();
    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "binary": path.display().to_string(),
        "discovery_requested": discover,
        "function_count": functions.len(),
        "functions": functions,
    }))?)
}

fn decompile_address(
    path: &std::path::Path,
    address: u64,
) -> Result<String, Box<dyn std::error::Error>> {
    let c = bun_re::decompile::decompile(path, address)?;
    Ok(serde_json::to_string_pretty(&serde_json::json!({
        "binary": path.display().to_string(),
        "address": format!("0x{address:x}"),
        "decompiler": "ghidra-decompiler-rust-port",
        "code": c,
    }))?)
}

fn parse_address(value: Option<&str>) -> Option<u64> {
    let value = value?;
    if let Some(hex) = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
    {
        u64::from_str_radix(hex, 16).ok()
    } else {
        value.parse().ok()
    }
}
