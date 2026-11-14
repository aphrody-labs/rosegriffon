import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import {
  contractTrustedOrigins,
  isContractAdminRole,
  isContractStaffRole,
  isUsableEnvValue,
  isValidPostgresUrl,
  STACK_CONTRACT,
} from "../contract.ts";
import { loadNativeContract } from "../contract-ffi.ts";
import {
  MONOREPO_OPENAPI,
  OPENAPI_DIALECT,
  OPENAPI_PATH_COUNT,
  OPENAPI_SCHEMA_COUNT,
  OPENAPI_VERSION,
} from "../openapi.generated.ts";

const ROOT = resolve(import.meta.dir, "../../..");

describe("unified polyglot stack contract", () => {
  test("contract/stack.json matches contract/stack.yml and contract.generated.ts", async () => {
    const yamlObj = Bun.YAML.parse(
      await Bun.file(join(ROOT, "contract/stack.yml")).text(),
    );
    const jsonObj = await Bun.file(join(ROOT, "contract/stack.json")).json();
    expect(jsonObj).toEqual(yamlObj);
    expect(STACK_CONTRACT).toEqual(jsonObj);
  });

  test("contract/openapi.json satisfies OpenAPI 3.2.1 across all monorepo domains", async () => {
    const openapiJson = await Bun.file(join(ROOT, "contract/openapi.json")).json();
    expect(OPENAPI_VERSION).toBe("3.2.1");
    expect(OPENAPI_DIALECT).toBe("https://spec.openapis.org/oas/3.2/dialect/2025-09-19");
    expect(openapiJson).toEqual(MONOREPO_OPENAPI);
    expect(OPENAPI_PATH_COUNT).toBeGreaterThanOrEqual(25);
    expect(OPENAPI_SCHEMA_COUNT).toBeGreaterThanOrEqual(150);
    expect(MONOREPO_OPENAPI.paths["/health"]).toBeDefined();
    expect(MONOREPO_OPENAPI.paths["/v1/tournaments"]).toBeDefined();
    expect(MONOREPO_OPENAPI.paths["/api/ranked/challenge"]).toBeDefined();
    expect(MONOREPO_OPENAPI.paths["/api/characters"]).toBeDefined();
    expect(MONOREPO_OPENAPI.paths["/model-full/{code}.glb"]).toBeDefined();
    expect(MONOREPO_OPENAPI.paths["/api/openapi.json"]).toBeDefined();
  });

  test("TS contract helpers enforce auth, roles, and Postgres URL invariants", () => {
    expect(isContractAdminRole("admin")).toBe(true);
    expect(isContractAdminRole("superadmin")).toBe(true);
    expect(isContractAdminRole("user")).toBe(false);
    expect(isContractStaffRole("staff")).toBe(true);
    expect(isContractStaffRole("banned")).toBe(false);

    expect(isUsableEnvValue(undefined)).toBe(false);
    expect(isUsableEnvValue("undefined")).toBe(false);
    expect(isUsableEnvValue("eyJ2Ijo_blob")).toBe(false);
    expect(isUsableEnvValue("ok")).toBe(true);

    expect(
      isValidPostgresUrl("postgresql://user:pass@db.example:5432/rg"),
    ).toBe(true);
    expect(isValidPostgresUrl("postgres://localhost/")).toBe(false);
    expect(isValidPostgresUrl("https://rosegriffon.fr")).toBe(false);

    expect(contractTrustedOrigins(true)).toContain("https://rosegriffon.fr");
    expect(contractTrustedOrigins(true)).not.toContain(
      "http://localhost:3000",
    );
    expect(contractTrustedOrigins(false)).toContain("http://localhost:3000");
  });

  test("Pure C23 LLVM cdylib (rg_contract) has byte-for-byte parity with TypeScript contract", () => {
    const native = loadNativeContract();
    expect(native).not.toBeNull();
    if (!native) return;
    try {
      expect(native.schemaVersion()).toBe(STACK_CONTRACT.schemaVersion);
      expect(native.domain()).toBe(STACK_CONTRACT.project.domain);
      expect(native.openapiVersion()).toBe(STACK_CONTRACT.openapi.version);
      expect(native.openapiDialect()).toBe(STACK_CONTRACT.openapi.dialect);
      expect(native.defaultPort("api")).toBe(STACK_CONTRACT.http.defaultPorts.api);
      expect(native.defaultPort("azalee")).toBe(STACK_CONTRACT.http.defaultPorts.azalee);
      expect(native.defaultPort("ranked")).toBe(STACK_CONTRACT.http.defaultPorts.ranked);
      expect(native.defaultPort("modelServe")).toBe(
        STACK_CONTRACT.http.defaultPorts.modelServe,
      );
      expect(native.isMirrorEnvVar("NIE_WIKI_DB")).toBe(true);
      expect(native.isMirrorEnvVar("UNKNOWN_ENV")).toBe(false);
      expect(JSON.parse(native.contractJson())).toEqual(STACK_CONTRACT);

      expect(native.resolveOriginUrl("api")).toBe("https://api.rosegriffon.fr");
      expect(native.resolveOriginUrl("rankedApi", "example.test")).toBe(
        "https://ranked.example.test/api",
      );
      expect(native.resolveOriginUrl("site")).toBe("https://rosegriffon.fr");
      expect(native.resolveOriginUrl("nonexistent")).toBeNull();

      expect(native.isTrustedOrigin("https://rosegriffon.fr", true)).toBe(true);
      expect(native.isTrustedOrigin("tauri://localhost", true)).toBe(true);
      expect(native.isTrustedOrigin("http://localhost:3000", true)).toBe(false);
      expect(native.isTrustedOrigin("http://localhost:3000", false)).toBe(true);

      expect(native.isAdminRole("admin")).toBe(true);
      expect(native.isAdminRole("user")).toBe(false);
      expect(native.isStaffRole("staff")).toBe(true);
      expect(native.isStaffRole("guest")).toBe(false);

      expect(native.isUsableEnvValue("eyJ2Ijo_secret")).toBe(false);
      expect(native.validatePgUrl("postgresql://u:p@host:5432/db")).toBe(true);
      expect(native.validatePgUrl("https://rosegriffon.fr")).toBe(false);
      expect(native.resolvePoolMax(16, 4)).toBe(4);
      expect(native.resolvePoolMax(0, 4)).toBe(4);
      expect(native.isValidSqlIdent("profiles_2026")).toBe(true);
      expect(native.isValidSqlIdent("bad;ident")).toBe(false);

      expect(native.isSafeHttpUrl("https://rosegriffon.fr/api/health")).toBe(
        true,
      );
      expect(native.isSafeHttpUrl("http://127.0.0.1:9222/json")).toBe(false);
      expect(
        native.isSafeHttpUrl("http://169.254.169.254/latest/meta-data"),
      ).toBe(false);
    } finally {
      native.close();
    }
  });
});
