// SPDX-License-Identifier: Apache-2.0
//! `bun-steam-depot`: steamcmd replacement for our use case (login once, then unattended
//! `update` / `verify` of Windows depots onto any OS).
//!
//! Exit codes: 0 ok, 1 error, 2 login required (no token, expired or revoked), 64 usage.
//!
//! Credentials: the password and the Steam Guard code are read from the terminal only, never
//! from argv, never logged. Only the refresh token, account name and steamid are stored.

use std::io::{BufRead, Write};
use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result, bail};
use bun_steam::IEVR_STEAM_APP_ID;
use bun_steam::depot::auth::format_unix_utc;
use bun_steam::depot::downloader::SteamDepotDownloader;
use bun_steam::depot::options::{
    GuardCodeFuture, SteamDownloadOptions, SteamGuardKind, SteamGuardProvider, TransferOptions,
};
use bun_steam::depot::session::{NeedsLogin, SteamSession};
use bun_steam::depot::token_backend::{self, StoreKind, TokenBackend};
use clap::{Args, Parser, Subcommand};

const EXIT_NEEDS_LOGIN: u8 = 2;

#[derive(Parser)]
#[command(
    name = "bun-steam-depot",
    version,
    about = "Steam depot client (login, update, verify)"
)]
struct Cli {
    /// Directory holding the token file (`steam-tokens.json`, mode 0600).
    #[arg(long, env = "STEAM_HOME", global = true)]
    steam_home: Option<PathBuf>,
    /// Canonical token store: file, env, cloudflare, github.
    #[arg(long, env = "STEAM_TOKEN_STORE", default_value = "file", global = true)]
    store: String,
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Interactive one-time login: password and Steam Guard typed on the terminal.
    Login {
        /// Steam account name (default: STEAM_ACCOUNT_NAME).
        #[arg(env = "STEAM_ACCOUNT_NAME")]
        user: String,
    },
    /// Download or update the app into the target directory (resumable, skips valid files).
    Update(Target),
    /// Same as `update` with every existing file hashed against the manifest (steamcmd `validate`).
    Verify(Target),
    /// List the depots selected for the app without downloading.
    List(Target),
    /// Token management.
    Auth {
        #[command(subcommand)]
        op: AuthOp,
    },
}

#[derive(Subcommand)]
enum AuthOp {
    /// Account, steamid, token expiry and store kind. Never the token.
    Status,
    /// Copy the current token into another store once.
    Export {
        #[arg(long)]
        to: String,
    },
}

#[derive(Args, Clone)]
struct Target {
    /// Steam app id (default: IEVR).
    #[arg(long, env = "STEAM_APP_ID", default_value_t = IEVR_STEAM_APP_ID)]
    app: u32,
    /// Install directory (steamcmd `force_install_dir`).
    #[arg(long, short = 'o', env = "STEAM_INSTALL_DIR", default_value = ".")]
    dir: PathBuf,
    /// Steam account (default: the only stored account).
    #[arg(long, short = 'u', env = "STEAM_USER")]
    user: Option<String>,
    #[arg(long, default_value = "public")]
    branch: String,
    /// Depot platform filter (steamcmd `@sSteamCmdForcePlatformType`).
    #[arg(long, env = "STEAM_PLATFORM", default_value = "windows")]
    os: String,
    #[arg(long, default_value = "english")]
    language: String,
    /// Explicit depot ids (repeatable).
    #[arg(long = "depot")]
    depots: Vec<u32>,
    /// Concurrent chunk downloads.
    #[arg(long, env = "STEAM_MAX_DOWNLOADS", default_value_t = 32)]
    max_downloads: usize,
    /// Network cap in bytes per second (0 = unlimited).
    #[arg(long, env = "STEAM_MAX_RATE", default_value_t = 0)]
    max_rate: u64,
    /// Optional on-disk chunk cache (off by default: it would duplicate the install).
    #[arg(long, env = "STEAM_CHUNK_CACHE")]
    chunk_cache: Option<PathBuf>,
}

