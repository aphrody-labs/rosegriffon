#!/usr/bin/env bun
/**
 * Sync the language-independent Rose Griffon stack contract (`contract/stack.yml`)
 * to canonical JSON, Modern C23 LLVM headers, TypeScript constants, and Rust constants.
 *
 *   bun packages/rg-config/scripts/sync-contract.ts           write targets
 *   bun packages/rg-config/scripts/sync-contract.ts --check   fail on drift
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

interface OriginSpec {
  label: string;
  path: string;
}

interface StackContract {
  schemaVersion: number;
  project: {
    name: string;
    version: string;
    license: string;
    domain: string;
    cookieDomain: string;
    repoUrl: string;
  };
  http: {
    healthPath: string;
    docsPath: string;
    openapiPath: string;
    apiPrefix: string;
    legacyApiPrefix: string;
    defaultPorts: Record<string, number>;
    origins: Record<string, OriginSpec>;
    cors: {
      methods: string[];
      allowedHeaders: string[];
      credentials: boolean;
    };
    trustedOrigins: {
      prod: string[];
      native: string[];
      dev: string[];
    };
    routes: Record<string, string>;
  };
  auth: {
    provider: string;
    issuer: string;
    audiences: {
      session: string;
      realtime: string;
    };
    cookieName: string;
    ttlSeconds: {
      session: number;
      realtime: number;
    };
    passwordMinLength: number;
    requireEmailVerification: boolean;
    apiKeyPrefix: string;
    secretMinLength: number;
    defaultRole: string;
    roles: {
      all: string[];
      admin: string[];
      userManagement: string[];
      botAdmin: string[];
      moderator: string[];
      staff: string[];
    };
  };
  database: {
    primary: {
      engine: string;
      schema: string;
      achilleaSchema: string;
      orm: string;
      pgSchemes: string[];
      drivers: string[];
      envVars: string[];
      pool: {
        defaultMax: number;
        ceiling: number;
        idleTimeoutSec: number;
        maxLifetimeSec: number;
        connectTimeoutSec: number;
        pgConnectTimeoutMs: number;
      };
    };
    gameplay: {
      engine: string;
      schema: string;
      orm: string;
      drivers: string[];
      envVars: string[];
    };
    mirror: {
      engine: string;
      orm: string;
      drivers: string[];
      defaultRelPath: string;
      envVars: string[];
      snapshotDirs: string[];
    };
    cache: {
      engine: string;
      defaultUrl: string;
      connectTimeoutMs: number;
      idleTimeoutMs: number;
      maxRetries: number;
    };
  };
  openapi: {
    version: string;
    dialect: string;
    yamlRelPath: string;
    jsonRelPath: string;
  };
  ui: {
    framework: string;
    primitives: string;
    tokensManifest: string;
    defaultTheme: string;
    themes: Array<{ id: string; seed: string; dark: boolean }>;
  };
  platforms: Record<
    string,
    {
      kind: string;
      freeRequestsPerDay: number;
      freeBandwidthGb: number;
      cpuMs: number;
      maxBuildsPerWeek?: number;
      commercial: boolean;
      stateful: boolean;
    }
  >;
}

function repoRoot(): string {
  const candidates = [
    resolve(import.meta.dir, "../../.."),
    process.cwd(),
  ];
  const found = candidates.find((c) => existsSync(join(c, "contract/stack.yml")));
  if (!found) {
    throw new Error("contract/stack.yml not found from package or workspace root");
  }
  return found;
}

function validateContract(data: unknown): asserts data is StackContract {
  if (!data || typeof data !== "object") {
    throw new Error("contract/stack.yml must parse to an object");
  }
  const c = data as Partial<StackContract>;
  if (c.schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion: ${String(c.schemaVersion)}`);
  }
  if (!c.project?.domain || !c.project.cookieDomain) {
    throw new Error("project.domain and project.cookieDomain are required");
  }
  if (!c.http?.origins?.site || !c.http.trustedOrigins?.prod?.length) {
    throw new Error("http.origins.site and http.trustedOrigins.prod are required");
  }
  if (!c.auth?.issuer || !c.auth.roles?.admin?.length) {
    throw new Error("auth.issuer and auth.roles.admin are required");
  }
  if (!c.database?.primary?.pool?.ceiling || !c.database.cache?.defaultUrl) {
    throw new Error("database.primary.pool.ceiling and database.cache.defaultUrl are required");
  }
  if (!c.database.mirror?.envVars?.length || !c.database.mirror.snapshotDirs?.length) {
    throw new Error("database.mirror.envVars and database.mirror.snapshotDirs are required");
  }
  if (!c.openapi?.version || !c.openapi.dialect) {
    throw new Error("openapi.version and openapi.dialect are required");
  }
  if (!c.platforms?.vps || !c.platforms.cloudflare || !c.platforms.vercel) {
    throw new Error("platforms.{vps,cloudflare,vercel} are required");
  }
}

const cEscape = (value: string): string =>
  JSON.stringify(value);

function cByteArrayLiteral(text: string): string {
  const bytes = [...new TextEncoder().encode(text), 0];
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    rows.push(
      `  ${bytes
        .slice(i, i + 16)
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(", ")},`,
    );
  }
  return `{\n${rows.join("\n")}\n}`;
}

function renderC23Header(contract: StackContract, compactJson: string): string {
  const originRows = Object.entries(contract.http.origins)
    .map(
      ([key, spec]) =>
        `  { ${cEscape(key)}, ${cEscape(spec.label)}, ${cEscape(spec.path)} },`,
    )
    .join("\n");

  const prodOrigins = contract.http.trustedOrigins.prod
    .map((u) => `  ${cEscape(u)},`)
    .join("\n");
  const nativeOrigins = contract.http.trustedOrigins.native
    .map((u) => `  ${cEscape(u)},`)
    .join("\n");
  const devOrigins = contract.http.trustedOrigins.dev
    .map((u) => `  ${cEscape(u)},`)
    .join("\n");

  const adminRoles = contract.auth.roles.admin
    .map((r) => `  ${cEscape(r)},`)
    .join("\n");
  const staffRoles = contract.auth.roles.staff
    .map((r) => `  ${cEscape(r)},`)
    .join("\n");
  const mirrorEnvVars = contract.database.mirror.envVars
    .map((v) => `  ${cEscape(v)},`)
    .join("\n");
  const portRows = Object.entries(contract.http.defaultPorts)
    .map(([key, port]) => `  { ${cEscape(key)}, ${port} },`)
    .join("\n");

  return `/* Auto-generated from contract/stack.yml — DO NOT EDIT.
 * Regenerate via: bun packages/rg-config/scripts/sync-contract.ts
 */
