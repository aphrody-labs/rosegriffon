/* SPDX-License-Identifier: Apache-2.0
 * Freestanding Pure C23 LLVM core implementation of the Rose Griffon stack contract.
 * Zero libc/OS header dependencies — compiles identically on Windows, Linux, and WASM32.
 */
#define RG_CONTRACT_BUILD_SHARED 1

#include "../include/rg_contract.h"
#include "../include/rg_contract_generated.h"

static bool c_isspace(unsigned char c) {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\v' || c == '\f';
}

static bool c_isdigit(unsigned char c) {
  return c >= '0' && c <= '9';
}

static bool c_isalpha(unsigned char c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

static bool c_isalnum(unsigned char c) {
  return c_isalpha(c) || c_isdigit(c);
}

static unsigned char c_tolower(unsigned char c) {
  return (c >= 'A' && c <= 'Z') ? (unsigned char)(c + ('a' - 'A')) : c;
}

static size_t c_strlen(const char *s) {
  size_t n = 0;
  if (s == nullptr) {
    return 0;
  }
  while (s[n] != '\0') {
    ++n;
  }
  return n;
}

static int c_strcmp(const char *a, const char *b) {
  while (*a != '\0' && *a == *b) {
    ++a;
    ++b;
  }
  return (int)(unsigned char)*a - (int)(unsigned char)*b;
}

static int c_strncmp(const char *a, const char *b, size_t n) {
  for (size_t i = 0; i < n; ++i) {
    if (a[i] != b[i] || a[i] == '\0') {
      return (int)(unsigned char)a[i] - (int)(unsigned char)b[i];
    }
  }
  return 0;
}

static const char *c_strchr(const char *s, char ch) {
  for (; *s != '\0'; ++s) {
    if (*s == ch) {
      return s;
    }
  }
  return nullptr;
}

static const char *c_memchr(const char *s, char ch, size_t n) {
  for (size_t i = 0; i < n; ++i) {
    if (s[i] == ch) {
      return s + i;
    }
  }
  return nullptr;
}

static bool ascii_eq_ci_n(const char *a, const char *b, size_t n) {
  if (a == nullptr || b == nullptr) {
    return false;
  }
  for (size_t i = 0; i < n; ++i) {
    if (a[i] == '\0' || b[i] == '\0' ||
        c_tolower((unsigned char)a[i]) != c_tolower((unsigned char)b[i])) {
      return false;
    }
  }
  return true;
}

static bool str_eq_ci_prefix(const char *s, const char *prefix) {
  if (s == nullptr || prefix == nullptr) {
    return false;
  }
  while (*prefix != '\0') {
    if (*s == '\0' ||
        c_tolower((unsigned char)*s) != c_tolower((unsigned char)*prefix)) {
      return false;
    }
    ++s;
    ++prefix;
  }
  return true;
}

static const char *trim_start(const char *s) {
  if (s == nullptr) {
    return nullptr;
  }
  while (*s != '\0' && c_isspace((unsigned char)*s)) {
    ++s;
  }
  return s;
}

static bool has_prefix(const char *s, const char *prefix) {
  if (s == nullptr || prefix == nullptr) {
    return false;
  }
  size_t plen = c_strlen(prefix);
  return c_strncmp(s, prefix, plen) == 0;
}

RG_CAPI uint32_t rg_contract_schema_version(void) {
  return RG_CONTRACT_SCHEMA_VERSION;
}

RG_CAPI const char *rg_contract_domain(void) {
  return RG_DEFAULT_DOMAIN;
}

RG_CAPI const char *rg_contract_json(void) {
  return RG_CONTRACT_EMBEDDED_JSON;
}

RG_CAPI const char *rg_contract_openapi_version(void) {
  return RG_OPENAPI_VERSION;
}

RG_CAPI const char *rg_contract_openapi_dialect(void) {
  return RG_OPENAPI_DIALECT;
}

RG_CAPI int32_t rg_default_port(const char *service_key) {
  if (service_key == nullptr) {
    return -1;
  }
  for (size_t i = 0; i < RG_DEFAULT_PORTS_COUNT; ++i) {
    if (c_strcmp(RG_DEFAULT_PORTS[i].key, service_key) == 0) {
      return RG_DEFAULT_PORTS[i].port;
    }
  }
  return -1;
}

RG_CAPI bool rg_is_mirror_env_var(const char *name) {
  if (name == nullptr) {
    return false;
  }
  for (size_t i = 0; i < RG_MIRROR_ENV_VARS_COUNT; ++i) {
    if (c_strcmp(RG_MIRROR_ENV_VARS[i], name) == 0) {
      return true;
    }
  }
  return false;
}

RG_CAPI int32_t rg_resolve_origin_url(
    const char *domain_override,
    const char *origin_key,
    char *out_buf,
    size_t out_cap) {
  if (origin_key == nullptr) {
    return -1;
  }

  const rg_origin_spec_t *found = nullptr;
  for (size_t i = 0; i < RG_ORIGIN_SPECS_COUNT; ++i) {
    if (c_strcmp(RG_ORIGIN_SPECS[i].key, origin_key) == 0) {
      found = &RG_ORIGIN_SPECS[i];
      break;
    }
  }
  if (found == nullptr) {
    return -1;
  }

  const char *domain = RG_DEFAULT_DOMAIN;
  if (domain_override != nullptr) {
    const char *trimmed = trim_start(domain_override);
    if (trimmed != nullptr && *trimmed != '\0') {
      domain = trimmed;
    }
  }

  const size_t scheme_len = 8; // "https://"
  const size_t label_len = c_strlen(found->label);
  const size_t dot_len = label_len > 0 ? 1u : 0u;
  const size_t domain_len = c_strlen(domain);
  const size_t path_len = c_strlen(found->path);
  const size_t needed = scheme_len + label_len + dot_len + domain_len + path_len;

  if (out_buf != nullptr && out_cap > needed) {
    size_t pos = 0;
    const char *scheme = "https://";
    for (size_t i = 0; i < scheme_len; ++i) {
      out_buf[pos++] = scheme[i];
    }
    if (label_len > 0) {
      for (size_t i = 0; i < label_len; ++i) {
        out_buf[pos++] = found->label[i];
      }
      out_buf[pos++] = '.';
    }
    for (size_t i = 0; i < domain_len; ++i) {
      out_buf[pos++] = domain[i];
    }
    for (size_t i = 0; i < path_len; ++i) {
      out_buf[pos++] = found->path[i];
    }
    out_buf[pos] = '\0';
  }
  return (int32_t)needed;
}

RG_CAPI bool rg_is_trusted_origin(const char *origin, bool production) {
  if (origin == nullptr || *origin == '\0') {
    return false;
  }
  for (size_t i = 0; i < RG_TRUSTED_ORIGINS_PROD_COUNT; ++i) {
    if (c_strcmp(origin, RG_TRUSTED_ORIGINS_PROD[i]) == 0) {
      return true;
    }
  }
  for (size_t i = 0; i < RG_TRUSTED_ORIGINS_NATIVE_COUNT; ++i) {
    if (c_strcmp(origin, RG_TRUSTED_ORIGINS_NATIVE[i]) == 0) {
      return true;
    }
  }
  if (!production) {
    for (size_t i = 0; i < RG_TRUSTED_ORIGINS_DEV_COUNT; ++i) {
      if (c_strcmp(origin, RG_TRUSTED_ORIGINS_DEV[i]) == 0) {
        return true;
      }
    }
  }
  return false;
}

RG_CAPI bool rg_is_admin_role(const char *role) {
  if (role == nullptr) {
    return false;
  }
  for (size_t i = 0; i < RG_ADMIN_ROLES_COUNT; ++i) {
    if (c_strcmp(role, RG_ADMIN_ROLES[i]) == 0) {
      return true;
    }
  }
  return false;
}

RG_CAPI bool rg_is_staff_role(const char *role) {
  if (role == nullptr) {
    return false;
  }
  for (size_t i = 0; i < RG_STAFF_ROLES_COUNT; ++i) {
    if (c_strcmp(role, RG_STAFF_ROLES[i]) == 0) {
      return true;
    }
  }
  return false;
}

RG_CAPI bool rg_is_usable_env_value(const char *value) {
  if (value == nullptr) {
    return false;
  }
  const char *p = trim_start(value);
  if (*p == '\0') {
    return false;
  }
  size_t len = c_strlen(p);
  while (len > 0 && c_isspace((unsigned char)p[len - 1])) {
    --len;
  }
  if (len == 0) {
    return false;
  }
  if ((len == 9 && c_strncmp(p, "undefined", 9) == 0) ||
      (len == 4 && c_strncmp(p, "null", 4) == 0)) {
    return false;
  }
  if (len >= 7 && c_strncmp(p, "eyJ2Ijo", 7) == 0) {
    return false;
  }
  return true;
}

RG_CAPI bool rg_validate_pg_url(const char *url) {
  if (!rg_is_usable_env_value(url)) {
    return false;
  }
  const char *rest = nullptr;
  if (has_prefix(url, "postgres://")) {
    rest = url + 11;
  } else if (has_prefix(url, "postgresql://")) {
    rest = url + 13;
  } else {
    return false;
  }
  for (const char *c = rest; *c != '\0'; ++c) {
    if ((unsigned char)*c <= 0x20) {
      return false;
    }
  }
  const char *slash = c_strchr(rest, '/');
  if (slash == nullptr || slash == rest || slash[1] == '\0' ||
      slash[1] == '?') {
    return false;
  }
  const char *at = c_strchr(rest, '@');
  const char *host = (at != nullptr && at < slash) ? (at + 1) : rest;
  if (*host == '\0' || *host == ':' || host >= slash) {
    return false;
  }
  return true;
}

RG_CAPI int32_t rg_resolve_pool_max(int32_t requested, int32_t ceiling) {
  int32_t cap = ceiling > 0 ? ceiling : RG_DB_POOL_CEILING;
  if (requested <= 0) {
    return RG_DB_POOL_DEFAULT_MAX <= cap ? RG_DB_POOL_DEFAULT_MAX : cap;
  }
  return requested > cap ? cap : requested;
}

RG_CAPI bool rg_is_valid_sql_ident(const char *ident) {
  if (ident == nullptr || *ident == '\0') {
    return false;
  }
  unsigned char first = (unsigned char)ident[0];
  if (!(c_isalpha(first) || first == '_')) {
    return false;
  }
  for (const char *p = ident + 1; *p != '\0'; ++p) {
    unsigned char ch = (unsigned char)*p;
    if (!(c_isalnum(ch) || ch == '_')) {
      return false;
    }
  }
  return true;
}

static bool parse_ipv4_octets(const char *host, size_t host_len, uint8_t out[4]) {
  if (host_len == 0 || host_len > 15) {
    return false;
  }
  int parts = 0;
  size_t i = 0;
  while (i < host_len && parts < 4) {
    if (!c_isdigit((unsigned char)host[i])) {
      return false;
    }
    uint32_t val = 0;
    size_t digits = 0;
    while (i < host_len && c_isdigit((unsigned char)host[i])) {
      val = val * 10u + (uint32_t)(host[i] - '0');
      ++digits;
      ++i;
      if (digits > 3 || val > 255u) {
        return false;
      }
    }
    out[parts++] = (uint8_t)val;
    if (i < host_len) {
      if (host[i] != '.' || parts >= 4) {
        return false;
      }
      ++i;
      if (i == host_len) {
        return false;
      }
    }
  }
  return parts == 4 && i == host_len;
}

RG_CAPI bool rg_is_safe_http_url(const char *url) {
  if (!rg_is_usable_env_value(url)) {
    return false;
  }
  const char *rest = nullptr;
  if (str_eq_ci_prefix(url, "https://")) {
    rest = url + 8;
  } else if (str_eq_ci_prefix(url, "http://")) {
    rest = url + 7;
  } else {
    return false;
  }

  const char *end = rest;
  while (*end != '\0' && *end != '/' && *end != '?' && *end != '#') {
    if ((unsigned char)*end <= 0x20) {
      return false;
    }
    ++end;
  }
  for (const char *p = rest; p < end; ++p) {
    if (*p == '@') {
      return false;
    }
  }

  if (rest < end && *rest == '[') {
    const char *close = c_memchr(rest, ']', (size_t)(end - rest));
    if (close == nullptr || close == rest + 1) {
      return false;
    }
    size_t v6len = (size_t)(close - (rest + 1));
    const char *v6 = rest + 1;
    if ((v6len == 3 && c_strncmp(v6, "::1", 3) == 0) ||
        (v6len == 2 && c_strncmp(v6, "::", 2) == 0) ||
        str_eq_ci_prefix(v6, "fe80:") ||
        str_eq_ci_prefix(v6, "fc") ||
        str_eq_ci_prefix(v6, "fd")) {
      return false;
    }
    return true;
  }

  const char *host_end = end;
  for (const char *p = rest; p < end; ++p) {
    if (*p == ':') {
      host_end = p;
      break;
    }
  }
  size_t host_len = (size_t)(host_end - rest);
  if (host_len == 0) {
    return false;
  }

  if ((host_len == 9 && ascii_eq_ci_n(rest, "localhost", 9)) ||
      (host_len > 10 &&
       ascii_eq_ci_n(host_end - 10, ".localhost", 10)) ||
      (host_len > 6 && ascii_eq_ci_n(host_end - 6, ".local", 6)) ||
      (host_len > 9 && ascii_eq_ci_n(host_end - 9, ".internal", 9))) {
    return false;
  }

  uint8_t ip[4];
  if (parse_ipv4_octets(rest, host_len, ip)) {
    if (ip[0] == 0 || ip[0] == 10 || ip[0] == 127) {
      return false;
    }
    if (ip[0] == 169 && ip[1] == 254) {
      return false;
    }
    if (ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31) {
      return false;
    }
    if (ip[0] == 192 && ip[1] == 168) {
      return false;
    }
    if (ip[0] == 100 && ip[1] >= 64 && ip[1] <= 127) {
      return false;
    }
  }

  return true;
}
