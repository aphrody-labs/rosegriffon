// SPDX-License-Identifier: Apache-2.0
//! Pluggable refresh-token stores, selected by `STEAM_TOKEN_STORE`.
//!
//! | Kind         | Read                         | Write (rotation)                         |
//! | ------------ | ---------------------------- | ---------------------------------------- |
//! | `file`       | `$STEAM_HOME/steam-tokens.json` (0600) | same file                      |
//! | `env`        | `STEAM_USER` + `STEAM_REFRESH_TOKEN`   | read-only (rotation is reported) |
//! | `cloudflare` | Workers KV value             | Workers KV value                         |
//! | `github`     | `STEAM_REFRESH_TOKEN` (how Actions exposes the secret) | `gh secret set` via stdin |
//!
//! Cloudflare Secrets Store values cannot be read back through the API, so the readable and
//! writable Cloudflare backend is a Workers KV namespace. GitHub Actions secrets are write-only
//! by design, so the `github` backend reads what the workflow injected and writes rotations back.
//!
//! No backend logs or formats a token value. Errors name the store, never the secret.

use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;

use anyhow::{Context, Result, anyhow, bail};
use serde::{Deserialize, Serialize};

use crate::depot::auth::{TokenClaims, redact};
use crate::depot::token_store::{TokenStore, default_path};

/// Boxed future used by the dyn-compatible [`TokenBackend`].
pub type BoxFut<'a, T> = Pin<Box<dyn Future<Output = Result<T>> + Send + 'a>>;

/// One persisted login: account name, steamid and refresh token. Never the password.
#[derive(Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct StoredToken {
    pub account: String,
    #[serde(rename = "steamId", default, skip_serializing_if = "Option::is_none")]
    pub steam_id: Option<u64>,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
}

impl StoredToken {
    /// Builds a record, filling `steam_id` from the JWT `sub` claim when absent.
    pub fn new(
        account: impl Into<String>,
        refresh_token: impl Into<String>,
        steam_id: Option<u64>,
    ) -> Self {
        let refresh_token = refresh_token.into();
        let steam_id =
            steam_id.or_else(|| TokenClaims::parse(&refresh_token).and_then(|c| c.steam_id));
        Self {
            account: account.into(),
            steam_id,
            refresh_token,
        }
    }

    /// Decoded JWT claims of the refresh token.
    pub fn claims(&self) -> TokenClaims {
        TokenClaims::parse(&self.refresh_token).unwrap_or_default()
    }
}

impl std::fmt::Debug for StoredToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StoredToken")
            .field("account", &self.account)
            .field("steam_id", &self.steam_id)
            .field("refresh_token", &redact(&self.refresh_token))
            .finish()
    }
}

/// Store kinds accepted by `STEAM_TOKEN_STORE` and `auth export --to`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StoreKind {
    File,
    Env,
    Cloudflare,
    Github,
}

impl StoreKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::File => "file",
            Self::Env => "env",
            Self::Cloudflare => "cloudflare",
            Self::Github => "github",
        }
    }
}

impl std::str::FromStr for StoreKind {
    type Err = anyhow::Error;
    fn from_str(s: &str) -> Result<Self> {
        Ok(match s.trim().to_ascii_lowercase().as_str() {
            "" | "file" => Self::File,
            "env" => Self::Env,
            "cloudflare" | "cf" | "kv" => Self::Cloudflare,
            "github" | "gh" => Self::Github,
            other => bail!("STEAM_TOKEN_STORE inconnu : {other} (file|env|cloudflare|github)"),
        })
    }
}

/// A refresh-token store.
pub trait TokenBackend: Send + Sync {
    fn kind(&self) -> StoreKind;
    /// Loads the token of `account`, or the only stored account when `None`.
    fn load<'a>(&'a self, account: Option<&'a str>) -> BoxFut<'a, Option<StoredToken>>;
    /// Persists `token` (initial login or rotation).
    fn save<'a>(&'a self, token: &'a StoredToken) -> BoxFut<'a, ()>;
    /// Forgets the token of `account` after Steam revoked it. Read-only stores do nothing.
    fn forget<'a>(&'a self, account: &'a str) -> BoxFut<'a, ()>;
}

