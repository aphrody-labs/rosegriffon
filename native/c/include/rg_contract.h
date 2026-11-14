/* SPDX-License-Identifier: Apache-2.0
 * Pure C23 LLVM ABI for the unified Rose Griffon polyglot stack contract.
 * Zero external dependencies — compiles cleanly with clang -std=c23 + lld.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#if defined(_WIN32) || defined(__CYGWIN__)
#  if defined(RG_CONTRACT_BUILD_SHARED)
#    define RG_CAPI __declspec(dllexport)
#  elif defined(RG_CONTRACT_USE_SHARED)
#    define RG_CAPI __declspec(dllimport)
#  else
#    define RG_CAPI
#  endif
#else
#  if defined(__GNUC__) || defined(__clang__)
#    define RG_CAPI __attribute__((visibility("default")))
#  else
#    define RG_CAPI
#  endif
#endif

#ifdef __cplusplus
extern "C" {
#endif

/** Returns contract schema version (1). */
RG_CAPI uint32_t rg_contract_schema_version(void);

/** Returns default apex domain (e.g. "rosegriffon.fr"). Static lifetime. */
RG_CAPI const char *rg_contract_domain(void);

/** Returns canonical contract JSON embedded at compile time. Static lifetime. */
RG_CAPI const char *rg_contract_json(void);

/**
 * Resolves an origin URL ("site", "api", "ranked", "rankedApi", "cdn", "bot",
 * "achillea", "azalee") using `domain_override` if non-empty, else default domain.
 * Returns required byte length (excluding NUL), or -1 on unknown origin_key / error.
 */
RG_CAPI int32_t rg_resolve_origin_url(
    const char *domain_override,
    const char *origin_key,
    char *out_buf,
    size_t out_cap);

/** Returns true if `origin` is in the canonical trusted origins list. */
RG_CAPI bool rg_is_trusted_origin(const char *origin, bool production);

/** Returns true if `role` is an admin role (`admin`, `superadmin`, `editor`, `moderator`). */
RG_CAPI bool rg_is_admin_role(const char *role);

/** Returns true if `role` is a staff role (`admin`, `staff`). */
RG_CAPI bool rg_is_staff_role(const char *role);

/** Returns true if an env value is non-null, non-whitespace, not "undefined"/"null"/"eyJ2Ijo...". */
RG_CAPI bool rg_is_usable_env_value(const char *value);

/** Returns true if `url` is a valid postgres:// or postgresql:// URI with host & db path. */
RG_CAPI bool rg_validate_pg_url(const char *url);

/** Resolves clamped pool size in [1, ceiling] (ceiling <= 0 falls back to RG_DB_POOL_CEILING). */
RG_CAPI int32_t rg_resolve_pool_max(int32_t requested, int32_t ceiling);

/** Returns true if `ident` is a safe SQL column/table identifier ([a-zA-Z_][a-zA-Z0-9_]*). */
RG_CAPI bool rg_is_valid_sql_ident(const char *ident);

/** Returns true if `url` is a safe public http(s) URL (blocks loopback/RFC1918/link-local SSRF). */
RG_CAPI bool rg_is_safe_http_url(const char *url);

#ifdef __cplusplus
}
#endif
