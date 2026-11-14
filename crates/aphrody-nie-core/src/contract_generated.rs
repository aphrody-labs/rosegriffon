// Auto-generated from contract/stack.yml — DO NOT EDIT.
// Regenerate via: just contract

//! Polyglot Rose Griffon stack contract constants compiled from `contract/stack.yml`.

#![allow(missing_docs)]

pub const CONTRACT_SCHEMA_VERSION: u32 = 1;
pub const PROJECT_NAME: &str = "rosegriffon";
pub const CONTRACT_VERSION: &str = "1.4.4";
pub const DEFAULT_DOMAIN: &str = "rosegriffon.fr";
pub const COOKIE_DOMAIN: &str = ".rosegriffon.fr";

pub const ACHILLEA_SCHEMA: &str = "achillea";
pub const ACHILLEA_ISSUER: &str = "achillea";
pub const ACHILLEA_SESSION_AUDIENCE: &str = "achillea-web";
pub const ACHILLEA_REALTIME_AUDIENCE: &str = "achillea-realtime";
pub const ACHILLEA_COOKIE_NAME: &str = "token";
pub const ACHILLEA_SESSION_TTL_SECONDS: u64 = 2592000;
pub const ACHILLEA_REALTIME_TTL_SECONDS: u64 = 300;

pub const DB_POOL_DEFAULT_MAX: i32 = 4;
pub const DB_POOL_CEILING: i32 = 4;
pub const DB_IDLE_TIMEOUT_SEC: u64 = 30;
pub const DB_MAX_LIFETIME_SEC: u64 = 1800;
pub const DB_CONNECT_TIMEOUT_SEC: u64 = 10;
pub const REDIS_DEFAULT_URL: &str = "redis://127.0.0.1:6379";

pub const VERCEL_MAX_BUILDS_PER_WEEK: u32 = 1;
pub const CLOUDFLARE_CPU_MS: i32 = 10;

pub const TRUSTED_ORIGINS_PROD: &[&str] = &[
    "https://rg.aphrody.com",
    "https://rosegriffon.fr",
    "https://www.rosegriffon.fr",
    "https://api.rosegriffon.fr",
    "https://achillea.rosegriffon.fr",
    "https://ranked.rosegriffon.fr",
    "https://azalee.rosegriffon.fr",
    "https://cdn.rosegriffon.fr",
    "https://bot.rosegriffon.fr",
];

pub const ADMIN_ROLES: &[&str] = &[
    "admin",
    "superadmin",
    "editor",
    "moderator",
];

pub const STAFF_ROLES: &[&str] = &[
    "admin",
    "staff",
];
