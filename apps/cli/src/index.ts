#!/usr/bin/env bun
/**
 * Unified CLI for Rose Griffon Monorepo
 * Subcommands:
 *  - inagle: Universal Game Data CLI (IEVR)
 *  - azalee: Azalee game database & contract toolkit
 *  - formats / console: yolo-console-formats ROM/binary inspection
 *  - homebrew: DS/3DS homebrew build runner
 *  - pipeline / shenron: Shenron OCR, RAG, Translation & Ingest pipeline
 *  - contract: Achillea contract generator
 */

import { parseArgs } from "node:util";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";

const VERSION = "1.4.8";

function showHelp() {
  console.log(`
Rose Griffon Unified CLI (v${VERSION})

Usage:
  rg <command> [options...]
  rosegriffon <command> [options...]

Available Commands:
  inagle        Inazuma Eleven Victory Road Data CLI & Zukan query
  azalee        Azalee game DB, sync, audit, rules, and contracts
  formats       Console formats inspection, disasm, and identification
  homebrew      Homebrew DS / 3DS toolchain runner
  pipeline      Shenron ML / OCR / RAG / Ingest pipeline
  contract      Achillea cross-language contract generator

Global Options:
  --help, -h     Show this help message
  --version, -v  Show CLI version
`);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help" || argv[0] === "help") {
    showHelp();
    process.exit(0);
  }

  if (argv[0] === "-v" || argv[0] === "--version" || argv[0] === "version") {
    console.log(`@rosegriffon/cli v${VERSION}`);
    process.exit(0);
  }

  const [command, ...subArgs] = argv;

  switch (command) {
    case "inagle": {
      // Delegate to inagle CLI entry
      const inagleEntry = resolve(import.meta.dir, "../../../packages/inagle/src/cli.ts");
      const proc = Bun.spawn([process.execPath, inagleEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    case "azalee": {
      // Delegate to azalee CLI entry
      const azaleeEntry = resolve(import.meta.dir, "../../../packages/azalee/src/cli.ts");
      const proc = Bun.spawn([process.execPath, azaleeEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    case "formats":
    case "console": {
      const { runFormats } = await import("@aphrody/bun-engine");
      const exitCode = await runFormats(subArgs);
      process.exit(exitCode);
      break;
    }

    case "homebrew": {
      const homebrewEntry = resolve(import.meta.dir, "../../../packages/iecode-homebrew/src/cli.ts");
      const proc = Bun.spawn([process.execPath, homebrewEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    case "pipeline":
    case "shenron": {
      const pipelineEntry = resolve(import.meta.dir, "../../../packages/shenron-pipeline/src/cli.ts");
      const proc = Bun.spawn([process.execPath, pipelineEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    case "contract": {
      const contractEntry = resolve(import.meta.dir, "../../../packages/achillea-contract/src/cli.ts");
      const proc = Bun.spawn([process.execPath, contractEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    case "achillea":
    case "server": {
      const serverEntry = resolve(import.meta.dir, "../../../apps/rosegriffon/src/main.ts");
      const proc = Bun.spawn([process.execPath, serverEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    default:
      console.error(`Unknown command: "${command}". Run "rg --help" for available commands.`);
      process.exit(1);
  }
}

await main().catch((err) => {
  console.error("CLI error:", err);
  process.exit(1);
});