fn main() -> ExitCode {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_env("STEAM_LOG")
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_writer(std::io::stderr)
        .try_init();
    let cli = Cli::parse();
    let rt = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(rt) => rt,
        Err(e) => {
            eprintln!("error: tokio runtime: {e}");
            return ExitCode::FAILURE;
        }
    };
    match rt.block_on(run(cli)) {
        Ok(code) => code,
        Err(e) => {
            eprintln!("error: {e:#}");
            if e.chain().any(|c| c.is::<NeedsLogin>()) {
                ExitCode::from(EXIT_NEEDS_LOGIN)
            } else {
                ExitCode::FAILURE
            }
        }
    }
}

fn token_file(cli: &Cli) -> Option<PathBuf> {
    cli.steam_home.as_ref().map(|h| h.join("steam-tokens.json"))
}

async fn run(cli: Cli) -> Result<ExitCode> {
    let kind: StoreKind = cli.store.parse()?;
    let store = token_backend::open(kind, token_file(&cli))?;
    match &cli.cmd {
        Cmd::Login { user } => login(store, user).await,
        Cmd::Update(t) => download(store, t, false).await,
        Cmd::Verify(t) => download(store, t, true).await,
        Cmd::List(t) => list(store, t).await,
        Cmd::Auth { op: AuthOp::Status } => status(store).await,
        Cmd::Auth {
            op: AuthOp::Export { to },
        } => {
            let target = token_backend::open(to.parse()?, token_file(&cli))?;
            export(store, target).await
        }
    }
}

fn options(store: Arc<dyn TokenBackend>, t: &Target, hash_all: bool) -> SteamDownloadOptions {
    let mut o = SteamDownloadOptions::ievr(t.dir.clone());
    o.app_id = t.app;
    o.username = t.user.clone();
    o.branch = t.branch.clone();
    o.os = t.os.clone();
    o.language = t.language.clone();
    o.depot_ids = t.depots.clone();
    o.max_downloads = t.max_downloads.max(1);
    // `verify` keeps already-correct files (resume after interruption, delta update); the
    // explicit `verify` command is the same pass, reported as a validate run.
    o.verify = true;
    o.token_backend = Some(store);
    o.stall_timeout = Some(Duration::from_secs(if hash_all { 900 } else { 300 }));
    o.transfer = TransferOptions {
        max_rate_bytes_per_sec: t.max_rate,
        chunk_cache_dir: t.chunk_cache.clone(),
        ..TransferOptions::default()
    };
    o
}

async fn login(store: Arc<dyn TokenBackend>, user: &str) -> Result<ExitCode> {
    let password = prompt_secret(&format!("Steam password for {user}: "))?;
    if password.is_empty() {
        bail!("empty password");
    }
    let mut o = SteamDownloadOptions::ievr(PathBuf::from("."));
    o.username = Some(user.to_owned());
    o.password = Some(password);
    o.token_backend = Some(store.clone());
    o.guard_provider = Some(Arc::new(TtyGuard));
    let session = SteamSession::connect(&o).await?;
    drop(session);
    eprintln!("login ok, token stored in `{}`", store.kind().as_str());
    status(store).await
}

async fn download(store: Arc<dyn TokenBackend>, t: &Target, hash_all: bool) -> Result<ExitCode> {
    std::fs::create_dir_all(&t.dir).with_context(|| format!("create {}", t.dir.display()))?;
    let opts = options(store, t, hash_all);
    let r = SteamDepotDownloader::new().download_app(&opts, None).await;
    if r.success {
        println!(
            "ok mode={} app={} depots={:?} files={} downloaded_bytes={} duration={:.1}s dir={}",
            if hash_all { "verify" } else { "update" },
            r.app_id,
            r.depots,
            r.file_count,
            r.downloaded_bytes,
            r.duration.as_secs_f64(),
            r.install_dir.display()
        );
        return Ok(ExitCode::SUCCESS);
    }
    eprintln!("error: {}", r.error.as_deref().unwrap_or("unknown"));
    Ok(if r.needs_login {
        ExitCode::from(EXIT_NEEDS_LOGIN)
    } else {
        ExitCode::FAILURE
    })
}

