#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * One-click Steam login for the storage host (`just steam-login`).
 *
 * Runs `steam-depot login-qr` on the storage role host (infra/hosts.toml), shows the Steam QR
 * challenge in a Chrome app window, and exits once the Steam mobile app approved it. The refresh
 * token is written by steam-depot straight into the host token store (0600): no password is
 * typed, and nothing secret passes through this machine or its terminal. The QR page is a temp
 * file deleted on exit.
 *
 *   bun scripts/steam-login.ts [--force]     --force: log in again even if a token is stored
 */

import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadInfra, resolveHost } from "../packages/rg-config/infra.ts";

const CHROME =
  process.env.RG_CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const host = resolveHost(loadInfra(), "storage", process.env);
const compose = `cd ${host.stack_dir} && docker compose --profile tools`;

async function ssh(cmd: string): Promise<{ code: number; out: string }> {
  const p = Bun.spawn(["ssh", "-o", "BatchMode=yes", "-n", host.ssh, cmd], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const out = await new Response(p.stdout).text();
  return { code: await p.exited, out };
}

if (!process.argv.includes("--force")) {
  const s = await ssh(`${compose} run --rm -T steam-depot auth status`);
  if (s.code === 0 && /account=(?!-)/.test(s.out)) {
    console.log(`steam: already logged in on ${host.key} (${s.out.trim()})`);
    process.exit(0);
  }
}

console.log(`steam: preparing steam-depot on ${host.key}`);
await ssh(
  `cd ${host.stack_dir} && git pull -q --ff-only && docker compose --profile tools build -q steam-depot`,
);

const page = join(tmpdir(), `rg-steam-qr-${process.pid}.html`);
const cleanup = () => rmSync(page, { force: true });
process.on("exit", cleanup);

const proc = Bun.spawn(
  [
    "ssh",
    "-o",
    "BatchMode=yes",
    "-n",
    host.ssh,
    `${compose} run --rm -T steam-depot login-qr`,
  ],
  { stdout: "pipe", stderr: "pipe" },
);

let buf = "";
const decoder = new TextDecoder();
for await (const chunk of proc.stdout) {
  buf += decoder.decode(chunk);
  let nl: number;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl);
    buf = buf.slice(nl + 1);
    if (line.startsWith("svg ")) {
      writeFileSync(
        page,
        `<!doctype html><meta charset="utf-8"><title>Steam - Rose Griffon</title>` +
          `<body style="margin:0;display:grid;place-items:center;height:100vh;background:#171a21;color:#c7d5e0;font:16px system-ui">` +
          `<div style="text-align:center"><div style="background:#fff;padding:16px;border-radius:8px">${line.slice(4)}</div>` +
          `<p>Steam app &gt; Steam Guard &gt; scan this code. The window can be closed afterwards.</p></div>`,
      );
      Bun.spawn(
        [CHROME, `--app=file:///${page.replaceAll("\\", "/")}`, "--new-window"],
        {
          stdout: "ignore",
          stderr: "ignore",
        },
      );
      console.log(
        "steam: QR shown in Chrome, waiting for approval in the Steam app",
      );
    } else if (line.startsWith("store=")) {
      console.log(`steam: ${line}`);
    }
  }
}
const code = await proc.exited;
const err =
  (await new Response(proc.stderr).text()).trim().split("\n").at(-1) ?? "";
cleanup();
console.log(
  code === 0
    ? `steam: login ok on ${host.key}`
    : `steam: login failed (${err})`,
);
process.exit(code);