// ─── file ─────────────────────────────────────────────────────────────────────

/// JSON file store (0600 on Unix), shared format with the historical nie token cache.
pub struct FileBackend {
    store: TokenStore,
    path: PathBuf,
}

impl FileBackend {
    pub fn open(path: PathBuf) -> Self {
        Self {
            store: TokenStore::load(Some(&path)),
            path,
        }
    }
    pub fn path(&self) -> &std::path::Path {
        &self.path
    }
}

impl TokenBackend for FileBackend {
    fn kind(&self) -> StoreKind {
        StoreKind::File
    }
    fn load<'a>(&'a self, account: Option<&'a str>) -> BoxFut<'a, Option<StoredToken>> {
        Box::pin(async move {
            let account = match account {
                Some(a) => a.to_owned(),
                None => match self.store.accounts().as_slice() {
                    [only] => only.clone(),
                    [] => return Ok(None),
                    _ => bail!(
                        "plusieurs comptes dans {} : précisez STEAM_USER",
                        self.path.display()
                    ),
                },
            };
            let t = self.store.get(&account);
            Ok(t.refresh_token
                .filter(|r| !r.is_empty())
                .map(|r| StoredToken::new(account, r, t.steam_id)))
        })
    }
    fn save<'a>(&'a self, token: &'a StoredToken) -> BoxFut<'a, ()> {
        Box::pin(async move {
            self.store
                .set(&token.account, Some(&token.refresh_token), None);
            self.store.set_steam_id(&token.account, token.steam_id);
            Ok(())
        })
    }
    fn forget<'a>(&'a self, account: &'a str) -> BoxFut<'a, ()> {
        Box::pin(async move {
            self.store.set(account, Some(""), None);
            Ok(())
        })
    }
}

// ─── env ──────────────────────────────────────────────────────────────────────

/// Read-only store over `STEAM_USER` + `STEAM_REFRESH_TOKEN` (CI).
pub struct EnvBackend {
    account: Option<String>,
    token: Option<String>,
}

impl EnvBackend {
    pub fn from_env() -> Self {
        Self::new(non_empty("STEAM_USER"), non_empty("STEAM_REFRESH_TOKEN"))
    }
    pub fn new(account: Option<String>, token: Option<String>) -> Self {
        Self { account, token }
    }
}

impl TokenBackend for EnvBackend {
    fn kind(&self) -> StoreKind {
        StoreKind::Env
    }
    fn load<'a>(&'a self, account: Option<&'a str>) -> BoxFut<'a, Option<StoredToken>> {
        Box::pin(async move {
            let Some(token) = self.token.clone() else {
                return Ok(None);
            };
            let name = account
                .map(str::to_owned)
                .or_else(|| self.account.clone())
                .ok_or_else(|| anyhow!("STEAM_REFRESH_TOKEN défini sans STEAM_USER"))?;
            Ok(Some(StoredToken::new(name, token, None)))
        })
    }
    fn save<'a>(&'a self, _token: &'a StoredToken) -> BoxFut<'a, ()> {
        Box::pin(async { Err(anyhow!(ReadOnlyStore("env"))) })
    }
    fn forget<'a>(&'a self, _account: &'a str) -> BoxFut<'a, ()> {
        Box::pin(async { Ok(()) })
    }
}

