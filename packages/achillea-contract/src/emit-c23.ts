/**
 * IR -> Pure Modern C23 LLVM header (`achillea.h`).
 *
 * Emits zero-dependency C23 ABI declarations (`#pragma once`, `<stdbool.h>`,
 * `<stddef.h>`, `<stdint.h>`) so C23, LLVM LTO, Rust/cbindgen, and FFI
 * consumers share the exact same domain shapes as JSON Schema / Rust / TS.
 */

import { resolveFields } from "./emit-json-schema";
import {
  indexDeclarations,
  type IrContract,
  type IrField,
  type IrType,
} from "./ir";
import { toSnakeCase } from "./naming";

const C23_KEYWORDS = new Set([
  "alignas",
  "alignof",
  "auto",
  "bool",
  "break",
  "case",
  "char",
  "const",
  "constexpr",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extern",
  "false",
  "float",
  "for",
  "goto",
  "if",
  "inline",
  "int",
  "long",
  "nullptr",
  "register",
  "restrict",
  "return",
  "short",
  "signed",
  "sizeof",
  "static",
  "static_assert",
  "struct",
  "switch",
  "thread_local",
  "true",
  "typedef",
  "typeof",
  "typeof_unqual",
  "union",
  "unsigned",
  "void",
  "volatile",
  "while",
]);

function cIdent(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, "_");
  const prefixed = /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
  return C23_KEYWORDS.has(prefixed) ? `${prefixed}_` : prefixed;
}

function cFieldIdent(raw: string): string {
  return cIdent(toSnakeCase(raw));
}

function cUpperMacro(name: string): string {
  return toSnakeCase(name).replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
}

function cTypeFor(
  type: IrType,
  defined: ReadonlySet<string>,
): string {
  switch (type.kind) {
    case "string":
    case "date":
      return "const char *";
    case "number":
      return "double";
    case "integer":
      return "int64_t";
    case "boolean":
      return "bool";
    case "null":
    case "unknown":
    case "map":
    case "object":
    case "tuple":
    case "union":
    case "param":
      return "achillea_json_t";
    case "literal":
      return typeof type.value === "string"
        ? "const char *"
        : typeof type.value === "number"
          ? "double"
          : "bool";
    case "array": {
      if (type.of.kind === "string" || type.of.kind === "date") {
        return "achillea_str_slice_t";
      }
      if (type.of.kind === "integer") {
        return "achillea_i64_slice_t";
      }
      if (type.of.kind === "number") {
        return "achillea_f64_slice_t";
      }
      return "achillea_json_t";
    }
    case "ref": {
      const target = cIdent(`Achillea_${type.name}`);
      return defined.has(target) ? target : "achillea_json_t";
    }
  }
}

export function emitC23(contract: IrContract): string {
  const byName = indexDeclarations(contract);
  const definedTypes = new Set<string>();
  const out: string[] = [
    "/* Achillea Polyglot Contract — Pure C23 LLVM ABI header (AUTO-GENERATED).",
    ` * Source: ${contract.source}@${contract.version}`,
    " * Regenerate: bun --filter @rosegriffon/achillea-contract generate",
    " */",
    "#pragma once",
    "",
    "#include <stdbool.h>",
    "#include <stddef.h>",
    "#include <stdint.h>",
    "",
    "#ifdef __cplusplus",
    'extern "C" {',
    "#endif",
    "",
    `#define ACHILLEA_CONTRACT_SOURCE ${JSON.stringify(contract.source)}`,
    `#define ACHILLEA_CONTRACT_VERSION ${JSON.stringify(contract.version)}`,
    `#define ACHILLEA_DECLARATION_COUNT ${contract.declarations.length}u`,
    "",
    "typedef const char *achillea_json_t;",
    "",
    "typedef struct {",
    "  const char *const *items;",
    "  size_t len;",
    "} achillea_str_slice_t;",
    "",
    "typedef struct {",
    "  const int64_t *items;",
    "  size_t len;",
    "} achillea_i64_slice_t;",
    "",
    "typedef struct {",
    "  const double *items;",
    "  size_t len;",
    "} achillea_f64_slice_t;",
    "",
  ];

  // Emit enums first so struct fields referencing enum types are already complete.
  for (const decl of contract.declarations) {
    if (decl.kind !== "enum") continue;
    const enumName = cIdent(`Achillea_${decl.name}`);
    const prefix = cUpperMacro(decl.name);
    if (decl.valueType === "number") {
      out.push(`typedef enum ${enumName} {`);
      for (const m of decl.members) {
        out.push(`  ${prefix}_${cUpperMacro(m.name)} = ${String(m.value)},`);
      }
      out.push(`} ${enumName};`, "");
      definedTypes.add(enumName);
    } else {
      out.push(`typedef const char *${enumName};`);
      for (const m of decl.members) {
        out.push(
          `#define ${prefix}_${cUpperMacro(m.name)} ${JSON.stringify(String(m.value))}`,
        );
      }
      out.push("");
      definedTypes.add(enumName);
    }
  }

  // Emit monomorphic concrete structs and simple aliases in topological batches:
  // structs without complex generic params get concrete ABI definitions;
  // referenced types that haven't been defined yet fall back to achillea_json_t
  // so every generated struct is complete and order-independent.
  const emitStructBlock = (
    rawName: string,
    fields: readonly IrField[],
  ): void => {
    const structName = cIdent(`Achillea_${rawName}`);
    const usedFieldNames = new Set<string>();
    out.push(`typedef struct ${structName} {`);
    if (fields.length === 0) {
      out.push("  uint8_t _reserved;");
    } else {
      for (const field of fields) {
        let fname = cFieldIdent(field.name);
        let n = 2;
        while (usedFieldNames.has(fname)) {
          fname = `${cFieldIdent(field.name)}_${n++}`;
        }
        usedFieldNames.add(fname);
        out.push(`  ${cTypeFor(field.type, definedTypes)} ${fname};`);
        if (field.optional) {
          let hasName = `has_${fname}`;
          while (usedFieldNames.has(hasName)) {
            hasName = `has_${fname}_${n++}`;
          }
          usedFieldNames.add(hasName);
          out.push(`  bool ${hasName};`);
        }
      }
    }
    out.push(`} ${structName};`, "");
    definedTypes.add(structName);
  };

  for (const decl of contract.declarations) {
    if (decl.kind === "enum") continue;
    if (decl.kind === "interface") {
      if (decl.typeParams.length > 0) {
        const aliasName = cIdent(`Achillea_${decl.name}`);
        out.push(`typedef achillea_json_t ${aliasName};`, "");
        definedTypes.add(aliasName);
        continue;
      }
      emitStructBlock(decl.name, resolveFields(decl, byName));
      continue;
    }

    // Alias
    if (decl.typeParams.length === 0 && decl.type.kind === "object") {
      emitStructBlock(decl.name, decl.type.fields);
    } else {
      const aliasName = cIdent(`Achillea_${decl.name}`);
      out.push(
        `typedef ${cTypeFor(decl.type, definedTypes)} ${aliasName};`,
        "",
      );
      definedTypes.add(aliasName);
    }
  }

  out.push("#ifdef __cplusplus", "}", "#endif", "");
  return out.join("\n");
}
