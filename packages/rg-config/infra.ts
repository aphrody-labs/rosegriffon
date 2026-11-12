// SPDX-License-Identifier: Apache-2.0
/**
 * Typed view of the deployment manifests: `infra/hosts.toml` (roles -> hosts) and
 * `infra/services.toml` (service registry). The resolvers are pure (explicit env record);
 * {@link loadInfra} is the only function touching the filesystem.
 *
 * Environment overrides, highest priority first:
 *   RG_HOST_<ROLE>=<host key | ssh alias>   re-point a role (an unknown value becomes an ad hoc
 *                                            host whose ssh alias is that value)
 *   RG_HOST_<KEY>_<FIELD>=<value>           override one field of a host (SRV_ROOT, STACK_DIR, ...)
 *   RG_DOMAIN=<apex>                        public apex domain
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type InfraEnv = Readonly<Record<string, string | undefined>>;

export interface Host {
  key: string;
  ssh: string;
  user: string;
  public_ip: string;
  mesh_ip: string;
  cores: number;
  capabilities: string[];
  srv_root: string;
  stack_dir: string;
  env_file: string;
}

export interface Service {
  name: string;
  entry: string;
  dockerfile?: string;
  target?: string;
  image?: string;
  compose: string;
  profile?: string;
  port?: number;
  health?: string;
  role: string;
  state: string[];
  vhosts: string[];
  env: string[];
  upstream?: { name: string; keepalive: number };
}

export interface HostsManifest {
  roles: Record<string, string>;
  hosts: Record<string, Omit<Host, "key">>;
}

export interface ServicesManifest {
  site: { domain: string };
  services: Record<
    string,
    Omit<Service, "name" | "vhosts" | "state" | "env"> & Partial<Service>
  >;
}

export interface Infra {
  hosts: HostsManifest;
  services: ServicesManifest;
}

const STRING_FIELDS = [
  "ssh",
  "user",
  "public_ip",
  "mesh_ip",
  "srv_root",
  "stack_dir",
  "env_file",
] as const;

const envKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "_");

function set(env: InfraEnv, name: string): string | undefined {
  const v = env[name]?.trim();
  return v ? v : undefined;
}

/** Repository root (two levels above packages/rg-config). */
export const REPO_ROOT = resolve(import.meta.dir, "../..");

/** Reads and parses both manifests. */
export function loadInfra(root: string = REPO_ROOT): Infra {
  const parse = (file: string) =>
    Bun.TOML.parse(readFileSync(resolve(root, "infra", file), "utf8"));
  return {
    hosts: parse("hosts.toml") as unknown as HostsManifest,
    services: parse("services.toml") as unknown as ServicesManifest,
  };
}

/** Every role known to the manifest. */
export function roles(infra: Infra): string[] {
  return Object.keys(infra.hosts.roles);
}

/** Resolves a host by key or ssh alias, applying field overrides. */
export function hostByKey(infra: Infra, key: string, env: InfraEnv = {}): Host {
  const entries = Object.entries(infra.hosts.hosts);
  const found =
    entries.find(([k]) => k === key) ?? entries.find(([, h]) => h.ssh === key);
  const fallback = Object.values(infra.hosts.hosts)[0];
  const base: Host = found
    ? {
        key: found[0],
        ...found[1],
        capabilities: [...(found[1].capabilities ?? [])],
      }
    : {
        key,
        ssh: key,
        user: "",
        public_ip: "",
        mesh_ip: "",
        cores: 0,
        capabilities: [],
        srv_root: fallback?.srv_root ?? "",
        stack_dir: fallback?.stack_dir ?? "",
        env_file: fallback?.env_file ?? "",
      };
  for (const field of STRING_FIELDS) {
    const v = set(env, `RG_HOST_${envKey(base.key)}_${envKey(field)}`);
    if (v) base[field] = v;
  }
  return base;
}

/** Host currently holding `roleOrHost` (a role name, a host key or an ssh alias). */
export function resolveHost(
  infra: Infra,
  roleOrHost: string,
  env: InfraEnv = {},
): Host {
  const override = set(env, `RG_HOST_${envKey(roleOrHost)}`);
  if (override) return hostByKey(infra, override, env);
  const mapped = infra.hosts.roles[roleOrHost];
  if (mapped) return hostByKey(infra, mapped, env);
  const known =
    infra.hosts.hosts[roleOrHost] ??
    Object.values(infra.hosts.hosts).find((h) => h.ssh === roleOrHost);
  if (known) return hostByKey(infra, roleOrHost, env);
  throw new Error(
    `unknown role or host "${roleOrHost}" (roles: ${roles(infra).join(", ")})`,
  );
}

/** Public apex domain. */
export function domain(infra: Infra, env: InfraEnv = {}): string {
  return set(env, "RG_DOMAIN") ?? infra.services.site.domain;
}

/** Fully qualified name of a vhost label ("@" is the apex). */
export function vhost(infra: Infra, label: string, env: InfraEnv = {}): string {
  const d = domain(infra, env);
  return label === "@" ? d : `${label}.${d}`;
}

/** Every service with defaults filled in. */
export function services(infra: Infra): Service[] {
  return Object.entries(infra.services.services).map(([name, s]) => ({
    ...s,
    name,
    state: s.state ?? [],
    vhosts: s.vhosts ?? [],
    env: s.env ?? [],
  }));
}

/** One service by name. */
export function service(infra: Infra, name: string): Service {
  const s = services(infra).find((x) => x.name === name);
  if (!s)
    throw new Error(
      `unknown service "${name}" (services: ${services(infra)
        .map((x) => x.name)
        .join(", ")})`,
    );
  return s;
}

/** Variables exported to compose on a host: bind-mount root and env file. */
export function composeEnv(
  host: Host,
  infra: Infra,
  env: InfraEnv = {},
): Record<string, string> {
  return {
    RG_SRV_ROOT: host.srv_root,
    RG_ENV_FILE: host.env_file,
    RG_STACK_DIR: host.stack_dir,
    RG_DOMAIN: domain(infra, env),
  };
}

/** nginx upstream blocks for every service declaring one (compose service name as server). */
export function renderUpstreams(infra: Infra): string {
  const blocks = services(infra)
    .filter((s) => s.upstream && s.port)
    .map(
      (s) =>
        `upstream ${s.upstream!.name} {\n    server ${s.name}:${s.port};\n    keepalive ${s.upstream!.keepalive};\n}\n`,
    );
  return [
    "# SPDX-License-Identifier: Apache-2.0",
    "# GENERATED by `bun infra/ops/cli.ts render` from infra/services.toml. Do not edit.",
    "",
    blocks.join("\n"),
  ].join("\n");
}

/** Substitutes `${RG_DOMAIN}` in a template. */
export function renderTemplate(
  template: string,
  infra: Infra,
  env: InfraEnv = {},
): string {
  return template.replaceAll("${RG_DOMAIN}", domain(infra, env));
}