/// Write attempted on a read-only store.
#[derive(Debug, thiserror::Error)]
#[error("le magasin de jetons `{0}` est en lecture seule")]
pub struct ReadOnlyStore(pub &'static str);

// ─── cloudflare (Workers KV) ──────────────────────────────────────────────────

/// Minimal HTTP surface used by [`CloudflareKvBackend`], mockable in tests.
pub trait KvHttp: Send + Sync {
    /// Returns `(status, body)`.
    fn get<'a>(&'a self, url: &'a str, bearer: &'a str) -> BoxFut<'a, (u16, Vec<u8>)>;
    fn put<'a>(&'a self, url: &'a str, bearer: &'a str, body: Vec<u8>) -> BoxFut<'a, u16>;
    fn delete<'a>(&'a self, url: &'a str, bearer: &'a str) -> BoxFut<'a, u16>;
}

/// `reqwest` implementation of [`KvHttp`].
pub struct ReqwestKv(reqwest::Client);

impl ReqwestKv {
    pub fn new() -> Self {
        Self(reqwest::Client::new())
    }
}

impl Default for ReqwestKv {
    fn default() -> Self {
        Self::new()
    }
}

impl KvHttp for ReqwestKv {
    fn get<'a>(&'a self, url: &'a str, bearer: &'a str) -> BoxFut<'a, (u16, Vec<u8>)> {
        Box::pin(async move {
            let r = self
                .0
                .get(url)
                .bearer_auth(bearer)
                .send()
                .await
                .context("cloudflare KV GET")?;
            let status = r.status().as_u16();
            Ok((status, r.bytes().await?.to_vec()))
        })
    }
    fn put<'a>(&'a self, url: &'a str, bearer: &'a str, body: Vec<u8>) -> BoxFut<'a, u16> {
        Box::pin(async move {
            let r = self
                .0
                .put(url)
                .bearer_auth(bearer)
                .body(body)
                .send()
                .await
                .context("cloudflare KV PUT")?;
            Ok(r.status().as_u16())
        })
    }
    fn delete<'a>(&'a self, url: &'a str, bearer: &'a str) -> BoxFut<'a, u16> {
        Box::pin(async move {
            let r = self
                .0
                .delete(url)
                .bearer_auth(bearer)
                .send()
                .await
                .context("cloudflare KV DELETE")?;
            Ok(r.status().as_u16())
        })
    }
}

/// Cloudflare Workers KV configuration.
#[derive(Clone, Debug)]
pub struct CloudflareKvConfig {
    pub api_base: String,
    pub account_id: String,
    pub namespace_id: String,
    pub key_prefix: String,
    pub api_token: String,
}

impl CloudflareKvConfig {
    pub fn from_env() -> Result<Self> {
        let need = |k: &str| {
            non_empty(k).ok_or_else(|| anyhow!("{k} requis pour STEAM_TOKEN_STORE=cloudflare"))
        };
        Ok(Self {
            api_base: non_empty("CLOUDFLARE_API_BASE")
                .unwrap_or_else(|| "https://api.cloudflare.com/client/v4".to_owned()),
            account_id: need("CLOUDFLARE_ACCOUNT_ID")?,
            namespace_id: need("STEAM_TOKEN_KV_NAMESPACE_ID")?,
            key_prefix: non_empty("STEAM_TOKEN_KV_PREFIX")
                .unwrap_or_else(|| "steam-refresh-token".to_owned()),
            api_token: need("CLOUDFLARE_API_TOKEN")?,
        })
    }

    fn url(&self, account: &str) -> String {
        format!(
            "{}/accounts/{}/storage/kv/namespaces/{}/values/{}%2F{}",
            self.api_base.trim_end_matches('/'),
            self.account_id,
            self.namespace_id,
            self.key_prefix,
            account.to_ascii_lowercase()
        )
    }
}

/// Workers KV store: one value per account, JSON [`StoredToken`].
pub struct CloudflareKvBackend {
    cfg: CloudflareKvConfig,
    http: Arc<dyn KvHttp>,
    default_account: Option<String>,
}

impl CloudflareKvBackend {
    pub fn new(
        cfg: CloudflareKvConfig,
        http: Arc<dyn KvHttp>,
        default_account: Option<String>,
    ) -> Self {
        Self {
            cfg,
            http,
            default_account,
        }
    }
}

