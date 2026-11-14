#!/usr/bin/env bun
/**
 * `ie` / `rg` / `rosegriffon` — Unified Bun CLI for Inazuma Eleven & Rose Griffon.
 * Consolidates every pure Bun CLI across the entire monorepo:
 *  - inagle: Universal Game Data CLI (IEVR) & Zukan query
 *  - azalee: Azalee game DB, sync, audit, rules, and contracts
 *  - formats / console: yolo-console-formats ROM/binary inspection & disasm
 *  - homebrew: DS/3DS homebrew toolchain runner
 *  - pipeline / shenron: Shenron ML / OCR / RAG / Ingest pipeline
 *  - contract: Achillea cross-language contract generator
 *  - achillea / server: Rose Griffon self-hosted server & AchilleaClient runner
 */

import { resolve } from "node:path";

const VERSION = "1.4.8";

/** Verbs owned by infra/ops/cli.ts (hosts by role, uniform service verbs). */
const OPS_VERBS = new Set([
  "host",
  "ssh",
  "env",
  "services",
  "render",
  "build",
  "deploy",
  "verify",
  "rollback",
  "migrate",
]);

function showHelp() {
  console.log(`
Inazuma Eleven & Rose Griffon Unified Bun CLI (v${VERSION})

Usage:
  ie <command> [options...]
  rg <command> [options...]
  rosegriffon <command> [options...]

Available Commands:
  inagle        Inazuma Eleven Victory Road Data CLI & Zukan query
  azalee        Azalee game DB, sync, audit, rules, and contracts
  formats       Console formats inspection, disasm, and identification
  homebrew      Homebrew DS / 3DS toolchain runner
  contract      Achillea cross-language contract generator
  achillea      Achilléa headless API client runner (all 19 v1 resources & raw)
  nie           NIE Rust CLI (detect, match, save-edit, capture-menus, memory-dump)
  server        Rose Griffon self-hosted server supervisor (serve, site, api, bot, ranked, cron)

Ops (infra/ops/cli.ts, roles from infra/hosts.toml, services from infra/services.toml):
  host <role> [field] | ssh <role> [-- cmd] | env <role> | services | render [--check]
  build | deploy | verify <service|all> [--role R] | rollback <tag> [service]
  migrate <service> --to <role|host> [--from <role|host>] [--apply]

Global Options:
  --help, -h     Show this help message
  --version, -v  Show CLI version
`);
}

async function main() {
  const argv = process.argv.slice(2);

  if (
    argv.length === 0 ||
    argv[0] === "-h" ||
    argv[0] === "--help" ||
    argv[0] === "help"
  ) {
    showHelp();
    process.exit(0);
  }

  if (argv[0] === "-v" || argv[0] === "--version" || argv[0] === "version") {
    console.log(`ie (Rose Griffon Unified Bun CLI) v${VERSION}`);
    process.exit(0);
  }

  const [command, ...subArgs] = argv;

  if (OPS_VERBS.has(command!)) {
    const opsEntry = resolve(import.meta.dir, "../../../infra/ops/cli.ts");
    const proc = Bun.spawn([process.execPath, opsEntry, command!, ...subArgs], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exit(await proc.exited);
  }

  switch (command) {
    case "inagle": {
      const inagleEntry = resolve(
        import.meta.dir,
        "../../../packages/inagle/src/cli.ts",
      );
      const proc = Bun.spawn([process.execPath, inagleEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    case "azalee": {
      const azaleeEntry = resolve(
        import.meta.dir,
        "../../../packages/azalee/src/cli.ts",
      );
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
      const formatsEntry = resolve(
        import.meta.dir,
        "../../../packages/bun-engine-formats/src/cli.ts",
      );
      const proc = Bun.spawn([process.execPath, formatsEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    case "homebrew": {
      const homebrewEntry = resolve(
        import.meta.dir,
        "../../../packages/iecode-homebrew/src/cli.ts",
      );
      const proc = Bun.spawn([process.execPath, homebrewEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    case "contract": {
      const contractEntry = resolve(
        import.meta.dir,
        "../../../packages/achillea-contract/src/cli.ts",
      );
      const proc = Bun.spawn([process.execPath, contractEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    case "achillea": {
      const first = subArgs[0];
      // Dot-notation (`ranked.leaderboard`), `raw`, `list`, or `help` -> apps/rosegriffon server achillea runner;
      // space-separated (`ranked leaderboard`, `resources`, `health`) -> @rosegriffon/achillea-client CLI.
      const useServerRunner =
        first === "list" ||
        first === "raw" ||
        first === "help" ||
        (first?.includes(".") ?? false);
      const achilleaEntry = resolve(
        import.meta.dir,
        useServerRunner
          ? "../../../apps/rosegriffon/src/main.ts"
          : "../../../packages/achillea-client/src/cli.ts",
      );
      const args = useServerRunner ? ["achillea", ...subArgs] : subArgs;
      const proc = Bun.spawn([process.execPath, achilleaEntry, ...args], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    case "nie": {
      const proc = Bun.spawn(
        ["cargo", "run", "--quiet", "-p", "aphrody-nie-cli", "--", ...subArgs],
        {
          cwd: resolve(import.meta.dir, "../../.."),
          env: { ...process.env, RUSTC_WRAPPER: "" },
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        },
      );
      process.exit(await proc.exited);
      break;
    }

    case "serve":
    case "site":
    case "api":
    case "bot":
    case "ranked":
    case "cron": {
      const serverEntry = resolve(
        import.meta.dir,
        "../../../apps/rosegriffon/src/main.ts",
      );
      const proc = Bun.spawn(
        [process.execPath, serverEntry, command!, ...subArgs],
        {
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        },
      );
      process.exit(await proc.exited);
      break;
    }

    case "server": {
      const serverEntry = resolve(
        import.meta.dir,
        "../../../apps/rosegriffon/src/main.ts",
      );
      const proc = Bun.spawn([process.execPath, serverEntry, ...subArgs], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
      break;
    }

    default:
      console.error(
        `Unknown command: "${command}". Run "ie --help" for available commands.`,
      );
      process.exit(1);
  }
}

await main().catch((err) => {
  console.error("CLI error:", err);
  process.exit(1);
});
