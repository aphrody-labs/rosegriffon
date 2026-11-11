// SPDX-License-Identifier: Apache-2.0
//! Native CLI adapters for bounded raw-byte disassembly and string extraction.

use std::process::ExitCode;

const MAX_DISASSEMBLY: usize = 256;
const MAX_STRINGS: usize = 100_000;

fn value(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|arg| arg == name)
        .and_then(|index| args.get(index + 1))
        .cloned()
}

pub fn disasm(args: impl Iterator<Item = std::ffi::OsString>) -> ExitCode {
    let args = match args
        .map(|arg| arg.into_string())
        .collect::<Result<Vec<_>, _>>()
    {
        Ok(args) => args,
        Err(_) => {
            eprintln!("bunre disasm: arguments must be valid Unicode");
            return ExitCode::from(2);
        }
    };
    let Some(hex) = args.first().filter(|arg| !arg.starts_with("--")) else {
        eprintln!("usage: bunre disasm <hex-bytes> [--rip <address>] [--limit <count>]");
        return ExitCode::from(2);
    };
    let bytes = match hex::decode(hex) {
        Ok(bytes) if !bytes.is_empty() => bytes,
        Ok(_) => {
            eprintln!("bunre disasm: byte input is empty");
            return ExitCode::from(2);
        }
        Err(error) => {
            eprintln!("bunre disasm: invalid hexadecimal byte input: {error}");
            return ExitCode::from(2);
        }
    };
    let rip = match value(&args, "--rip")
        .map(|value| parse_integer(&value))
        .transpose()
    {
        Ok(value) => value.unwrap_or(0x1000),
        Err(error) => {
            eprintln!("bunre disasm: {error}");
            return ExitCode::from(2);
        }
    };
    let limit = match value(&args, "--limit")
        .map(|value| value.parse::<usize>())
        .transpose()
    {
        Ok(value) => value.unwrap_or(32),
        Err(error) => {
            eprintln!("bunre disasm: invalid --limit: {error}");
            return ExitCode::from(2);
        }
    };
    if limit == 0 || limit > MAX_DISASSEMBLY {
        eprintln!("bunre disasm: --limit must be between 1 and {MAX_DISASSEMBLY}");
        return ExitCode::from(2);
    }
    let result = bun_re::disasm(&bytes, rip, limit);
    println!("{}", serde_json::to_string(&result).unwrap_or_default());
    ExitCode::SUCCESS
}

pub fn strings(args: impl Iterator<Item = std::ffi::OsString>) -> ExitCode {
    let args = match args
        .map(|arg| arg.into_string())
        .collect::<Result<Vec<_>, _>>()
    {
        Ok(args) => args,
        Err(_) => {
            eprintln!("bunre strings: arguments must be valid Unicode");
            return ExitCode::from(2);
        }
    };
    let Some(path) = args.first().filter(|arg| !arg.starts_with("--")) else {
        eprintln!("usage: bunre strings <input> [--min-length <count>] [--limit <count>]");
        return ExitCode::from(2);
    };
    let min_length = match value(&args, "--min-length")
        .map(|value| value.parse::<usize>())
        .transpose()
    {
        Ok(value) => value.unwrap_or(bun_re::STRINGS_MIN_LEN),
        Err(error) => {
            eprintln!("bunre strings: invalid --min-length: {error}");
            return ExitCode::from(2);
        }
    };
    let limit = match value(&args, "--limit")
        .map(|value| value.parse::<usize>())
        .transpose()
    {
        Ok(value) => value.unwrap_or(bun_re::STRINGS_SAMPLE_LIMIT),
        Err(error) => {
            eprintln!("bunre strings: invalid --limit: {error}");
            return ExitCode::from(2);
        }
    };
    if min_length == 0 || limit == 0 || limit > MAX_STRINGS {
        eprintln!(
            "bunre strings: minimum length and limit must be positive; limit is capped at {MAX_STRINGS}"
        );
        return ExitCode::from(2);
    }
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) => {
            eprintln!("bunre strings: {path}: {error}");
            return ExitCode::from(1);
        }
    };
    let strings = bun_re::extract_strings(&bytes, min_length, limit);
    let result = serde_json::json!({
        "path": path,
        "size": bytes.len(),
        "minLength": min_length,
        "limit": limit,
        "count": strings.len(),
        "strings": strings,
    });
    println!("{}", serde_json::to_string(&result).unwrap_or_default());
    ExitCode::SUCCESS
}

fn parse_integer(value: &str) -> Result<u64, String> {
    if let Some(hex) = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
    {
        u64::from_str_radix(hex, 16).map_err(|error| error.to_string())
    } else {
        value.parse::<u64>().map_err(|error| error.to_string())
    }
}