impl TokenBackend for CloudflareKvBackend {
    fn kind(&self) -> StoreKind {
        StoreKind::Cloudflare
    }
    fn load<'a>(&'a self, account: Option<&'a str>) -> BoxFut<'a, Option<StoredToken>> {
        Box::pin(async move {
            let account = account
                .map(str::to_owned)
                .or_else(|| self.default_account.clone())
                .ok_or_else(|| anyhow!("STEAM_USER requis pour lire le KV Cloudflare"))?;
            let (status, body) = self
                .http
                .get(&self.cfg.url(&account), &self.cfg.api_token)
                .await?;
            match status {
                200 => Ok(Some(
                    serde_json::from_slice(&body).context("valeur KV Cloudflare illisible")?,
                )),
                404 => Ok(None),
                s => bail!("cloudflare KV GET : HTTP {s}"),
            }
        })
    }
    fn save<'a>(&'a self, token: &'a StoredToken) -> BoxFut<'a, ()> {
        Box::pin(async move {
            let body = serde_json::to_vec(token)?;
            match self
                .http
                .put(&self.cfg.url(&token.account), &self.cfg.api_token, body)
                .await?
            {
                200..=299 => Ok(()),
                s => bail!("cloudflare KV PUT : HTTP {s}"),
            }
        })
    }
    fn forget<'a>(&'a self, account: &'a str) -> BoxFut<'a, ()> {
        Box::pin(async move {
            match self
                .http
                .delete(&self.cfg.url(account), &self.cfg.api_token)
                .await?
            {
                200..=299 | 404 => Ok(()),
                s => bail!("cloudflare KV DELETE : HTTP {s}"),
            }
        })
    }
}

// ─── github (Actions secret) ──────────────────────────────────────────────────

/// Runs `gh secret set <name> [--repo R]` with the secret on stdin, mockable in tests.
pub trait SecretWriter: Send + Sync {
    fn set_secret(&self, name: &str, repo: Option<&str>, value: &str) -> Result<()>;
}

/// `gh` CLI implementation. The value goes through stdin, never argv (argv is world-readable).
pub struct GhCli {
    pub bin: String,
}

impl SecretWriter for GhCli {
    fn set_secret(&self, name: &str, repo: Option<&str>, value: &str) -> Result<()> {
        use std::io::Write;
        use std::process::{Command, Stdio};
        let mut cmd = Command::new(&self.bin);
        cmd.args(["secret", "set", name]);
        if let Some(r) = repo {
            cmd.args(["--repo", r]);
        }
        let mut child = cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::inherit())
            .spawn()
            .with_context(|| format!("lancement de `{} secret set`", self.bin))?;
        child
            .stdin
            .take()
            .context("stdin gh")?
            .write_all(value.as_bytes())?;
        let status = child.wait()?;
        if !status.success() {
            bail!("`gh secret set {name}` a échoué ({status})");
        }
        Ok(())
    }
}

/// GitHub Actions secret store: reads the injected env, writes rotations back with `gh`.
pub struct GithubBackend {
    env: EnvBackend,
    writer: Arc<dyn SecretWriter>,
    secret_name: String,
    user_secret_name: Option<String>,
    repo: Option<String>,
}

impl GithubBackend {
    pub fn new(
        env: EnvBackend,
        writer: Arc<dyn SecretWriter>,
        secret_name: String,
        repo: Option<String>,
    ) -> Self {
        Self {
            env,
            writer,
            secret_name,
            user_secret_name: Some("STEAM_USER".to_owned()),
            repo,
        }
    }
    pub fn from_env() -> Self {
        Self::new(
            EnvBackend::from_env(),
            Arc::new(GhCli {
                bin: non_empty("GH_BIN").unwrap_or_else(|| "gh".to_owned()),
            }),
            non_empty("STEAM_TOKEN_GH_SECRET").unwrap_or_else(|| "STEAM_REFRESH_TOKEN".to_owned()),
            non_empty("STEAM_TOKEN_GH_REPO").or_else(|| non_empty("GITHUB_REPOSITORY")),
        )
    }
}