#pragma once

#include <stddef.h>
#include <stdint.h>

#define RG_CONTRACT_SCHEMA_VERSION ${contract.schemaVersion}u
#define RG_CONTRACT_PROJECT_NAME ${cEscape(contract.project.name)}
#define RG_CONTRACT_VERSION ${cEscape(contract.project.version)}
#define RG_DEFAULT_DOMAIN ${cEscape(contract.project.domain)}
#define RG_COOKIE_DOMAIN ${cEscape(contract.project.cookieDomain)}
#define RG_OPENAPI_VERSION ${cEscape(contract.openapi.version)}
#define RG_OPENAPI_DIALECT ${cEscape(contract.openapi.dialect)}
#define RG_OPENAPI_PATH ${cEscape(contract.http.openapiPath)}
#define RG_MIRROR_DEFAULT_REL_PATH ${cEscape(contract.database.mirror.defaultRelPath)}

#define RG_ACHILLEA_SCHEMA ${cEscape(contract.database.primary.achilleaSchema)}
#define RG_ACHILLEA_ISSUER ${cEscape(contract.auth.issuer)}
#define RG_ACHILLEA_SESSION_AUDIENCE ${cEscape(contract.auth.audiences.session)}
#define RG_ACHILLEA_REALTIME_AUDIENCE ${cEscape(contract.auth.audiences.realtime)}
#define RG_ACHILLEA_COOKIE_NAME ${cEscape(contract.auth.cookieName)}
#define RG_ACHILLEA_SESSION_TTL_S ${contract.auth.ttlSeconds.session}u
#define RG_ACHILLEA_REALTIME_TTL_S ${contract.auth.ttlSeconds.realtime}u
#define RG_AUTH_SECRET_MIN_LEN ${contract.auth.secretMinLength}u

#define RG_DB_POOL_DEFAULT_MAX ${contract.database.primary.pool.defaultMax}
#define RG_DB_POOL_CEILING ${contract.database.primary.pool.ceiling}
#define RG_DB_IDLE_TIMEOUT_S ${contract.database.primary.pool.idleTimeoutSec}
#define RG_DB_MAX_LIFETIME_S ${contract.database.primary.pool.maxLifetimeSec}
#define RG_DB_CONNECT_TIMEOUT_S ${contract.database.primary.pool.connectTimeoutSec}
#define RG_REDIS_DEFAULT_URL ${cEscape(contract.database.cache.defaultUrl)}

