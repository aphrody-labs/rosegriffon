// SPDX-License-Identifier: Apache-2.0
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Parses `KEY=value` lines (optional `export`, quotes, `#` comments). */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2]!;
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replaceAll("\n", "\n").replaceAll('\\"', '"');
    } else {
      const comment = value.search(/\s#/);
      if (comment >= 0) value = value.slice(0, comment).trimEnd();
    }
    out[match[1]!] = value;
  }
  return out;
}

/**
 * Loads `--env-file <path>` arguments (repeatable, later files win) or, without
 * any, `./.env` when present. Variables already set in the environment win.
 * Returns the remaining arguments.
 */
export function loadEnvFiles(args: string[]): string[] {
  const files: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--env-file") files.push(args[++i] ?? "");
    else if (arg.startsWith("--env-file=")) files.push(arg.slice("--env-file=".length));
    else rest.push(arg);
  }
  if (files.length === 0 && existsSync(".env")) files.push(".env");
  const merged: Record<string, string> = {};
  for (const file of files) {
    const path = resolve(file);
    if (!file || !existsSync(path)) throw new Error(`env file not found: ${file || "(empty)"}`);
    Object.assign(merged, parseEnv(readFileSync(path, "utf8")));
  }
  for (const [key, value] of Object.entries(merged)) process.env[key] ??= value;
  return rest;
}