impl TokenBackend for GithubBackend {
    fn kind(&self) -> StoreKind {
        StoreKind::Github
    }
    fn load<'a>(&'a self, account: Option<&'a str>) -> BoxFut<'a, Option<StoredToken>> {
        self.env.load(account)
    }
    fn save<'a>(&'a self, token: &'a StoredToken) -> BoxFut<'a, ()> {
        Box::pin(async move {
            self.writer.set_secret(
                &self.secret_name,
                self.repo.as_deref(),
                &token.refresh_token,
            )?;
            if let Some(user) = &self.user_secret_name {
                self.writer
                    .set_secret(user, self.repo.as_deref(), &token.account)?;
            }
            Ok(())
        })
    }
    fn forget<'a>(&'a self, _account: &'a str) -> BoxFut<'a, ()> {
        Box::pin(async { Ok(()) })
    }
}

// ─── selection ────────────────────────────────────────────────────────────────

/// Opens the store of `kind` from the environment. `file_path` overrides the file location.
pub fn open(kind: StoreKind, file_path: Option<PathBuf>) -> Result<Arc<dyn TokenBackend>> {
    Ok(match kind {
        StoreKind::File => Arc::new(FileBackend::open(file_path.unwrap_or_else(default_path))),
        StoreKind::Env => Arc::new(EnvBackend::from_env()),
        StoreKind::Cloudflare => Arc::new(CloudflareKvBackend::new(
            CloudflareKvConfig::from_env()?,
            Arc::new(ReqwestKv::new()),
            non_empty("STEAM_USER"),
        )),
        StoreKind::Github => Arc::new(GithubBackend::from_env()),
    })
}

/// Opens the canonical store named by `STEAM_TOKEN_STORE` (default `file`).
pub fn from_env(file_path: Option<PathBuf>) -> Result<Arc<dyn TokenBackend>> {
    let kind: StoreKind = std::env::var("STEAM_TOKEN_STORE")
        .unwrap_or_default()
        .parse()?;
    open(kind, file_path)
}

