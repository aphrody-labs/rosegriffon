/**
 * Orchestration : extraction puis émission de toutes les cibles.
 *
 * Volontairement séparé de la CLI pour être testable sans toucher au disque.
 */

import { emitC23 } from "./emit-c23";
import { emitJsonSchema } from "./emit-json-schema";
import { emitKotlin } from "./emit-kotlin";
import { emitOpenApi } from "./emit-openapi";
import { emitRust } from "./emit-rust";
import { emitSwift } from "./emit-swift";
import { extractContract, type ExtractOptions } from "./extract";
import type { IrContract } from "./ir";

export interface ContractTarget {
  /** Nom de fichier produit dans `generated/`. */
  file: string;
  language: string;
  render: (contract: IrContract) => string;
}

export const CONTRACT_TARGETS: readonly ContractTarget[] = [
  {
    file: "achillea.schema.json",
    language: "JSON Schema 2020-12",
    render: (contract) =>
      `${JSON.stringify(emitJsonSchema(contract), null, 2)}\n`,
  },
  {
    file: "achillea.openapi.json",
    language: "OpenAPI 3.2.1",
    render: (contract) =>
      `${JSON.stringify(emitOpenApi(contract), null, 2)}\n`,
  },
  { file: "achillea.rs", language: "Rust (serde)", render: emitRust },
  { file: "achillea.h", language: "Pure C23 (LLVM ABI)", render: emitC23 },
  { file: "Achillea.swift", language: "Swift (Codable)", render: emitSwift },
  {
    file: "Achillea.kt",
    language: "Kotlin (kotlinx.serialization)",
    render: emitKotlin,
  },
];

export interface GenerateResult {
  contract: IrContract;
  files: Array<{ file: string; language: string; content: string }>;
}

export function generateContract(options: ExtractOptions): GenerateResult {
  const contract = extractContract(options);
  return {
    contract,
    files: CONTRACT_TARGETS.map((target) => ({
      file: target.file,
      language: target.language,
      content: target.render(contract),
    })),
  };
}
