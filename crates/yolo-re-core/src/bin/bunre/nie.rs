//! Native entry point for the migrated NIE binary reverse-engineering workflow.

use std::path::Path;
use std::process::ExitCode;

use aphrody_nie_index::{Db, query};
use sha2::{Digest, Sha256};

const IMAGE_BASE: i64 = 0x1_4000_0000;

fn usage() -> ExitCode {
    eprintln!(
        "usage: bunre nie <index|pdata|rebuild|coverage> ...\n\
         index <database.sqlite> <binary>\n\
         pdata <database.sqlite> <binary>\n\
         ghidra-import <database.sqlite> <binary-id> <functions.csv>\n\
         rebuild <database.sqlite> <binary> [propagation-rounds]\n\
         recover <database.sqlite> <binary> [--dry-run] [--ghidra-csv functions.csv]\n\
         coverage <database.sqlite> <binary-id>"
    );
    ExitCode::from(2)
}

fn register_binary(db: &Db, path: &Path) -> anyhow::Result<(i64, String)> {
    let bytes = std::fs::read(path)?;
    let digest = Sha256::digest(&bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let path_text = path.to_string_lossy();
    let size = i64::try_from(bytes.len())?;
    let id = db.upsert_binary(
        &path_text, &digest, "x86_64", 64, IMAGE_BASE, size, None, None,
    )?;
    Ok((id, digest))
}

/// Run the NIE-specific PE indexing and recovery workflow.
pub fn main(args: impl Iterator<Item = std::ffi::OsString>) -> ExitCode {
    let mut args = args;
    let Some(command) = args.next().and_then(|s| s.into_string().ok()) else {
        return usage();
    };
    let args = args.map(|s| s.into_string()).collect::<Result<Vec<_>, _>>();
    let Ok(args) = args else {
        eprintln!("bunre nie: arguments must be valid Unicode");
        return ExitCode::from(2);
    };

    let result = (|| -> anyhow::Result<()> {
        match command.as_str() {
            "index" | "pdata" => {
                if args.len() != 2 {
                    return Err(anyhow::anyhow!("expected database path and binary path"));
                }
                let mut db = Db::open(&args[0])?;
                let path = Path::new(&args[1]);
                let (binary_id, digest) = register_binary(&db, path)?;
                if command == "index" {
                    let report = bun_re::nie::indexer::triage_into(&mut db, binary_id, path)?;
                    println!("indexed id={binary_id} sha256={digest} {report:?}");
                } else {
                    let report = bun_re::nie::pdata::discover_into(&mut db, binary_id, path)?;
                    println!("pdata id={binary_id} sha256={digest} {report:?}");
                }
            }
            "ghidra-import" => {
                if args.len() != 3 {
                    return Err(anyhow::anyhow!(
                        "expected database path, binary id, and Ghidra functions CSV"
                    ));
                }
                let mut db = Db::open(&args[0])?;
                let binary_id: i64 = args[1].parse()?;
                let report = bun_re::nie::ghidra_import::ingest_ghidra_csv(
                    &mut db,
                    binary_id,
                    Path::new(&args[2]),
                )?;
                println!("ghidra import binary_id={binary_id} {report:?}");
            }
            "rebuild" => {
                if !(2..=3).contains(&args.len()) {
                    return Err(anyhow::anyhow!(
                        "expected database path, binary path, and optional propagation rounds"
                    ));
                }
                let rounds = args.get(2).map_or(Ok(16usize), |s| s.parse())?;
                let mut db = Db::open(&args[0])?;
                let path = Path::new(&args[1]);
                let (source_binary_id, digest) = register_binary(&db, path)?;
                let report = bun_re::nie::workflow::rebuild(
                    &mut db,
                    path,
                    bun_re::nie::workflow::RebuildOptions {
                        source_binary_id,
                        image_base: IMAGE_BASE,
                        rounds,
                        skip_indirect: false,
                    },
                )?;
                println!("rebuild sha256={digest} {report:?}");
            }
            "recover" => {
                if args.len() < 2 {
                    return Err(anyhow::anyhow!("expected database path and binary path"));
                }
                let dry_run = args.iter().any(|arg| arg == "--dry-run");
                let csv = args
                    .windows(2)
                    .find(|pair| pair[0] == "--ghidra-csv")
                    .map(|pair| std::path::PathBuf::from(&pair[1]));
                let mut db = Db::open(&args[0])?;
                let path = Path::new(&args[1]);
                let (binary_id, digest) = register_binary(&db, path)?;
                let report = bun_re::nie::workflow::recover(
                    &mut db,
                    path,
                    &bun_re::nie::workflow::RecoverOptions {
                        binary_id,
                        dry_run,
                        ghidra_csv: csv,
                    },
                )?;
                println!("recover sha256={digest} {report:?}");
            }
            "coverage" => {
                if args.len() != 2 {
                    return Err(anyhow::anyhow!("expected database path and binary id"));
                }
                let db = Db::open(&args[0])?;
                let binary_id: i64 = args[1].parse()?;
                let coverage = query::coverage(db.conn(), binary_id)?;
                println!(
                    "binary_id={binary_id} total={} named={} classified={} coverage={:.2}%",
                    coverage.total, coverage.named, coverage.classified, coverage.pct
                );
            }
            _ => return Err(anyhow::anyhow!("unknown NIE command `{command}`")),
        }
        Ok(())
    })();

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("bunre nie {command}: {error:#}");
            ExitCode::from(1)
        }
    }
}
