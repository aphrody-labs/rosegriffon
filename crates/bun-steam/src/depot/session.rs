//! Session Steam authentifiée (login CM + PICS + clés depots).
//!
//! Port de `IECODE.Core/Steam/Content/Steam3Session.cs` (C#, SteamKit2)
//! réécrit sur la fondation `steamroom` / `steamroom-client`.
//!
//! `Steam3Session` côté C# combinait :
//! 1. La connexion CM (SteamClient SteamKit2) — **géré par steamroom**
//! 2. L'auth login/refresh-token/2FA — **géré par steamroom-client::login**
//! 3. Les requêtes PICS (app info, package info, depot keys) — **SteamClient<LoggedIn>**
//!
//! Ce module expose [`SteamSession`] qui encapsule un `SteamClient<LoggedIn>` steamroom
//! et son cache de jetons (`TokenStore`). Il gère :
//! - Le login avec refresh-token caché (non-interactif) ou credentials + 2FA
//! - Les requêtes PICS (app info par KV, package info, clé de depot)
//! - Le code de requête manifest et le jeton CDN
//!
//! # Compile sans creds Steam
//! Toutes les méthodes async font de vrais appels steamroom ; elles compilent et
//! sont correctement structurées. Un test E2E complet nécessite des creds Steam.

use std::collections::HashMap;
use std::sync::Arc;

use anyhow::{Context, Result};
use steamroom::client::LoggedIn;
use steamroom::client::SteamClient;
use steamroom::depot::{AppId, CellId, DepotId, DepotKey, ManifestId};
use steamroom::types::key_value::KeyValue;
use steamroom_client::login::{CredentialsLoginFlow, GuardType, LoginBuilder};
use tracing::{info, warn};

use crate::depot::auth::{self, GENERATE_FOR_APP_METHOD, RENEWAL_ALLOW};
use crate::depot::options::{SteamDownloadOptions, SteamGuardKind, SteamGuardProvider};
use crate::depot::token_backend::{self, ReadOnlyStore, StoredToken, TokenBackend};

// ─── Cache d'app info parsé ───────────────────────────────────────────────────

/// Résultat de la requête PICS pour une app : KV parsé + change_number.
#[derive(Clone, Debug)]
pub struct AppData {
    pub kv: KeyValue,
    pub change_number: Option<u32>,
}

// ─── SteamSession ─────────────────────────────────────────────────────────────

/// Session Steam authentifiée avec cache PICS et clés depots.
///
/// Construite via [`SteamSession::connect`]. Après construction, l'utilisateur
/// est connecté au CM Steam et peut appeler les méthodes PICS.
///
/// # Note live-Steam
/// Les méthodes async effectuent de vrais appels réseau vers l'infrastructure Steam.
/// Elles compilent et sont correctement structurées ; un E2E complet nécessite des
/// creds valides et une connexion réseau.
pub struct SteamSession {
    client: SteamClient<LoggedIn>,
    token_store: Arc<dyn TokenBackend>,
    app_cache: HashMap<u32, AppData>,
    depot_keys: HashMap<u32, DepotKey>,
}

impl SteamSession {
    /// Établit la connexion et l'authentification Steam.
    ///
    /// Stratégie (identique au C# `Steam3Session`) :
    /// 1. Si un refresh token est en cache pour le compte → `TokenLogin` (non-interactif)
    /// 2. Sinon si `username` + `password` fournis → `CredentialsLogin` + 2FA via `guard_provider`
    /// 3. Si `username` est `None` → login anonyme (jeux gratuits seulement)
    pub async fn connect(opts: &SteamDownloadOptions) -> Result<Self> {
        let token_store: Arc<dyn TokenBackend> = match &opts.token_backend {
            Some(b) => b.clone(),
            None => Arc::new(token_backend::FileBackend::open(
                opts.token_store_path
                    .clone()
                    .unwrap_or_else(crate::depot::token_store::default_path),
            )),
        };

        let client = login_with_opts(opts, &token_store).await?;

        Ok(Self {
            client,
            token_store,
            app_cache: HashMap::new(),
            depot_keys: HashMap::new(),
        })
    }

    /// Retourne une référence au token store (pour persister de nouveaux tokens).
    pub fn token_store(&self) -> &Arc<dyn TokenBackend> {
        &self.token_store
    }

