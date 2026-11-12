// SPDX-License-Identifier: Apache-2.0
/**
 * Where a service runs: self-hosted on the fleet, on Cloudflare, or on Vercel.
 *
 * `infra/platforms.toml` states each platform's free allowance and what it may host;
 * `infra/services.toml` gives every service an ordered `platforms` candidate list plus the
 * capabilities it `requires`. The resolvers below are pure, so moving a unit between self-host and
 * the edge (in either direction) is one edit in the registry, never a code change.
 */

import type { Infra, InfraEnv, Platform, Service } from "./infra.ts";

const DEFAULT_PLATFORM = "vps";

const override = (env: InfraEnv, name: string): string | undefined => {
  const v = env[`RG_PLATFORM_${name.replaceAll("-", "_").toUpperCase()}`];
  return v && v.length > 0 ? v : undefined;
};

/** Platform row by key, with its own key filled in. */
export function platformByKey(infra: Infra, key: string): Platform {
  const row = infra.platforms.platforms[key];
  if (!row) {
    const have = Object.keys(infra.platforms.platforms).join(", ");
    throw new Error(`unknown platform "${key}" (have: ${have})`);
  }
  return { key, ...row };
}

/** Every platform in the manifest. */
export function platforms(infra: Infra): string[] {
  return Object.keys(infra.platforms.platforms);
}

/** Candidate platforms of a service in preference order; self-host when the registry is silent. */
export function platformCandidates(infra: Infra, svc: Service): string[] {
  const list = svc.platforms?.length ? svc.platforms : [DEFAULT_PLATFORM];
  return list.filter((k) => k in infra.platforms.platforms);
}

/**
 * Why a platform cannot host a service, or null when it can. Checked in order of how expensive
 * the mistake is: a missing capability breaks the build, a terms violation gets the account
 * suspended, and state on a stateless platform loses data.
 */
export function platformBlocker(
  infra: Infra,
  svc: Service,
  key: string,
): string | null {
  const p = platformByKey(infra, key);
  const missing = (svc.requires ?? []).filter((n) => !p.needs.includes(n));
  if (missing.length > 0) return `missing ${missing.join(", ")}`;
  if (svc.commercial && !p.commercial)
    return "free tier is non-commercial only";
  const state = svc.state ?? [];
  if (state.length > 0 && !p.stateful)
    return `holds state (${state.join(", ")})`;
  return null;
}

/**
 * Resolves where a service runs: `RG_PLATFORM_<SERVICE>` wins, otherwise the first candidate that
 * can actually host it. Throws with every rejection reason when no candidate fits.
 */
export function platformFor(
  infra: Infra,
  svc: Service,
  env: InfraEnv = {},
): Platform {
  const forced = override(env, svc.name);
  if (forced) return platformByKey(infra, forced);
  const candidates = platformCandidates(infra, svc);
  for (const key of candidates) {
    if (!platformBlocker(infra, svc, key)) return platformByKey(infra, key);
  }
  const why = candidates
    .map((k) => `${k} (${platformBlocker(infra, svc, k)})`)
    .join("; ");
  throw new Error(
    `no platform can host "${svc.name}": ${why || "no candidate"}`,
  );
}

/** Daily request budget of a platform, or null when unmetered. */
export function freeRequestBudget(p: Platform): number | null {
  return p.free_requests_per_day < 0 ? null : p.free_requests_per_day;
}
