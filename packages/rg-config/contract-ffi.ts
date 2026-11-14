// SPDX-License-Identifier: Apache-2.0
/**
 * Optional bun:ffi binding to the LLVM C23 `rg_contract` shared library (`native/c/`).
 * Lets Bun runtimes verify or execute the exact same C23 ABI shared with C/Rust/native hosts.
 */

import { dlopen, FFIType } from "bun:ffi";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULT_LIB_NAME =
  process.platform === "win32" ? "rg_contract.dll" : "librg_contract.so";

export function resolveContractLibraryPath(): string | null {
  const candidates = [
    process.env.RG_CONTRACT_LIB_PATH,
    resolve(import.meta.dir, "../../native/c/build", DEFAULT_LIB_NAME),
    join(process.cwd(), "native/c/build", DEFAULT_LIB_NAME),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => existsSync(p)) ?? null;
}

export interface NativeContract {
  readonly path: string;
  schemaVersion(): number;
  domain(): string;
  openapiVersion(): string;
  openapiDialect(): string;
  defaultPort(serviceKey: string): number;
  isMirrorEnvVar(name: string): boolean;
  contractJson(): string;
  resolveOriginUrl(originKey: string, domainOverride?: string | null): string | null;
  isTrustedOrigin(origin: string, production: boolean): boolean;
  isAdminRole(role: string): boolean;
  isStaffRole(role: string): boolean;
  isUsableEnvValue(value: string): boolean;
  validatePgUrl(url: string): boolean;
  resolvePoolMax(requested: number, ceiling: number): number;
  isValidSqlIdent(ident: string): boolean;
  isSafeHttpUrl(url: string): boolean;
  close(): void;
}

const cstr = (s: string | null | undefined): Uint8Array | null =>
  s == null ? null : Buffer.from(`${s}\0`, "utf8");

export function loadNativeContract(
  path = resolveContractLibraryPath(),
): NativeContract | null {
  if (!path || !existsSync(path)) return null;

  const lib = dlopen(path, {
    rg_contract_schema_version: { args: [], returns: FFIType.u32 },
    rg_contract_domain: { args: [], returns: FFIType.cstring },
    rg_contract_openapi_version: { args: [], returns: FFIType.cstring },
    rg_contract_openapi_dialect: { args: [], returns: FFIType.cstring },
    rg_default_port: { args: [FFIType.ptr], returns: FFIType.i32 },
    rg_is_mirror_env_var: { args: [FFIType.ptr], returns: FFIType.bool },
    rg_contract_json: { args: [], returns: FFIType.cstring },
    rg_resolve_origin_url: {
      args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u64],
      returns: FFIType.i32,
    },
    rg_is_trusted_origin: {
      args: [FFIType.ptr, FFIType.bool],
      returns: FFIType.bool,
    },
    rg_is_admin_role: { args: [FFIType.ptr], returns: FFIType.bool },
    rg_is_staff_role: { args: [FFIType.ptr], returns: FFIType.bool },
    rg_is_usable_env_value: { args: [FFIType.ptr], returns: FFIType.bool },
    rg_validate_pg_url: { args: [FFIType.ptr], returns: FFIType.bool },
    rg_resolve_pool_max: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.i32,
    },
    rg_is_valid_sql_ident: { args: [FFIType.ptr], returns: FFIType.bool },
    rg_is_safe_http_url: { args: [FFIType.ptr], returns: FFIType.bool },
  });

  const s = lib.symbols;

  return {
    path,
    schemaVersion: () => s.rg_contract_schema_version(),
    domain: () => s.rg_contract_domain()?.toString() ?? "",
    openapiVersion: () => s.rg_contract_openapi_version()?.toString() ?? "",
    openapiDialect: () => s.rg_contract_openapi_dialect()?.toString() ?? "",
    defaultPort: (serviceKey: string) => s.rg_default_port(cstr(serviceKey)),
    isMirrorEnvVar: (name: string) => s.rg_is_mirror_env_var(cstr(name)),
    contractJson: () => s.rg_contract_json()?.toString() ?? "{}",
    resolveOriginUrl(originKey: string, domainOverride?: string | null) {
      const buf = new Uint8Array(512);
      const written = s.rg_resolve_origin_url(
        cstr(domainOverride),
        cstr(originKey),
        buf,
        buf.byteLength,
      );
      if (written < 0 || written >= buf.byteLength) return null;
      return Buffer.from(buf.subarray(0, written)).toString("utf8");
    },
    isTrustedOrigin: (origin: string, production: boolean) =>
      s.rg_is_trusted_origin(cstr(origin), production),
    isAdminRole: (role: string) => s.rg_is_admin_role(cstr(role)),
    isStaffRole: (role: string) => s.rg_is_staff_role(cstr(role)),
    isUsableEnvValue: (value: string) => s.rg_is_usable_env_value(cstr(value)),
    validatePgUrl: (url: string) => s.rg_validate_pg_url(cstr(url)),
    resolvePoolMax: (requested: number, ceiling: number) =>
      s.rg_resolve_pool_max(requested, ceiling),
    isValidSqlIdent: (ident: string) => s.rg_is_valid_sql_ident(cstr(ident)),
    isSafeHttpUrl: (url: string) => s.rg_is_safe_http_url(cstr(url)),
    close: () => lib.close(),
  };
}
