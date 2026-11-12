use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use nie_pkg::{Feature, Platform, Registry, Store};

/// NIE game package manager.
#[derive(Parser)]
#[command(name = "nie-pkg", version)]
struct Cli {
    /// Install root (records live in <root>/installed).
    #[arg(long, env = "NIE_PKG_ROOT", default_value = ".nie")]
    root: PathBuf,
    /// Registry file; defaults to the embedded one.
    #[arg(long, env = "NIE_PKG_REGISTRY")]
    registry: Option<PathBuf>,
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// List registry games (or installed ones with --installed).
    List {
        #[arg(long)]
        installed: bool,
        #[arg(long)]
        platform: Option<String>,
    },
    /// Show one game manifest as TOML.
    Info { game: String },
    /// Print the games x features matrix as Markdown.
    Matrix,
    /// Register a dump you own and hash it.
    Install {
        game: String,
        #[arg(long)]
        platform: String,
        #[arg(long)]
        from: PathBuf,
    },
    /// Rehash an installed dump.
    Verify { game: String },
    /// Move an install to the registry manifest revision.
    Update { game: String },
    /// Forget an install (the dump itself is untouched).
    Remove { game: String },
}

fn platform(s: &str) -> Result<Platform, String> {
    Platform::parse(s).ok_or_else(|| {
        let all: Vec<_> = Platform::ALL.iter().map(|p| p.as_str()).collect();
        format!(
            "unknown platform `{s}` (expected one of {})",
            all.join(", ")
        )
    })
}

fn run(cli: Cli) -> Result<(), String> {
    let registry = match &cli.registry {
        Some(p) => {
            let text = std::fs::read_to_string(p).map_err(|e| format!("{}: {e}", p.display()))?;
            Registry::from_toml(&text).map_err(|e| e.to_string())?
        }
        None => Registry::embedded(),
    };
    let store = Store::new(&cli.root);
    match cli.cmd {
        Cmd::List {
            installed: true, ..
        } => {
            for r in store.list().map_err(|e| e.to_string())? {
                println!(
                    "{}\t{}\trev {}\t{} files",
                    r.id,
                    r.platform,
                    r.revision,
                    r.files.len()
                );
            }
        }
        Cmd::List {
            installed: false,
            platform: p,
        } => {
            let filter = p.as_deref().map(platform).transpose()?;
            for g in &registry.games {
                if filter.is_some_and(|f| g.release(f).is_none()) {
                    continue;
                }
                let plats: Vec<_> = g.platforms().map(Platform::as_str).collect();
                let full = Feature::ALL
                    .iter()
                    .filter(|f| g.support(**f) == nie_pkg::Support::Full)
                    .count();
                println!(
                    "{}\t{}\t[{}]\t{full}/{} features full",
                    g.id,
                    g.title,
                    plats.join(","),
                    Feature::ALL.len()
                );
            }
        }
        Cmd::Info { game } => {
            let g = registry
                .get(&game)
                .ok_or(format!("unknown game `{game}`"))?;
            print!("{}", toml::to_string(g).map_err(|e| e.to_string())?);
        }
        Cmd::Matrix => print!("{}", registry.feature_matrix_markdown()),
        Cmd::Install {
            game,
            platform: p,
            from,
        } => {
            let rec = store
                .install(&registry, &game, platform(&p)?, &from)
                .map_err(|e| e.to_string())?;
            println!(
                "installed {} on {} ({} files)",
                rec.id,
                rec.platform,
                rec.files.len()
            );
        }
        Cmd::Verify { game } => {
            let rep = store.verify(&game).map_err(|e| e.to_string())?;
            println!(
                "ok {} missing {} changed {}",
                rep.ok,
                rep.missing.len(),
                rep.changed.len()
            );
            for m in &rep.missing {
                println!("missing\t{m}");
            }
            for c in &rep.changed {
                println!("changed\t{c}");
            }
            if !rep.is_clean() {
                return Err(format!("{game}: verification failed"));
            }
        }
        Cmd::Update { game } => match store.update(&registry, &game).map_err(|e| e.to_string())? {
            Some(rev) => println!("{game} updated to revision {rev}"),
            None => println!("{game} is up to date"),
        },
        Cmd::Remove { game } => {
            store.remove(&game).map_err(|e| e.to_string())?;
            println!("removed {game}");
        }
    }
    Ok(())
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("nie-pkg: {e}");
            ExitCode::FAILURE
        }
    }
}