fn non_empty(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|v| !v.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    fn rt() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
    }

    #[test]
    fn file_round_trip_and_perms() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("steam-tokens.json");
        rt().block_on(async {
            let b = FileBackend::open(path.clone());
            assert!(b.load(None).await.unwrap().is_none());
            b.save(&StoredToken::new("Alice", "rt-1", Some(42)))
                .await
                .unwrap();
            let reopened = FileBackend::open(path.clone());
            let t = reopened.load(None).await.unwrap().unwrap();
            assert_eq!(
                (t.account.as_str(), t.steam_id, t.refresh_token.as_str()),
                ("alice", Some(42), "rt-1")
            );
            reopened.forget("alice").await.unwrap();
            assert!(
                FileBackend::open(path.clone())
                    .load(Some("alice"))
                    .await
                    .unwrap()
                    .is_none()
            );
        });
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
    }

    #[test]
    fn env_is_read_only() {
        rt().block_on(async {
            let b = EnvBackend::new(Some("bob".into()), Some("rt".into()));
            let t = b.load(None).await.unwrap().unwrap();
            assert_eq!(t.account, "bob");
            let err = b.save(&t).await.unwrap_err();
            assert!(err.downcast_ref::<ReadOnlyStore>().is_some());
            assert!(
                EnvBackend::new(None, None)
                    .load(None)
                    .await
                    .unwrap()
                    .is_none()
            );
        });
    }

    #[derive(Default)]
    struct MockKv {
        data: Mutex<HashMap<String, Vec<u8>>>,
        auth: Mutex<Vec<String>>,
    }

    impl KvHttp for MockKv {
        fn get<'a>(&'a self, url: &'a str, bearer: &'a str) -> BoxFut<'a, (u16, Vec<u8>)> {
            self.auth.lock().unwrap().push(bearer.to_owned());
            let v = self.data.lock().unwrap().get(url).cloned();
            Box::pin(async move { Ok(v.map_or((404, vec![]), |b| (200, b))) })
        }
        fn put<'a>(&'a self, url: &'a str, bearer: &'a str, body: Vec<u8>) -> BoxFut<'a, u16> {
            self.auth.lock().unwrap().push(bearer.to_owned());
            self.data.lock().unwrap().insert(url.to_owned(), body);
            Box::pin(async { Ok(200) })
        }
        fn delete<'a>(&'a self, url: &'a str, _bearer: &'a str) -> BoxFut<'a, u16> {
            self.data.lock().unwrap().remove(url);
            Box::pin(async { Ok(200) })
        }
    }

    #[test]
    fn cloudflare_kv_mocked_http() {
        let http = Arc::new(MockKv::default());
        let cfg = CloudflareKvConfig {
            api_base: "https://cf.test/client/v4/".into(),
            account_id: "acc".into(),
            namespace_id: "ns".into(),
            key_prefix: "steam-refresh-token".into(),
            api_token: "cf-token".into(),
        };
        let b = CloudflareKvBackend::new(cfg, http.clone(), Some("Carol".into()));
        rt().block_on(async {
            assert!(b.load(None).await.unwrap().is_none());
            b.save(&StoredToken::new("carol", "rt-2", Some(7)))
                .await
                .unwrap();
            let t = b.load(None).await.unwrap().unwrap();
            assert_eq!(t.refresh_token, "rt-2");
            b.forget("carol").await.unwrap();
            assert!(b.load(None).await.unwrap().is_none());
        });
        let keys: Vec<String> = http.data.lock().unwrap().keys().cloned().collect();
        assert!(keys.is_empty());
        assert!(http.auth.lock().unwrap().iter().all(|a| a == "cf-token"));
        assert_eq!(
            CloudflareKvConfig {
                api_base: "https://cf.test/client/v4/".into(),
                account_id: "acc".into(),
                namespace_id: "ns".into(),
                key_prefix: "p".into(),
                api_token: String::new(),
            }
            .url("Carol"),
            "https://cf.test/client/v4/accounts/acc/storage/kv/namespaces/ns/values/p%2Fcarol"
        );
    }

    #[derive(Default)]
    struct MockGh(Mutex<Vec<(String, Option<String>, String)>>);

    impl SecretWriter for MockGh {
        fn set_secret(&self, name: &str, repo: Option<&str>, value: &str) -> Result<()> {
            self.0
                .lock()
                .unwrap()
                .push((name.into(), repo.map(Into::into), value.into()));
            Ok(())
        }
    }

    #[test]
    fn github_writes_back_rotation() {
        let gh = Arc::new(MockGh::default());
        let b = GithubBackend::new(
            EnvBackend::new(Some("dave".into()), Some("old".into())),
            gh.clone(),
            "STEAM_REFRESH_TOKEN".into(),
            Some("aphrody-dev/rosegriffon".into()),
        );
        rt().block_on(async {
            assert_eq!(b.load(None).await.unwrap().unwrap().refresh_token, "old");
            b.save(&StoredToken::new("dave", "new", None))
                .await
                .unwrap();
        });
        let calls = gh.0.lock().unwrap();
        assert_eq!(
            calls[0],
            (
                "STEAM_REFRESH_TOKEN".into(),
                Some("aphrody-dev/rosegriffon".into()),
                "new".into()
            )
        );
        assert_eq!(calls[1].0, "STEAM_USER");
    }

    #[test]
    fn debug_never_prints_token() {
        let t = StoredToken::new("eve", "super-secret-value", None);
        assert!(!format!("{t:?}").contains("super-secret"));
        assert_eq!("gh".parse::<StoreKind>().unwrap(), StoreKind::Github);
        assert!("vault".parse::<StoreKind>().is_err());
    }
}