    // ── PICS app info ─────────────────────────────────────────────────────────

    /// Récupère et cache les informations d'une app via PICS.
    ///
    /// Si l'app est déjà en cache et `force` est `false`, retourne le cache.
    /// Sinon effectue une requête PICS complète (access token + product info).
    pub async fn request_app_info(&mut self, app_id: u32, force: bool) -> Result<()> {
        if self.app_cache.contains_key(&app_id) && !force {
            return Ok(());
        }

        let steam_app_id = AppId(app_id);
        let tokens = self
            .client
            .pics_get_access_tokens(&[steam_app_id])
            .await
            .context("PICS access tokens")?;

        let token = tokens
            .into_iter()
            .next()
            .unwrap_or(steamroom::apps::AccessToken {
                app_id: steam_app_id,
                token: 0,
            });

        let infos = self
            .client
            .pics_get_product_info(&[token])
            .await
            .context("PICS product info")?;

        for info in infos {
            let id = info.app_id.map(|a| a.0).unwrap_or(app_id);
            if let Some(kv_data) = info.kv_data {
                let kv = parse_app_kv(&kv_data).with_context(|| format!("parse KV app {id}"))?;
                self.app_cache.insert(
                    id,
                    AppData {
                        kv,
                        change_number: info.change_number,
                    },
                );
            }
        }

        Ok(())
    }

    /// Retourne le KV parsé d'une app si elle est en cache.
    pub fn app_kv(&self, app_id: u32) -> Option<&KeyValue> {
        self.app_cache.get(&app_id).map(|d| &d.kv)
    }

    // ── Depot key ────────────────────────────────────────────────────────────

    /// Récupère et cache la clé de déchiffrement d'un depot.
    ///
    /// Renvoie `None` si le compte n'a pas accès au depot (résultat non-OK).
    pub async fn request_depot_key(
        &mut self,
        depot_id: u32,
        app_id: u32,
    ) -> Result<Option<DepotKey>> {
        if let Some(key) = self.depot_keys.get(&depot_id) {
            return Ok(Some(key.clone()));
        }

        match self
            .client
            .get_depot_decryption_key(DepotId(depot_id), AppId(app_id))
            .await
        {
            Ok(key) => {
                self.depot_keys.insert(depot_id, key.clone());
                Ok(Some(key))
            }
            Err(e) => {
                warn!("depot {depot_id} : clé indisponible ({e})");
                Ok(None)
            }
        }
    }

    // ── Manifest request code ────────────────────────────────────────────────

    /// Retourne le code de requête manifest (requis par certains manifests récents).
    ///
    /// Renvoie `0` si le code est absent ou que la requête échoue (comportement
    /// identique au downloader steamroom-cli qui tolère l'absence).
    pub async fn manifest_request_code(
        &self,
        app_id: u32,
        depot_id: u32,
        manifest_id: u64,
        branch: &str,
    ) -> u64 {
        match self
            .client
            .get_manifest_request_code(
                AppId(app_id),
                DepotId(depot_id),
                ManifestId(manifest_id),
                Some(branch),
                None,
            )
            .await
        {
            Ok(Some(code)) => code,
            Ok(None) => 0,
            Err(e) => {
                warn!("manifest request code pour depot {depot_id} : {e} — continuera sans code");
                0
            }
        }
    }

    // ── CDN servers + CDN auth token ─────────────────────────────────────────

    /// Retourne la liste des serveurs CDN SteamPipe pour `cell_id`.
    pub async fn cdn_servers(
        &self,
        cell_id: u32,
        max: Option<u32>,
    ) -> Result<Vec<steamroom::cdn::CdnServer>> {
        self.client
            .get_cdn_servers(CellId(cell_id), max)
            .await
            .context("CDN servers")
    }

    /// Retourne un jeton CDN auth pour un depot/host donné (optionnel).
    ///
    /// Renvoie `None` si la requête échoue ; la plupart des CDN SteamPipe n'en
    /// requièrent pas et fonctionnent sans.
    pub async fn cdn_auth_token(&self, app_id: u32, depot_id: u32, host: &str) -> Option<String> {
        match self
            .client
            .get_cdn_auth_token(AppId(app_id), DepotId(depot_id), host)
            .await
        {
            Ok(t) => t.token,
            Err(e) => {
                warn!("CDN auth token pour {host} : {e} — continuera sans");
                None
            }
        }
    }
}

