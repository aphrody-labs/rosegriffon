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