#define RG_CLOUDFLARE_CPU_MS ${contract.platforms.cloudflare.cpuMs}
#define RG_VERCEL_MAX_BUILDS_PER_WEEK ${contract.platforms.vercel.maxBuildsPerWeek ?? 1}

typedef struct {
  const char *key;
  const char *label;
  const char *path;
} rg_origin_spec_t;

typedef struct {
  const char *key;
  int32_t port;
} rg_port_spec_t;

static const rg_origin_spec_t RG_ORIGIN_SPECS[] = {
${originRows}
};
static const size_t RG_ORIGIN_SPECS_COUNT = sizeof(RG_ORIGIN_SPECS) / sizeof(RG_ORIGIN_SPECS[0]);

static const rg_port_spec_t RG_DEFAULT_PORTS[] = {
${portRows}
};
static const size_t RG_DEFAULT_PORTS_COUNT = sizeof(RG_DEFAULT_PORTS) / sizeof(RG_DEFAULT_PORTS[0]);

static const char *const RG_MIRROR_ENV_VARS[] = {
${mirrorEnvVars}
};
static const size_t RG_MIRROR_ENV_VARS_COUNT = sizeof(RG_MIRROR_ENV_VARS) / sizeof(RG_MIRROR_ENV_VARS[0]);

static const char *const RG_TRUSTED_ORIGINS_PROD[] = {
${prodOrigins}
};
static const size_t RG_TRUSTED_ORIGINS_PROD_COUNT = sizeof(RG_TRUSTED_ORIGINS_PROD) / sizeof(RG_TRUSTED_ORIGINS_PROD[0]);

static const char *const RG_TRUSTED_ORIGINS_NATIVE[] = {
${nativeOrigins}
};
static const size_t RG_TRUSTED_ORIGINS_NATIVE_COUNT = sizeof(RG_TRUSTED_ORIGINS_NATIVE) / sizeof(RG_TRUSTED_ORIGINS_NATIVE[0]);

static const char *const RG_TRUSTED_ORIGINS_DEV[] = {
${devOrigins}
};
static const size_t RG_TRUSTED_ORIGINS_DEV_COUNT = sizeof(RG_TRUSTED_ORIGINS_DEV) / sizeof(RG_TRUSTED_ORIGINS_DEV[0]);

static const char *const RG_ADMIN_ROLES[] = {
${adminRoles}
};
static const size_t RG_ADMIN_ROLES_COUNT = sizeof(RG_ADMIN_ROLES) / sizeof(RG_ADMIN_ROLES[0]);

static const char *const RG_STAFF_ROLES[] = {
${staffRoles}
};
static const size_t RG_STAFF_ROLES_COUNT = sizeof(RG_STAFF_ROLES) / sizeof(RG_STAFF_ROLES[0]);

static const char RG_CONTRACT_EMBEDDED_JSON[] = ${cByteArrayLiteral(compactJson)};
`;
}

function renderTypeScript(contract: StackContract): string {
  return `// Auto-generated from contract/stack.yml — DO NOT EDIT.
// Regenerate via: just contract

export const STACK_CONTRACT = ${JSON.stringify(contract, null, 2)} as const;

export type StackContract = typeof STACK_CONTRACT;
export type StackOriginKey = keyof typeof STACK_CONTRACT.http.origins;
export type StackPlatformKey = keyof typeof STACK_CONTRACT.platforms;
`;
}

const rustStrArray = (items: readonly string[]): string =>
  items.map((item) => `    ${JSON.stringify(item)},`).join("\n");

function renderRust(contract: StackContract): string {

  return `// Auto-generated from contract/stack.yml — DO NOT EDIT.
// Regenerate via: just contract

//! Polyglot Rose Griffon stack contract constants compiled from \`contract/stack.yml\`.

#![allow(missing_docs)]

pub const CONTRACT_SCHEMA_VERSION: u32 = ${contract.schemaVersion};
pub const PROJECT_NAME: &str = ${JSON.stringify(contract.project.name)};
pub const CONTRACT_VERSION: &str = ${JSON.stringify(contract.project.version)};
pub const DEFAULT_DOMAIN: &str = ${JSON.stringify(contract.project.domain)};
pub const COOKIE_DOMAIN: &str = ${JSON.stringify(contract.project.cookieDomain)};

pub const OPENAPI_VERSION: &str = ${JSON.stringify(contract.openapi.version)};
pub const OPENAPI_DIALECT: &str = ${JSON.stringify(contract.openapi.dialect)};
pub const OPENAPI_PATH: &str = ${JSON.stringify(contract.http.openapiPath)};
pub const HEALTH_PATH: &str = ${JSON.stringify(contract.http.healthPath)};
pub const DOCS_PATH: &str = ${JSON.stringify(contract.http.docsPath)};

