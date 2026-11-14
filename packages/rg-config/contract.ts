// SPDX-License-Identifier: Apache-2.0
/**
 * Runtime helpers over the unified Rose Griffon stack contract (`contract/stack.yml`).
 * Pure / zero-FS: works across Bun, Node, Next.js client/server, and Edge Workers.
 */

export {
  STACK_CONTRACT,
  type StackContract,
  type StackOriginKey,
  type StackPlatformKey,
} from "./contract.generated.ts";
import { STACK_CONTRACT } from "./contract.generated.ts";

const WEAK_POSTGRES_LITERALS = new Set(["undefined", "null"]);

export function isUsableEnvValue(
  value: string | null | undefined,
): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (WEAK_POSTGRES_LITERALS.has(trimmed)) return false;
  if (trimmed.startsWith("eyJ2Ijo")) return false;
  return true;
}

export function isValidPostgresUrl(url: string | null | undefined): url is string {
  if (!isUsableEnvValue(url)) return false;
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") &&
      Boolean(parsed.hostname) &&
      parsed.pathname.length > 1
    );
  } catch {
    return false;
  }
}

export function isContractAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (STACK_CONTRACT.auth.roles.admin as readonly string[]).includes(role);
}

export function isContractStaffRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (STACK_CONTRACT.auth.roles.staff as readonly string[]).includes(role);
}

export function contractTrustedOrigins(production: boolean): string[] {
  return [
    ...STACK_CONTRACT.http.trustedOrigins.prod,
    ...STACK_CONTRACT.http.trustedOrigins.native,
    ...(production ? [] : STACK_CONTRACT.http.trustedOrigins.dev),
  ];
}