// ─── Logique de login ─────────────────────────────────────────────────────────

/// Steam rejected the stored refresh token (revoked or expired), or none is stored: an
/// interactive `bun-steam-depot login <user>` is required. Mapped to exit code 2 by the binary.
#[derive(Debug, thiserror::Error)]
#[error(
    "connexion Steam requise pour {account} : {reason}. Lancez `bun-steam-depot login {account}`"
)]
pub struct NeedsLogin {
    pub account: String,
    pub reason: &'static str,
}

async fn login_with_opts(
    opts: &SteamDownloadOptions,
    token_store: &Arc<dyn TokenBackend>,
) -> Result<SteamClient<LoggedIn>> {
    // Interactive login: credentials are only used when explicitly given (`login`).
    if let (Some(username), Some(password)) = (&opts.username, &opts.password) {
        return credentials_login(opts, token_store, username, password).await;
    }

    let stored = token_store.load(opts.username.as_deref()).await?;
    let Some(stored) = stored else {
        if let Some(username) = &opts.username {
            return Err(NeedsLogin {
                account: username.clone(),
                reason: "aucun refresh token",
            }
            .into());
        }
        info!("login anonyme Steam…");
        return LoginBuilder::new()
            .device_name("bunre-steam")
            .anonymous()
            .login()
            .await
            .map_err(|e| anyhow::anyhow!("login anonyme échoué : {e}"));
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    if stored.claims().is_expired(now) {
        let _ = token_store.forget(&stored.account).await;
        return Err(NeedsLogin {
            account: stored.account,
            reason: "refresh token expiré",
        }
        .into());
    }

    info!(account = %stored.account, store = token_store.kind().as_str(), "login avec refresh token");
    let result = LoginBuilder::new()
        .device_name("bunre-steam")
        .with_refresh_token(&stored.account, &stored.refresh_token)
        .login()
        .await;

    let client = match result {
        Ok(client) => client,
        Err(steamroom_client::login::LoginError::LogonFailed(
            steamroom::enums::EResultError::InvalidPassword
            | steamroom::enums::EResultError::AccessDenied
            | steamroom::enums::EResultError::Expired,
        ))
        | Err(steamroom_client::login::LoginError::InvalidPassword) => {
            let _ = token_store.forget(&stored.account).await;
            return Err(NeedsLogin {
                account: stored.account,
                reason: "refresh token révoqué",
            }
            .into());
        }
        Err(e) => return Err(anyhow::anyhow!("login token échoué : {e}")),
    };

    renew_and_rotate(&client, token_store, &stored).await;
    Ok(client)
}

/// Asks Steam for a fresh access token with renewal allowed and writes a rotated refresh token
/// back to the canonical store. Best-effort: a failed renewal never fails the run, since the
/// current refresh token just logged in successfully.
async fn renew_and_rotate(
    client: &SteamClient<LoggedIn>,
    token_store: &Arc<dyn TokenBackend>,
    stored: &StoredToken,
) {
    let Some(steam_id) = stored.steam_id.or(stored.claims().steam_id) else {
        warn!("steamid inconnu, renouvellement du refresh token ignoré");
        return;
    };
    let body = auth::encode_generate_for_app(&stored.refresh_token, steam_id, RENEWAL_ALLOW);
    let response = match client
        .call_service_method(GENERATE_FOR_APP_METHOD, &body)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            warn!("GenerateAccessTokenForApp : {e}");
            return;
        }
    };
    let Some(decoded) = auth::decode_generate_for_app(&response.body) else {
        warn!("réponse GenerateAccessTokenForApp illisible");
        return;
    };
    let Some(rotated) = auth::rotation(&stored.refresh_token, &decoded) else {
        return;
    };
    let next = StoredToken::new(stored.account.clone(), rotated, Some(steam_id));
    match token_store.save(&next).await {
        Ok(()) => info!(
            store = token_store.kind().as_str(),
            "refresh token renouvelé"
        ),
        Err(e) if e.downcast_ref::<ReadOnlyStore>().is_some() => warn!(
            store = token_store.kind().as_str(),
            "Steam a renouvelé le refresh token mais le magasin est en lecture seule"
        ),
        Err(e) => warn!("persistance du refresh token renouvelé : {e}"),
    }
}

