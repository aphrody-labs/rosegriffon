#!/usr/bin/env bun
/**
 * Complete CLI exposing the full @rosegriffon/achillea-client v1 surface.
 *
 * Usage:
 *   achillea [--url <baseUrl>] [--token <bearer>] <resource> <action> [args...]
 *   achillea resources
 *   achillea <resource> --help
 *   achillea health
 */
import { AchilleaClient, type AchilleaFetch } from "./v1";
import { z } from "zod";

export const ACHILLEA_DEFAULT_BASE_URL =
  "https://api.rosegriffon.fr/v1/achillea";

export type AchilleaResourceName =
  | "admin"
  | "auth"
  | "blacklist"
  | "casts"
  | "clanTeams"
  | "clans"
  | "guilds"
  | "interclans"
  | "leagues"
  | "licenses"
  | "notifications"
  | "organizations"
  | "playerNotes"
  | "ranked"
  | "sanctions"
  | "stats"
  | "tournaments"
  | "users"
  | "wallet";

const RESOURCE_NAMES: readonly AchilleaResourceName[] = [
  "admin",
  "auth",
  "blacklist",
  "casts",
  "clanTeams",
  "clans",
  "guilds",
  "interclans",
  "leagues",
  "licenses",
  "notifications",
  "organizations",
  "playerNotes",
  "ranked",
  "sanctions",
  "stats",
  "tournaments",
  "users",
  "wallet",
];

function listResourceActions(resource: object): string[] {
  const names = new Set<string>();
  let proto: object | null = Object.getPrototypeOf(resource);
  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === "constructor") continue;
      const val = (resource as Record<string, unknown>)[key];
      if (typeof val === "function") names.add(key);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return [...names].toSorted();
}

export function describeAchilleaSurface(
  client = new AchilleaClient({ baseUrl: ACHILLEA_DEFAULT_BASE_URL }),
): Record<AchilleaResourceName, string[]> {
  const surface = {} as Record<AchilleaResourceName, string[]>;
  for (const name of RESOURCE_NAMES) {
    surface[name] = listResourceActions(client[name]);
  }
  return surface;
}

export function parseCliValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/u.test(raw)) {
    const num = Number(raw);
    if (Number.isSafeInteger(num) || raw.includes(".")) return num;
  }
  if (
    (raw.startsWith("{") && raw.endsWith("}")) ||
    (raw.startsWith("[") && raw.endsWith("]"))
  ) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export interface ParsedCliArgs {
  baseUrl: string;
  token?: string;
  help: boolean;
  positionals: string[];
}

export function parseCliArgs(
  argv: readonly string[],
  env: Record<string, string | undefined> = process.env,
): ParsedCliArgs {
  let baseUrl =
    env.ACHILLEA_API_URL ?? env.RG_API_URL ?? ACHILLEA_DEFAULT_BASE_URL;
  let token = env.ACHILLEA_TOKEN ?? env.ACHILLEA_API_TOKEN;
  let help = false;
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--url" && argv[i + 1]) {
      baseUrl = argv[++i]!;
    } else if (arg.startsWith("--url=")) {
      baseUrl = arg.slice(6);
    } else if (arg === "--token" && argv[i + 1]) {
      token = argv[++i]!;
    } else if (arg.startsWith("--token=")) {
      token = arg.slice(8);
    } else {
      positionals.push(arg);
    }
  }

  return { baseUrl, token, help, positionals };
}

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  fetch?: AchilleaFetch;
  env?: Record<string, string | undefined>;
}

export async function runAchilleaCli(
  argv: readonly string[],
  io: CliIo = {
    stdout: (text) => process.stdout.write(`${text}\n`),
    stderr: (text) => process.stderr.write(`${text}\n`),
  },
): Promise<number> {
  const parsed = parseCliArgs(argv, io.env);
  const client = new AchilleaClient({
    baseUrl: parsed.baseUrl,
    ...(parsed.token ? { getAuthToken: () => parsed.token! } : {}),
    ...(io.fetch ? { fetch: io.fetch } : {}),
  });
  const surface = describeAchilleaSurface(client);

  if (
    parsed.positionals.length === 0 ||
    (parsed.help && parsed.positionals.length === 0)
  ) {
    io.stdout(
      JSON.stringify(
        {
          usage:
            "achillea [--url <url>] [--token <bearer>] <resource> <action> [args...]",
          baseUrl: parsed.baseUrl,
          resources: surface,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const [resourceArg, actionArg, ...rest] = parsed.positionals;

  if (resourceArg === "resources") {
    io.stdout(JSON.stringify(surface, null, 2));
    return 0;
  }

  if (resourceArg === "health") {
    const res = await client.http.get("/health", z.unknown());
    io.stdout(JSON.stringify(res, null, 2));
    return res.ok ? 0 : 1;
  }

  if (!RESOURCE_NAMES.includes(resourceArg as AchilleaResourceName)) {
    io.stderr(
      `Unknown Achillea resource "${resourceArg}". Available: ${RESOURCE_NAMES.join(", ")}`,
    );
    return 2;
  }

  const resourceName = resourceArg as AchilleaResourceName;
  const actions = surface[resourceName];

  if (!actionArg || parsed.help) {
    io.stdout(JSON.stringify({ resource: resourceName, actions }, null, 2));
    return 0;
  }

  if (!actions.includes(actionArg)) {
    io.stderr(
      `Unknown action "${actionArg}" on "${resourceName}". Available: ${actions.join(", ")}`,
    );
    return 2;
  }

  const target = client[resourceName] as unknown as Record<
    string,
    (...args: unknown[]) => Promise<{ ok: boolean }>
  >;
  const fn = target[actionArg]!;
  const callArgs = rest.map(parseCliValue);
  const result = await fn.apply(target, callArgs);
  io.stdout(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

if (import.meta.main) {
  process.exitCode = await runAchilleaCli(Bun.argv.slice(2));
}