async fn list(store: Arc<dyn TokenBackend>, t: &Target) -> Result<ExitCode> {
    let opts = options(store, t, false);
    for d in SteamDepotDownloader::new().list_depots(&opts).await? {
        println!(
            "depot={} name={} manifest={} files={} bytes={}",
            d.depot_id,
            d.name.as_deref().unwrap_or("-"),
            d.manifest_id,
            d.file_count,
            d.total_bytes
        );
    }
    Ok(ExitCode::SUCCESS)
}

async fn status(store: Arc<dyn TokenBackend>) -> Result<ExitCode> {
    let user = std::env::var("STEAM_USER").ok().filter(|u| !u.is_empty());
    let Some(t) = store.load(user.as_deref()).await? else {
        println!("store={} account=- logged_in=false", store.kind().as_str());
        return Ok(ExitCode::from(EXIT_NEEDS_LOGIN));
    };
    let c = t.claims();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    println!(
        "store={} account={} steamid={} expires={} expired={}",
        store.kind().as_str(),
        t.account,
        t.steam_id
            .or(c.steam_id)
            .map_or_else(|| "-".to_owned(), |s| s.to_string()),
        c.expires_at.map_or_else(|| "-".to_owned(), format_unix_utc),
        c.is_expired(now)
    );
    Ok(if c.is_expired(now) {
        ExitCode::from(EXIT_NEEDS_LOGIN)
    } else {
        ExitCode::SUCCESS
    })
}

async fn export(from: Arc<dyn TokenBackend>, to: Arc<dyn TokenBackend>) -> Result<ExitCode> {
    let user = std::env::var("STEAM_USER").ok().filter(|u| !u.is_empty());
    let Some(t) = from.load(user.as_deref()).await? else {
        bail!(NeedsLogin {
            account: user.unwrap_or_else(|| "-".into()),
            reason: "aucun refresh token"
        });
    };
    to.save(&t).await?;
    println!(
        "exported account={} from={} to={}",
        t.account,
        from.kind().as_str(),
        to.kind().as_str()
    );
    Ok(ExitCode::SUCCESS)
}

/// Steam Guard code typed on the terminal.
struct TtyGuard;

impl SteamGuardProvider for TtyGuard {
    fn get_code(&self, kind: SteamGuardKind, email: Option<&str>, again: bool) -> GuardCodeFuture {
        let label = match kind {
            SteamGuardKind::Device => "Steam Guard code (mobile app)".to_owned(),
            SteamGuardKind::Email => format!("Steam Guard code (email {})", email.unwrap_or("")),
        };
        let prefix = if again { "Code rejected. " } else { "" };
        Box::pin(async move {
            let code =
                tokio::task::spawn_blocking(move || prompt_line(&format!("{prefix}{label}: ")))
                    .await??;
            Ok(code.trim().to_owned())
        })
    }
}

fn prompt_line(msg: &str) -> Result<String> {
    let mut err = std::io::stderr();
    err.write_all(msg.as_bytes())?;
    err.flush()?;
    let mut line = String::new();
    std::io::stdin().lock().read_line(&mut line)?;
    Ok(line.trim_end_matches(['\r', '\n']).to_owned())
}

/// Reads a line with terminal echo disabled (Unix). Elsewhere the input is visible.
fn prompt_secret(msg: &str) -> Result<String> {
    #[cfg(unix)]
    {
        use std::os::fd::AsRawFd;
        let fd = std::io::stdin().as_raw_fd();
        // SAFETY: plain termios calls on stdin; the original mode is restored before returning.
        let mut term: libc::termios = unsafe { std::mem::zeroed() };
        let is_tty = unsafe { libc::tcgetattr(fd, &mut term) } == 0;
        if is_tty {
            let mut silent = term;
            silent.c_lflag &= !libc::ECHO;
            unsafe { libc::tcsetattr(fd, libc::TCSANOW, &silent) };
        }
        let r = prompt_line(msg);
        if is_tty {
            unsafe { libc::tcsetattr(fd, libc::TCSANOW, &term) };
            eprintln!();
        }
        r
    }
    #[cfg(not(unix))]
    {
        prompt_line(msg)
    }
}