async fn credentials_login(
    opts: &SteamDownloadOptions,
    token_store: &Arc<dyn TokenBackend>,
    username: &str,
    password: &str,
) -> Result<SteamClient<LoggedIn>> {
    info!("login par credentials pour {username}…");
    let flow = LoginBuilder::new()
        .device_name("bunre-steam")
        .with_credentials(username, password)
        .begin()
        .await
        .map_err(|e| anyhow::anyhow!("begin credentials auth : {e}"))?;

    let approved = match flow {
        CredentialsLoginFlow::Approved(a) => a,
        CredentialsLoginFlow::NeedsGuardCode(challenge) => {
            let kind = guard_kind_from_steamroom(challenge.allowed_kinds());
            let guard_code = get_guard_code(opts, kind).await?;
            let steamroom_kind = guard_kind_to_steamroom(kind);
            match challenge.submit_code(&guard_code, steamroom_kind).await {
                Ok(a) => a,
                Err((_, e)) => {
                    return Err(anyhow::anyhow!("code Steam Guard rejeté : {e}"));
                }
            }
        }
        CredentialsLoginFlow::NeedsMobileConfirm(mobile) => {
            info!("confirmez la connexion sur votre application Steam mobile…");
            mobile
                .wait_for_confirmation()
                .await
                .map_err(|e| anyhow::anyhow!("confirmation mobile : {e}"))?
        }
        _ => anyhow::bail!("flux d'authentification inattendu"),
    };

    // Only the refresh token, account name and steamid are persisted; never the password.
    let tokens = approved.tokens();
    let account = tokens.account_name.as_deref().unwrap_or(username);
    let record = StoredToken::new(
        account.to_ascii_lowercase(),
        tokens.refresh_token.clone(),
        None,
    );
    token_store.save(&record).await.map_err(|e| {
        anyhow::anyhow!(
            "persistance du refresh token ({}) : {e}",
            token_store.kind().as_str()
        )
    })?;

    approved
        .finish()
        .await
        .map_err(|e| anyhow::anyhow!("finalisation login : {e}"))
}

/// Convertit le premier `GuardType` steamroom disponible en `SteamGuardKind` iecode.
fn guard_kind_from_steamroom(kinds: &[GuardType]) -> SteamGuardKind {
    if kinds.iter().any(|k| matches!(k, GuardType::DeviceCode)) {
        SteamGuardKind::Device
    } else {
        SteamGuardKind::Email
    }
}

/// Convertit `SteamGuardKind` iecode en `GuardType` steamroom.
fn guard_kind_to_steamroom(kind: SteamGuardKind) -> GuardType {
    match kind {
        SteamGuardKind::Device => GuardType::DeviceCode,
        SteamGuardKind::Email => GuardType::EmailCode,
    }
}

/// Obtient le code 2FA depuis le `guard_provider` de l'option ou depuis `EnvGuardProvider`.
async fn get_guard_code(opts: &SteamDownloadOptions, kind: SteamGuardKind) -> Result<String> {
    if let Some(ref provider) = opts.guard_provider {
        provider.get_code(kind, None, false).await
    } else {
        crate::depot::options::EnvGuardProvider
            .get_code(kind, None, false)
            .await
    }
}

// ─── Parsing KV ───────────────────────────────────────────────────────────────

/// Parse les données KV brutes d'une app info PICS.
///
/// Les données PICS peuvent être en KV binaire (commence par `0x00`) ou KV texte.
fn parse_app_kv(data: &[u8]) -> Result<KeyValue> {
    if data.first() == Some(&0x00) {
        steamroom::types::key_value::parse_binary_kv(data)
            .map_err(|e| anyhow::anyhow!("parse binary KV : {e}"))
    } else {
        let text = String::from_utf8_lossy(data);
        steamroom::types::key_value::parse_text_kv(&text)
            .map_err(|e| anyhow::anyhow!("parse text KV : {e}"))
    }
}
