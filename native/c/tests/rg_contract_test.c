/* SPDX-License-Identifier: Apache-2.0
 * Native C23 test binary for rg_contract LLVM library.
 */
#include "../include/rg_contract.h"

#include <assert.h>
#include <stdio.h>
#include <string.h>

int main(void) {
  assert(rg_contract_schema_version() == 1u);
  assert(strcmp(rg_contract_domain(), "rosegriffon.fr") == 0);
  assert(strcmp(rg_contract_openapi_version(), "3.2.1") == 0);
  assert(strstr(rg_contract_openapi_dialect(), "oas/3.2/dialect") != nullptr);
  assert(rg_default_port("api") == 8800);
  assert(rg_default_port("azalee") == 8807);
  assert(rg_default_port("ranked") == 4002);
  assert(rg_default_port("modelServe") == 8792);
  assert(rg_default_port("nonexistent") == -1);
  assert(rg_is_mirror_env_var("NIE_WIKI_DB"));
  assert(rg_is_mirror_env_var("NIERS_MIRROR"));
  assert(!rg_is_mirror_env_var("RANDOM_VAR"));
  const char *json = rg_contract_json();
  assert(json != nullptr && json[0] == '{' && strstr(json, "\"rosegriffon.fr\"") != nullptr);

  char buf[256];
  int32_t n = rg_resolve_origin_url(nullptr, "api", buf, sizeof(buf));
  assert(n > 0 && strcmp(buf, "https://api.rosegriffon.fr") == 0);

  n = rg_resolve_origin_url("example.test", "rankedApi", buf, sizeof(buf));
  assert(n > 0 && strcmp(buf, "https://ranked.example.test/api") == 0);

  n = rg_resolve_origin_url(nullptr, "site", buf, sizeof(buf));
  assert(n > 0 && strcmp(buf, "https://rosegriffon.fr") == 0);

  assert(rg_resolve_origin_url(nullptr, "unknown", buf, sizeof(buf)) == -1);

  assert(rg_is_trusted_origin("https://rosegriffon.fr", true));
  assert(rg_is_trusted_origin("tauri://localhost", true));
  assert(!rg_is_trusted_origin("http://localhost:3000", true));
  assert(rg_is_trusted_origin("http://localhost:3000", false));
  assert(!rg_is_trusted_origin("https://dragonballfr.com", false));

  assert(rg_is_admin_role("admin"));
  assert(rg_is_admin_role("superadmin"));
  assert(!rg_is_admin_role("user"));
  assert(rg_is_staff_role("staff"));
  assert(!rg_is_staff_role("banned"));

  assert(!rg_is_usable_env_value(nullptr));
  assert(!rg_is_usable_env_value("   "));
  assert(!rg_is_usable_env_value("undefined"));
  assert(!rg_is_usable_env_value("null"));
  assert(!rg_is_usable_env_value("eyJ2Ijo_sealed"));
  assert(rg_is_usable_env_value("postgresql://localhost:5432/rg"));

  assert(rg_validate_pg_url("postgresql://user:pass@db.internal:5432/rg"));
  assert(rg_validate_pg_url("postgres://localhost/postgres?sslmode=disable"));
  assert(!rg_validate_pg_url("https://rosegriffon.fr"));
  assert(!rg_validate_pg_url("postgresql://localhost/"));
  assert(!rg_validate_pg_url("undefined"));

  assert(rg_resolve_pool_max(0, 4) == 4);
  assert(rg_resolve_pool_max(16, 4) == 4);
  assert(rg_resolve_pool_max(2, 4) == 2);

  assert(rg_is_valid_sql_ident("profiles_v2"));
  assert(!rg_is_valid_sql_ident("1bad"));
  assert(!rg_is_valid_sql_ident("a;DROP TABLE"));

  assert(rg_is_safe_http_url("https://rosegriffon.fr/api/health"));
  assert(!rg_is_safe_http_url("http://127.0.0.1:9222/json/version"));
  assert(!rg_is_safe_http_url("http://169.254.169.254/latest/meta-data"));
  assert(!rg_is_safe_http_url("http://10.0.0.1/"));
  assert(!rg_is_safe_http_url("http://localhost:3000"));
  assert(!rg_is_safe_http_url("file:///etc/passwd"));

  puts("rg_contract C23 tests passed");
  return 0;
}
