import { randomBytes } from "node:crypto";
import {
  contractTrustedOrigins,
  STACK_CONTRACT,
} from "@rosegriffon/config/contract";

type AuthEnvironment = {
  BETTER_AUTH_SECRET?: string;
  AUTH_SECRET?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  NODE_ENV?: string;
  NEXT_PHASE?: string;
};

const WEAK_PLACEHOLDER_SECRETS = new Set([
  "better-auth-secret",
  "secret",
  "changeme",
  "your-secret-here",
]);

export function resolveAuthSecret(
  environment: AuthEnvironment = process.env,
  configured = environment.BETTER_AUTH_SECRET ?? environment.AUTH_SECRET,
): string {
  const secret = configured?.trim();
  const production = environment.NODE_ENV === "production";
  const minLen = STACK_CONTRACT.auth.secretMinLength;
  if (secret) {
    if (
      production &&
      (secret.length < minLen ||
        secret.includes("build-placeholder-secret") ||
        WEAK_PLACEHOLDER_SECRETS.has(secret.toLowerCase()))
    ) {
      throw new Error(
        `BETTER_AUTH_SECRET must be a private, high-entropy secret of at least ${minLen} characters`,
      );
    }
    return secret;
  }
  if (production && environment.NEXT_PHASE !== "phase-production-build") {
    throw new Error(
      "BETTER_AUTH_SECRET is required for production authentication",
    );
  }
  // Next sets this phase before collecting routes; the emitted server resolves its own secret at startup.
  return randomBytes(32).toString("base64url");
}

export function resolveTrustedOrigins(
  baseURL: string,
  production = process.env.NODE_ENV === "production",
): string[] {
  const base = new URL(baseURL);
  if (!/^https?:$/.test(base.protocol) || base.username || base.password) {
    throw new Error(
      "Better Auth baseURL must be an HTTP origin without credentials",
    );
  }
  if (production && base.protocol !== "https:") {
    throw new Error("Production Better Auth baseURL must use HTTPS");
  }
  if (
    production &&
    (base.hostname === "localhost" ||
      base.hostname.endsWith(".localhost") ||
      base.hostname.startsWith("127.") ||
      base.hostname === "[::1]")
  ) {
    throw new Error(
      "Production Better Auth baseURL cannot use a loopback host",
    );
  }
  const origins = [
    ...contractTrustedOrigins(production),
    base.origin,
  ];
  return [...new Set(origins)];
}
