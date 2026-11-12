#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * First fill of /srv/rosegriffon/game/ievr on the VPS from the local Windows Steam install,
 * over the WireGuard mesh (fr1 = 10.200.77.1, see infra/mesh-vn in the monorepo), falling back
 * to the public SSH address when the tunnel is down. After the copy, `steam-depot verify` on the
 * VPS checks every file against the Steam manifest and fetches only what differs.
 *
 * Transport: rclone over SFTP (the Windows host has no rsync). Binary safe (no shell pipe),
 * skips files whose size and mtime already match, retries, and keeps going after interruption:
 * re-running resumes at file granularity; a half-written file is detected by size and resent.
 *
 *   bun infra/scripts/push-ievr-install.ts [--dry-run] [--transfers 8] [--hash]
 *   bun infra/scripts/push-ievr-install.ts --watch [--interval 300]   (scheduled task: re-sync on buildid change)
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const APP_ID = "2799860";
const REMOTE_DIR =
  process.env.NIE_REMOTE_GAME_DIR ?? "/srv/rosegriffon/game/ievr";
const TUNNEL_HOST = process.env.NIE_TUNNEL_HOST ?? "10.200.77.1";
const PUBLIC_HOST = process.env.NIE_PUBLIC_HOST ?? "51.77.147.152";
const SSH_USER = process.env.NIE_SSH_USER ?? "ubuntu";

/** Locates the install the same way bun-steam `install` discovery does: libraryfolders.vdf + appmanifest. */
function findInstall(): string {
  if (process.env.NIE_LOCAL_GAME_DIR) return process.env.NIE_LOCAL_GAME_DIR;
  const steam = process.env.STEAM_ROOT ?? "C:\\Program Files (x86)\\Steam";
  const vdf = join(steam, "steamapps", "libraryfolders.vdf");
  const libs = [steam];
  if (existsSync(vdf)) {
    for (const m of require("node:fs")
      .readFileSync(vdf, "utf8")
      .matchAll(/"path"\s+"([^"]+)"/g)) {
      libs.push(m[1].replace(/\\\\/g, "\\"));
    }
  }
  for (const lib of libs) {
    const acf = join(lib, "steamapps", `appmanifest_${APP_ID}.acf`);
    if (!existsSync(acf)) continue;
    const dir = /"installdir"\s+"([^"]+)"/.exec(
      require("node:fs").readFileSync(acf, "utf8"),
    )?.[1];
    if (dir) return join(lib, "steamapps", "common", dir);
  }
  throw new Error(
    `appmanifest_${APP_ID}.acf not found; set NIE_LOCAL_GAME_DIR`,
  );
}

async function reachable(host: string): Promise<boolean> {
  try {
    const s = await Bun.connect({
      hostname: host,
      port: 22,
      socket: {
        data() {},
        open(sock) {
          sock.end();
        },
      },
    });
    s.end();
    return true;
  } catch {
    return false;
  }
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dryRun = flag("--dry-run");
const transfers = value("--transfers", "8");
const local = findInstall();
const acf = join(local, "..", "..", `appmanifest_${APP_ID}.acf`);
const key =
  process.env.NIE_SSH_KEY ??
  join(
    process.env.USERPROFILE ?? process.env.HOME ?? "",
    ".ssh",
    "id_ed25519_vn",
  );

/** Build id from the local appmanifest: the Windows Steam client is the source of updates. */
function buildId(): string {
  try {
    return (
      /"buildid"\s+"(\d+)"/.exec(
        require("node:fs").readFileSync(acf, "utf8"),
      )?.[1] ?? ""
    );
  } catch {
    return "";
  }
}

async function rclone(sub: string[], host: string): Promise<number> {
  const cmd = [
    "rclone",
    ...sub,
    `--sftp-host=${host}`,
    `--sftp-user=${SSH_USER}`,
    `--sftp-key-file=${key}`,
    "--checkers",
    "16",
    "--retries",
    "10",
    "--low-level-retries",
    "20",
    "--sftp-concurrency",
    "64",
    "--sftp-chunk-size",
    "255k",
    "--buffer-size",
    "64M",
    "--exclude",
    "steam_appid.txt",
    "--stats-one-line",
    "--stats",
    "30s",
    ...(dryRun ? ["--dry-run"] : []),
  ];
  return Bun.spawn(cmd, { stdio: ["inherit", "inherit", "inherit"] }).exited;
}

/**
 * Copies the changed files, then checks the remote tree against the local one without any
 * Steam login: sizes by default, SHA-1 of every file with --hash (rclone runs sha1sum remotely).
 * Writes `.ievr-buildid` on the remote side once the tree matches.
 */
async function syncOnce(): Promise<number> {
  const host = (await reachable(TUNNEL_HOST)) ? TUNNEL_HOST : PUBLIC_HOST;
  const id = buildId();
  console.log(
    `buildid=${id || "?"} source=${local} target=${SSH_USER}@${host}:${REMOTE_DIR} (${host === TUNNEL_HOST ? "wireguard tunnel" : "public ssh, tunnel down"})`,
  );
  const remote = `:sftp:${REMOTE_DIR}`;
  let code = await rclone(
    ["copy", local, remote, "--transfers", transfers],
    host,
  );
  if (code !== 0 || dryRun) return code;
  code = await rclone(
    [
      "check",
      local,
      remote,
      "--one-way",
      ...(flag("--hash") ? [] : ["--size-only"]),
    ],
    host,
  );
  if (code !== 0) return code;
  const marker = join(require("node:os").tmpdir(), ".ievr-buildid");
  await Bun.write(marker, `${id}\n`);
  return rclone(["copyto", marker, `${remote}/.ievr-buildid`], host);
}

if (!flag("--watch")) process.exit(await syncOnce());

// Watch mode: re-sync whenever the local Steam client changes the build id.
const every = Number(value("--interval", "300")) * 1000;
let last = flag("--force") ? "" : (process.env.NIE_LAST_BUILDID ?? "");
for (;;) {
  const id = buildId();
  if (id && id !== last) {
    const code = await syncOnce();
    if (code === 0) last = id;
    else console.error(`sync failed (exit ${code}); retry in ${every / 1000}s`);
  }
  await Bun.sleep(every);
}
