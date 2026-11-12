#!/usr/bin/env bun
// steam-inspect: inspect the local Steam install. Bun built-ins only.
// Usage:
//   bun run scripts/steam-inspect.ts root
//   bun run scripts/steam-inspect.ts libraries
//   bun run scripts/steam-inspect.ts apps [filter]
//   bun run scripts/steam-inspect.ts app <appid>          (ACF + depots + state)
//   bun run scripts/steam-inspect.ts paths <appid> [accountid]
//   bun run scripts/steam-inspect.ts appinfo <appid>      (appcache/appinfo.vdf entry)
//   bun run scripts/steam-inspect.ts vdf <file>           (text or binary VDF to JSON)
// Global flag: --steam-path <dir> (else $STEAM_PATH, registry, usual paths). Output is JSON.

import { join } from "node:path";
import {
  appPaths,
  decodeStateFlags,
  findSteamRoot,
  isSecretFile,
  listApps,
  listLibraries,
  parseBinaryVdf,
  parseVdf,
  readAppInfo,
} from "../lib/steam.ts";

const argv = Bun.argv.slice(2);
const sp = argv.indexOf("--steam-path");
const override = sp >= 0 ? argv.splice(sp, 2)[1] : undefined;
const [cmd = "apps", a1, a2] = argv;
const out = (v: unknown): void => console.log(JSON.stringify(v, null, 2));
const root = override ?? findSteamRoot();
if (!root) {
  console.error("Steam install not found (use --steam-path or STEAM_PATH)");
  process.exit(2);
}

const appid = (): number => {
  const n = Number(a1);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`${cmd} needs a numeric appid`);
    process.exit(2);
  }
  return n;
};

switch (cmd) {
  case "root":
    out({ steamRoot: root });
    break;
  case "libraries":
    out(await listLibraries(root));
    break;
  case "apps": {
    const f = (a1 ?? "").toLowerCase();
    const apps = (await listApps(root)).filter(
      (x) => !f || String(x.appid) === f || x.name.toLowerCase().includes(f),
    );
    out(
      apps.map((x) => ({
        appid: x.appid,
        name: x.name,
        buildid: x.buildid,
        sizeGB: x.sizeOnDisk ? +(x.sizeOnDisk / 1e9).toFixed(2) : null,
        state: decodeStateFlags(x.stateFlags),
        library: x.library,
      })),
    );
    break;
  }
  case "app": {
    const id = appid();
    const app = (await listApps(root)).find((x) => x.appid === id);
    if (!app) {
      console.error(`appid ${id} is not installed under ${root}`);
      process.exit(1);
    }
    out({
      ...app,
      state: decodeStateFlags(app.stateFlags),
      acf: parseVdf(await Bun.file(app.manifest).text()),
    });
    break;
  }
  case "paths":
    out(await appPaths(root, appid(), a2 ? Number(a2) : undefined));
    break;
  case "appinfo": {
    const buf = new Uint8Array(
      await Bun.file(join(root, "appcache", "appinfo.vdf")).arrayBuffer(),
    );
    out(readAppInfo(buf, appid()));
    break;
  }
  case "vdf": {
    if (!a1) {
      console.error("vdf needs a file path");
      process.exit(2);
    }
    const base = a1.replace(/\\/g, "/").split("/").pop()!.toLowerCase();
    if (isSecretFile(a1)) {
      console.error(`${base} holds credentials; not read`);
      process.exit(1);
    }
    const buf = new Uint8Array(await Bun.file(a1).arrayBuffer());
    out(
      buf.subarray(0, 512).includes(0)
        ? parseBinaryVdf(buf).value
        : parseVdf(new TextDecoder().decode(buf)),
    );
    break;
  }
  default:
    console.error(`unknown command ${cmd}`);
    process.exit(2);
}
