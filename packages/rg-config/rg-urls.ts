// SPDX-License-Identifier: Apache-2.0
/**
 * Rose Griffon public origins and typed env parsing, in one place.
 *
 * Every origin derives from the apex domain (`RG_DOMAIN`, default {@link RG_DEFAULT_DOMAIN},
 * the same value as `[site].domain` in infra/services.toml). A call site keeps its own
 * historical variable (`WEBSITE_URL`, `PUBLIC_API_URL`, ...): {@link rgUrl} returns that
 * variable when set (`??` semantics, value untouched) and the derived default otherwise, so
 * behaviour is identical to the former inline `process.env.X ?? "https://..."` copies.
 *
 * Runtime class: `pure` (explicit env record; Next client code must not use it for
 * `NEXT_PUBLIC_*`, which is only inlined on literal access).
 */

import { STACK_CONTRACT } from "./contract.generated.ts";

export type RgEnv = Readonly<Record<string, string | undefined>>;

/** Apex used when `RG_DOMAIN` is unset. Sourced from `contract/stack.yml`. */
export const RG_DEFAULT_DOMAIN = STACK_CONTRACT.project.domain;

/** Public surfaces derived from the unified stack contract. */
export const RG_ORIGINS = STACK_CONTRACT.http.origins;

export type RgOrigin = keyof typeof RG_ORIGINS;

/** Apex domain (`RG_DOMAIN`). */
export function rgDomain(env: RgEnv): string {
  return env.RG_DOMAIN?.trim() || RG_DEFAULT_DOMAIN;
}

/** Default URL of a surface, derived from the apex. */
export function rgDefaultUrl(env: RgEnv, origin: RgOrigin): string {
  const { label, path } = RG_ORIGINS[origin];
  const d = rgDomain(env);
  return `https://${label ? `${label}.${d}` : d}${path}`;
}

/** `env[variable] ?? default URL of origin`. */
export function rgUrl(env: RgEnv, origin: RgOrigin, variable: string): string {
  return env[variable] ?? rgDefaultUrl(env, origin);
}

/** String variable, `fallback` when unset or blank. */
export function envString(env: RgEnv, name: string, fallback: string): string {
  const v = env[name]?.trim();
  return v ? v : fallback;
}

/** Integer variable; throws on a set but non-numeric value. */
export function envInt(env: RgEnv, name: string, fallback: number): number {
  const v = env[name]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n))
    throw new Error(`${name} must be an integer, got "${v}"`);
  return n;
}

/** Boolean variable: 1/true/yes/on and 0/false/no/off. */
export function envBool(env: RgEnv, name: string, fallback: boolean): boolean {
  const v = env[name]?.trim().toLowerCase();
  if (!v) return fallback;
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  throw new Error(`${name} must be a boolean, got "${v}"`);
}
