#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * One-click Steam login for the storage host (`just steam-login`).
 *
 * The account name comes from the Windows Steam client (config/loginusers.vdf, most recent user;
 * the name only, never a credential). The password and the Steam Guard e-mail code are typed once
 * into steam-depot's hidden prompt, which runs on the storage host over `ssh -t`: they are never
 * echoed, logged, or stored; only the resulting refresh token is kept, in the host token store
 * (0600). Later `update` runs reuse that token unattended.
 *
 *   bun scripts/steam-login.ts [--force] [--qr] [--user <name>]
 *     --force  log in again even if a token is stored
 *     --qr     approve a QR code from the Steam mobile app instead (shown in a Chrome window)
 */

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadInfra, resolveHost } from "../packages/rg-config/infra.ts";

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const STEAM_DIR = process.env.STEAM_DIR ?? "C:/Program Files (x86)/Steam";
const CHROME =
  process.env.RG_CHROME ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const host = resolveHost(loadInfra(), "storage", process.env);
const compose = `cd ${host.stack_dir} && docker compose --profile tools`;

/** Most recent account name of the local Steam client. */
function localAccount(): string | undefined {
  try {
    const vdf = readFileSync(`${STEAM_DIR}/config/loginusers.vdf`, "utf8");
    const users = [...vdf.matchAll(/"\d{17}"\s*\{([^}]*)\}/g)].map(
      (m) => m[1]!,
    );
    const pick = users.find((u) => /"MostRecent"\s*"1"/.test(u)) ?? users[0];
    return pick ? /"AccountName"\s*"([^"]+)"/.exec(pick)?.[1] : undefined;
  } catch {
    return undefined;
  }
}

async function ssh(cmd: string): Promise<{ code: number; out: string }> {
  const p = Bun.spawn(["ssh", "-o", "BatchMode=yes", "-n", host.ssh, cmd], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const out = await new Response(p.stdout).text();
  return { code: await p.exited, out };
}

if (!flag("force")) {
  const s = await ssh(`${compose} run --rm -T steam-depot auth status`);
  if (s.code === 0 && /account=(?!-)/.test(s.out)) {
    console.log(`steam: already logged in on ${host.key} (${s.out.trim()})`);
    process.exit(0);
  }
}

// The prod checkout is a detached deploy ref: build the pinned steam-depot revision without moving it.
const dockerfile = await Bun.file(
  new URL("../infra/docker/steam-depot/Dockerfile", import.meta.url),
).text();
const rev = /ARG STEAM_DEPOT_REV=([0-9a-f]{40})/.exec(dockerfile)?.[1];
if (!rev)
  throw new Error("STEAM_DEPOT_REV not found in the steam-depot Dockerfile");
console.log(`steam: preparing steam-depot ${rev.slice(0, 7)} on ${host.key}`);
const built = await ssh(
  `${compose} build -q --build-arg STEAM_DEPOT_REV=${rev} steam-depot`,
);
if (built.code !== 0) process.exit(built.code);

if (!flag("qr")) {
  const user = opt("user") ?? localAccount();
  if (!user) throw new Error("no Steam account found; pass --user <name>");
  console.log(
    `steam: logging in ${user} on ${host.key} (password and code stay hidden)`,
  );
  const p = Bun.spawn(
    ["ssh", "-t", host.ssh, `${compose} run --rm steam-depot login ${user}`],
    { stdin: "inherit", stdout: "inherit", stderr: "inherit" },
  );
  process.exit(await p.exited);
}

const page = join(tmpdir(), `rg-steam-qr-${process.pid}.html`);
process.on("exit", () => rmSync(page, { force: true }));
// A Steam QR challenge expires after a few minutes: issue a new one until approval or the deadline
// (RG_STEAM_QR_MINUTES, default 30). The page reloads itself, so one Chrome window follows every code.
const deadline =
  Date.now() + Number(process.env.RG_STEAM_QR_MINUTES ?? 30) * 60_000;
let opened = false;
let code = 1;
while (Date.now() < deadline) {
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
  let stored = false;
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
          `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>Steam - Rose Griffon</title>` +
            `<body style="margin:0;display:grid;place-items:center;height:100vh;background:#171a21;color:#c7d5e0;font:16px system-ui">` +
            `<div style="text-align:center"><div style="background:#fff;padding:16px;border-radius:8px">${line.slice(4)}</div>` +
            `<p>Steam app &gt; Steam Guard &gt; scan this code.</p></div>`,
        );
        if (!opened) {
          Bun.spawn([CHROME, `--app=file:///${page.replaceAll("\\", "/")}`], {
            stdout: "ignore",
            stderr: "ignore",
          });
          opened = true;
          console.log("steam: QR shown in Chrome, waiting for approval");
        } else console.log("steam: QR renewed");
      } else if (line.startsWith("store=")) {
        stored = /account=(?!-)\S+.*expired=false/.test(line);
        console.log(`steam: ${line}`);
      }
    }
  }
  const err = await new Response(proc.stderr).text();
  code = await proc.exited;
  if (code === 0 && stored) break;
  if (!/Expired/i.test(err)) {
    process.stderr.write(err);
    break;
  }
}
process.exit(code);