pub const PORT_WEBSITE: u16 = ${contract.http.defaultPorts.website ?? 3000};
pub const PORT_RANKED: u16 = ${contract.http.defaultPorts.ranked ?? 4002};
pub const PORT_MODEL_SERVE: u16 = ${contract.http.defaultPorts.modelServe ?? 8792};
pub const PORT_API: u16 = ${contract.http.defaultPorts.api ?? 8800};
pub const PORT_AZALEE: u16 = ${contract.http.defaultPorts.azalee ?? 8807};
pub const ORIGIN_API: &str = "https://api.${contract.project.domain}";
pub const ORIGIN_CDN: &str = "https://cdn.${contract.project.domain}";
pub const ORIGIN_AZALEE: &str = "https://azalee.${contract.project.domain}";
pub const ORIGIN_ACHILLEA: &str = "https://achillea.${contract.project.domain}";
pub const ORIGIN_RANKED: &str = "https://ranked.${contract.project.domain}";

pub const ACHILLEA_SCHEMA: &str = ${JSON.stringify(contract.database.primary.achilleaSchema)};
pub const ACHILLEA_ISSUER: &str = ${JSON.stringify(contract.auth.issuer)};
pub const ACHILLEA_SESSION_AUDIENCE: &str = ${JSON.stringify(contract.auth.audiences.session)};
pub const ACHILLEA_REALTIME_AUDIENCE: &str = ${JSON.stringify(contract.auth.audiences.realtime)};
pub const ACHILLEA_COOKIE_NAME: &str = ${JSON.stringify(contract.auth.cookieName)};
pub const ACHILLEA_SESSION_TTL_SECONDS: u64 = ${contract.auth.ttlSeconds.session};
pub const ACHILLEA_REALTIME_TTL_SECONDS: u64 = ${contract.auth.ttlSeconds.realtime};

pub const DB_POOL_DEFAULT_MAX: i32 = ${contract.database.primary.pool.defaultMax};
pub const DB_POOL_CEILING: i32 = ${contract.database.primary.pool.ceiling};
pub const DB_IDLE_TIMEOUT_SEC: u64 = ${contract.database.primary.pool.idleTimeoutSec};
pub const DB_MAX_LIFETIME_SEC: u64 = ${contract.database.primary.pool.maxLifetimeSec};
pub const DB_CONNECT_TIMEOUT_SEC: u64 = ${contract.database.primary.pool.connectTimeoutSec};
pub const REDIS_DEFAULT_URL: &str = ${JSON.stringify(contract.database.cache.defaultUrl)};

pub const MIRROR_DEFAULT_REL_PATH: &str = ${JSON.stringify(contract.database.mirror.defaultRelPath)};
pub const MIRROR_ENV_VARS: &[&str] = &[
${rustStrArray(contract.database.mirror.envVars)}
];
pub const MIRROR_SNAPSHOT_DIRS: &[&str] = &[
${rustStrArray(contract.database.mirror.snapshotDirs)}
];
pub const PG_SCHEMES: &[&str] = &[
${rustStrArray(contract.database.primary.pgSchemes)}
];

pub const VERCEL_MAX_BUILDS_PER_WEEK: u32 = ${contract.platforms.vercel.maxBuildsPerWeek ?? 1};
pub const CLOUDFLARE_CPU_MS: i32 = ${contract.platforms.cloudflare.cpuMs};

pub const TRUSTED_ORIGINS_PROD: &[&str] = &[
${rustStrArray(contract.http.trustedOrigins.prod)}
];

pub const ADMIN_ROLES: &[&str] = &[
${rustStrArray(contract.auth.roles.admin)}
];

