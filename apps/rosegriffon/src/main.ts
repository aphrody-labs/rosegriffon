#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * `rosegriffon` — the whole Bun side of Rose Griffon in one executable.
 *
 *   serve              everything: rg-core (Discord gateways, ranked Colyseus with the unified
 *                      API on its port, cron schedules, model-serve relay) plus the site as a
 *                      supervised child process
 *   site               the Next.js site (embedded standalone build)
 *   api                the unified Elysia API alone (API_PORT, default 8800)
 *   bot                the Discord gateway of RG_PROFIL_BOT (default rg)
 *   ranked             the Achillea ranked Colyseus server alone (RANKED_PORT)
 *   cron --run <task>  run one cron task and exit (`cron --run` lists them)
 *   achillea ...       headless Achilléa API: any `AchilleaClient` method, as a player or anonymous
 *
 * Environment: `--env-file <path>` (repeatable) or `./.env`; the process
 * environment wins. `aphrody-nie-model-serve` is reached through its URL or
 * binary path (NIE_MODEL_SERVE_*), never embedded.
 */
// Macro : la table des docs est calculée au bundle, le binaire n'embarque que le résultat.
import { docsClientAchillea } from "./achillea-docs" with { type: "macro" };
import { BUILD_VERSION } from "./embedded";
import { loadEnvFiles } from "./env";

const VERSION = BUILD_VERSION ?? "dev";
const HELP = `rosegriffon ${VERSION} — Rose Griffon self-hosted server

Usage: rosegriffon <command> [--env-file <path>]...

Commands:
  serve              site + rg-core (Discord gateways, ranked, unified API, cron) — default
  site               Next.js site only (RG_SITE_PORT/PORT, default 3100)
  api                unified Elysia API only (API_PORT, default 8800)
  bot                Discord gateway of RG_PROFIL_BOT only (default rg)
  ranked             Achillea ranked Colyseus server only
  cron --run <task>  run one cron task and exit; "cron --run" lists the tasks
  achillea list      list every Achilléa API method (resource.method + doc line)
  achillea <resource>.<method> [JSON args]...
                     call an AchilleaClient method; JSON on stdout, exit 1 if ok:false
  achillea raw <METHOD> <path> [JSON body]
                     raw request on the Achilléa API
                     achillea options: --as <discordId> (signed 5 min session, JWT_SECRET_KEY),
                     --token <jwt>, --api <url>, --out <file>, --timeout <ms>;
                     "rosegriffon achillea help" for details

Options:
  --env-file <path>  load variables from a dotenv file (repeatable; default ./.env)
  -h, --help         show this help
  -v, --version      show version
`;

const argv = loadEnvFiles(process.argv.slice(2));
const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : argv.length === 0 ? "serve" : "";
const rest = command ? argv.slice(1) : argv;

/** Gives the imported entry the argument vector it parses at module evaluation. */
function setArgs(...args: string[]): void {
  process.argv = [process.argv[0]!, process.argv[1]!, ...args];
}

// `achillea` porte ses propres options (`--as`, `--api`…) : la sous-commande les
// analyse elle-même, avant l'aide générale qui les prendrait pour inconnues.
if (command === "achillea") {
  const { executerAchillea } = await import("./achillea");
  const code = await executerAchillea(rest, {
    env: process.env,
    docs: docsClientAchillea(),
    sortie: texte => console.log(texte),
    erreur: texte => console.error(texte),
    ecrireFichier: async (chemin, octets) => {
      await Bun.write(chemin, octets);
    },
  });
  process.exit(code);
}

if (argv.includes("-h") || argv.includes("--help") ||(!command && argv.length > 0 && !argv.some(a => a === "-v" || a === "--version"))) {
  console.log(HELP);
  process.exit(0);
}
if (argv.includes("-v") || argv.includes("--version")) {
  console.log(`rosegriffon ${VERSION} (Bun ${Bun.version}+${Bun.revision.slice(0, 9)})`);
  process.exit(0);
}

switch (command) {
  case "serve": {
    const { resolveSiteDir } = await import("./site");
    const { selfCommand, supervise } = await import("./supervise");
    if (process.env.RG_SITE !== "0" && (await resolveSiteDir())) {
      const stop = supervise("site", selfCommand("site"));
      process.on("SIGTERM", stop);
      process.on("SIGINT", stop);
    } else {
      console.warn("[rosegriffon] site disabled (RG_SITE=0 or no embedded/local build)");
    }
    setArgs(...rest);
    await import("reflect-metadata");
    await import("@rosegriffon/bot/core");
    break;
  }
  case "site": {
    const { serveSite } = await import("./site");
    await serveSite();
    break;
  }
  case "api": {
    await import("reflect-metadata");
    const { startApiServer } = await import("@rosegriffon/bot/api");
    startApiServer();
    break;
  }
  case "bot": {
    setArgs("bot", ...rest);
    await import("reflect-metadata");
    await import("@rosegriffon/bot/core");
    break;
  }
  case "ranked": {
    const { demarrerRanked } = await import("@rosegriffon/bot/ranked");
    await demarrerRanked();
    break;
  }
  case "cron": {
    const { runCronCli } = await import("@rosegriffon/cron");
    await runCronCli(rest);
    break;
  }
  default:
    console.error(`rosegriffon: unknown command "${command}"\n`);
    console.log(HELP);
    process.exit(2);
}