pub const STAFF_ROLES: &[&str] = &[
${rustStrArray(contract.auth.roles.staff)}
];
`;
}

interface OpenApiLike {
  openapi: string;
  $self?: string;
  jsonSchemaDialect?: string;
  info: Record<string, unknown>;
  servers?: Array<Record<string, unknown>>;
  tags?: Array<Record<string, unknown>>;
  paths: Record<string, Record<string, unknown>>;
  components?: {
    schemas?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
}

async function readJsonIfExists<T>(absPath: string): Promise<T | null> {
  const f = Bun.file(absPath);
  if (!(await f.exists())) return null;
  return (await f.json()) as T;
}

async function buildMergedOpenApi(
  root: string,
  contract: StackContract,
): Promise<OpenApiLike> {
  const baseYaml = await Bun.file(join(root, contract.openapi.yamlRelPath)).text();
  const base = Bun.YAML.parse(baseYaml) as OpenApiLike;
  if (base.openapi !== contract.openapi.version) {
    throw new Error(
      `contract/openapi.yml version "${base.openapi}" !== stack.yml "${contract.openapi.version}"`,
    );
  }
  base.jsonSchemaDialect = contract.openapi.dialect;
  base.info = {
    ...base.info,
    version: contract.project.version,
  };

  const achilleaDoc = await readJsonIfExists<OpenApiLike>(
    join(root, "packages/achillea-contract/generated/achillea.openapi.json"),
  );
  const inagleDoc = await readJsonIfExists<OpenApiLike>(
    join(root, "packages/inagle/docs/OPENAPI.json"),
  );

  const mergedSchemas: Record<string, unknown> = {
    ...base.components?.schemas,
    ...achilleaDoc?.components?.schemas,
    ...inagleDoc?.components?.schemas,
  };

  const mergedPaths: Record<string, Record<string, unknown>> = {
    ...base.paths,
  };
  for (const [pathKey, pathItem] of Object.entries(inagleDoc?.paths ?? {})) {
    if (!mergedPaths[pathKey]) {
      mergedPaths[pathKey] = pathItem;
    }
  }

  return {
    ...base,
    paths: mergedPaths,
    components: {
      ...base.components,
      schemas: mergedSchemas,
    },
  };
}

function renderOpenApiTypeScript(doc: OpenApiLike): string {
  const pathCount = Object.keys(doc.paths).length;
  const schemaCount = Object.keys(doc.components?.schemas ?? {}).length;
  return `// Auto-generated from contract/openapi.yml + Achilléa + Inagle — DO NOT EDIT.
// Regenerate via: just contract

export const OPENAPI_VERSION = ${JSON.stringify(doc.openapi)} as const;
export const OPENAPI_DIALECT = ${JSON.stringify(doc.jsonSchemaDialect ?? "")} as const;
export const OPENAPI_PATH_COUNT = ${pathCount} as const;
export const OPENAPI_SCHEMA_COUNT = ${schemaCount} as const;

export const MONOREPO_OPENAPI = ${JSON.stringify(doc, null, 2)} as const;
export type MonorepoOpenApi = typeof MONOREPO_OPENAPI;
`;
}

async function main(): Promise<number> {
  const root = repoRoot();
  const check = process.argv.includes("--check");
  const yamlPath = join(root, "contract/stack.yml");
  const yamlText = await Bun.file(yamlPath).text();
  const parsed = Bun.YAML.parse(yamlText);
  validateContract(parsed);

  const mergedOpenApi = await buildMergedOpenApi(root, parsed);
  const prettyJson = `${JSON.stringify(parsed, null, 2)}\n`;
  const compactJson = JSON.stringify(parsed);
  const prettyOpenApiJson = `${JSON.stringify(mergedOpenApi, null, 2)}\n`;

  const outputs = [
    { rel: "contract/stack.json", content: prettyJson },
    { rel: parsed.openapi.jsonRelPath, content: prettyOpenApiJson },
    {
      rel: "packages/rg-config/openapi.generated.ts",
      content: renderOpenApiTypeScript(mergedOpenApi),
    },
    {
      rel: "native/c/include/rg_contract_generated.h",
      content: renderC23Header(parsed, compactJson),
    },
    {
      rel: "packages/rg-config/contract.generated.ts",
      content: renderTypeScript(parsed),
    },
    {
      rel: "crates/aphrody-nie-core/src/contract_generated.rs",
      content: renderRust(parsed),
    },
  ];

  if (check) {
    const checks = await Promise.all(
      outputs.map(async (out) => {
        const file = Bun.file(join(root, out.rel));
        const current = (await file.exists()) ? await file.text() : "";
        return current === out.content ? null : out.rel;
      }),
    );
    const stale = checks.filter((item): item is string => item !== null);
    if (stale.length > 0) {
      console.error(`Contract drift detected: ${stale.join(", ")}`);
      console.error("Regenerate with: bun packages/rg-config/scripts/sync-contract.ts");
      return 1;
    }
    console.info(`Contract up to date (${parsed.project.name}@${parsed.project.version})`);
    return 0;
  }

  await Promise.all(
    outputs.map(async (out) => {
      const abs = join(root, out.rel);
      const dir = dirname(abs);
      if (!existsSync(dir)) {
        await Bun.$`mkdir -p ${dir}`.quiet();
      }
      await Bun.write(abs, out.content);
      console.info(`  ok ${out.rel} (${out.content.split("\n").length} lines)`);
    }),
  );

  console.info(`Synced polyglot contract (${parsed.project.name}@${parsed.project.version})`);
  return 0;
}

process.exitCode = await main();
