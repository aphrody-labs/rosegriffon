// Shared Steam helpers for the steam plugin: install discovery, text and binary
// KeyValues (VDF) parsing, SteamID conversion and link builders. Bun built-ins only.
//
// Formats follow third_party/valvekeyvalue (KV1 text and binary),
// steamlocate-rs (library discovery) and crates/steam-depot/src/{vdf,install}.rs.

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type Vdf = { [key: string]: string | Vdf };

// ---------------------------------------------------------------- text VDF

/** Parse text KeyValues (VDF/ACF). Duplicate keys keep the last value; comments and
 * conditionals ([$WIN32]) are skipped. */
export function parseVdf(input: string): Vdf {
  let i = 0;
  const n = input.length;
  const skip = (): void => {
    while (i < n) {
      const c = input[i];
      if (c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\uFEFF")
        i++;
      else if (c === "/" && input[i + 1] === "/") {
        while (i < n && input[i] !== "\n") i++;
      } else if (c === "[") {
        while (i < n && input[i] !== "]") i++;
        i++;
      } else break;
    }
  };
  const token = (): string | null => {
    skip();
    if (i >= n) return null;
    const c = input[i];
    if (c === "{" || c === "}") {
      i++;
      return c;
    }
    if (c === '"') {
      i++;
      let out = "";
      while (i < n && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < n) {
          const e = input[i + 1];
          out += e === "n" ? "\n" : e === "t" ? "\t" : e === "r" ? "\r" : e;
          i += 2;
        } else out += input[i++];
      }
      i++;
      return out;
    }
    let out = "";
    while (i < n && !/[\s{}"]/.test(input[i] ?? "")) out += input[i++];
    return out;
  };
  const block = (): Vdf => {
    const obj: Vdf = {};
    for (;;) {
      const k = token();
      if (k === null || k === "}") return obj;
      const v = token();
      if (v === null) return obj;
      obj[k] = v === "{" ? block() : v;
    }
  };
  return block();
}

/** Case-insensitive key lookup, as the Steam client treats KeyValues keys. */
export function vget(
  obj: Vdf | string | undefined,
  ...path: string[]
): Vdf | string | undefined {
  let cur: Vdf | string | undefined = obj;
  for (const p of path) {
    if (!cur || typeof cur === "string") return undefined;
    const lower = p.toLowerCase();
    const key = Object.keys(cur).find((k) => k.toLowerCase() === lower);
    cur = key === undefined ? undefined : cur[key];
  }
  return cur;
}

// ---------------------------------------------------------------- binary VDF

/** Parse binary KeyValues (shortcuts.vdf, appinfo sections). Type bytes per
 * valvekeyvalue: 0 none(table), 1 string, 2 int32, 3 float32, 4 pointer, 5 wstring,
 * 6 color, 7 uint64, 8 end, 10 int64, 11 alternate end. */
export function parseBinaryVdf(
  buf: Uint8Array,
  offset = 0,
  strings?: string[],
): { value: Vdf; end: number } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder();
  let p = offset;
  const cstr = (): string => {
    const s = p;
    while (p < buf.length && buf[p] !== 0) p++;
    const out = dec.decode(buf.subarray(s, p));
    p++;
    return out;
  };
  const key = (): string => {
    if (strings) {
      const idx = dv.getUint32(p, true);
      p += 4;
      return strings[idx] ?? `#${idx}`;
    }
    return cstr();
  };
  const table = (): Vdf => {
    const obj: Vdf = {};
    while (p < buf.length) {
      const t = buf[p++];
      if (t === 8 || t === 11) return obj;
      const k = key();
      switch (t) {
        case 0:
          obj[k] = table();
          break;
        case 1:
          obj[k] = cstr();
          break;
        case 2:
        case 4:
        case 6:
          obj[k] = String(dv.getInt32(p, true));
          p += 4;
          break;
        case 3:
          obj[k] = String(dv.getFloat32(p, true));
          p += 4;
          break;
        case 7:
          obj[k] = dv.getBigUint64(p, true).toString();
          p += 8;
          break;
        case 10:
          obj[k] = dv.getBigInt64(p, true).toString();
          p += 8;
          break;
        default:
          throw new Error(`unsupported binary VDF type ${t} at ${p - 1}`);
      }
    }
    return obj;
  };
  const value = table();
  return { value, end: p };
}

/** Header-level summary of appcache/appinfo.vdf (v39-v41, magic 0x07564427/28/29, per
 * third_party/steamappinfo). Optionally extracts one app. */
export function readAppInfo(
  buf: Uint8Array,
  wantApp?: number,
): { version: number; universe: number; apps: number; app?: Vdf } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = dv.getUint32(0, true);
  const version = magic & 0xff;
  if (magic >>> 8 !== 0x075644)
    throw new Error(`not an appinfo.vdf (magic 0x${magic.toString(16)})`);
  const universe = dv.getUint32(4, true);
  let p = 8;
  let strings: string[] | undefined;
  if (version >= 0x29) {
    const tableOffset = Number(dv.getBigInt64(p, true));
    p += 8;
    const count = dv.getUint32(tableOffset, true);
    strings = [];
    let q = tableOffset + 4;
    const dec = new TextDecoder();
    for (let k = 0; k < count; k++) {
      const s = q;
      while (buf[q] !== 0) q++;
      strings.push(dec.decode(buf.subarray(s, q)));
      q++;
    }
  }
  let apps = 0;
  let found: Vdf | undefined;
  while (p + 8 <= buf.length) {
    const appid = dv.getUint32(p, true);
    if (appid === 0) break;
    const size = dv.getUint32(p + 4, true);
    const next = p + 8 + size;
    apps++;
    if (wantApp !== undefined && appid === wantApp) {
      // appid(4) size(4) infoState(4) lastUpdated(4) picsToken(8) sha1(20) changeNumber(4) [binarySha1(20) for >= v40, magic low byte 0x28]
      const header = 4 + 4 + 4 + 4 + 8 + 20 + 4 + (version >= 0x28 ? 20 : 0);
      found = parseBinaryVdf(buf, p + header, strings).value;
    }
    p = next;
  }
  return { version, universe, apps, app: found };
}

// ---------------------------------------------------------------- discovery

function regQuery(key: string, value: string): string | undefined {
  try {
    const r = Bun.spawnSync(["reg", "query", key, "/v", value], {
      stderr: "ignore",
    });
    const out = r.stdout.toString();
    const m = out.match(new RegExp(`${value}\\s+REG_\\w+\\s+(.+)`));
    return m?.[1]?.trim();
  } catch {
    return undefined;
  }
}

/** Locate the Steam root. Order: $STEAM_PATH, Windows registry (HKCU SteamPath, then
 * HKLM WOW6432Node InstallPath), then the usual Linux/macOS/Flatpak paths. */
export function findSteamRoot(): string | undefined {
  const candidates: (string | undefined)[] = [process.env.STEAM_PATH];
  if (process.platform === "win32") {
    candidates.push(
      regQuery("HKCU\\Software\\Valve\\Steam", "SteamPath"),
      regQuery("HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"),
      "C:\\Program Files (x86)\\Steam",
    );
  } else {
    const h = homedir();
    candidates.push(
      join(h, ".steam", "steam"),
      join(h, ".local", "share", "Steam"),
      join(
        h,
        ".var",
        "app",
        "com.valvesoftware.Steam",
        ".local",
        "share",
        "Steam",
      ),
      join(h, ".var", "app", "com.valvesoftware.Steam", ".steam", "steam"),
      join(h, "snap", "steam", "common", ".local", "share", "Steam"),
      join(h, "Library", "Application Support", "Steam"),
    );
  }
  for (const c of candidates) {
    if (c && existsSync(join(c, "steamapps"))) return resolve(c);
  }
  return undefined;
}

export interface Library {
  path: string;
  label: string;
  apps: string[];
}

export async function readText(path: string): Promise<string> {
  return await Bun.file(path).text();
}

export async function listLibraries(root: string): Promise<Library[]> {
  const file = join(root, "steamapps", "libraryfolders.vdf");
  if (!existsSync(file)) return [{ path: root, label: "", apps: [] }];
  const doc = parseVdf(await readText(file));
  const lf = vget(doc, "libraryfolders");
  const out: Library[] = [];
  if (lf && typeof lf !== "string") {
    for (const [k, v] of Object.entries(lf)) {
      if (!/^\d+$/.test(k)) continue;
      // Old format: "1" "D:\\Games"; new format: "1" { "path" ... "apps" {...} }.
      if (typeof v === "string") out.push({ path: v, label: "", apps: [] });
      else {
        const apps = vget(v, "apps");
        out.push({
          path: String(vget(v, "path") ?? ""),
          label: String(vget(v, "label") ?? ""),
          apps: apps && typeof apps !== "string" ? Object.keys(apps) : [],
        });
      }
    }
  }
  if (
    !out.some(
      (l) => resolve(l.path).toLowerCase() === resolve(root).toLowerCase(),
    )
  )
    out.unshift({ path: root, label: "", apps: [] });
  return out;
}

export interface InstalledApp {
  appid: number;
  name: string;
  installdir: string;
  library: string;
  manifest: string;
  buildid?: string;
  sizeOnDisk?: number;
  stateFlags?: number;
  lastUpdated?: number;
  depots: { depot: string; manifest: string; size?: string }[];
}

export async function listApps(root: string): Promise<InstalledApp[]> {
  const apps: InstalledApp[] = [];
  for (const lib of await listLibraries(root)) {
    const dir = join(lib.path, "steamapps");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const m = f.match(/^appmanifest_(\d+)\.acf$/i);
      if (!m) continue;
      const path = join(dir, f);
      try {
        apps.push(acfToApp(parseVdf(await readText(path)), lib.path, path));
      } catch {
        apps.push({
          appid: Number(m[1]),
          name: "(unreadable manifest)",
          installdir: "",
          library: lib.path,
          manifest: path,
          depots: [],
        });
      }
    }
  }
  return apps.sort((a, b) => a.appid - b.appid);
}

function acfToApp(doc: Vdf, library: string, manifest: string): InstalledApp {
  const s = vget(doc, "AppState");
  const str = (k: string): string | undefined => {
    const v = vget(s, k);
    return typeof v === "string" ? v : undefined;
  };
  const depotsNode = vget(s, "InstalledDepots");
  const depots: InstalledApp["depots"] = [];
  if (depotsNode && typeof depotsNode !== "string") {
    for (const [depot, d] of Object.entries(depotsNode)) {
      depots.push({
        depot,
        manifest: String(vget(d, "manifest") ?? ""),
        size: vget(d, "size") as string | undefined,
      });
    }
  }
  const num = (k: string): number | undefined =>
    str(k) === undefined ? undefined : Number(str(k));
  return {
    appid: Number(str("appid")),
    name: str("name") ?? "",
    installdir: str("installdir") ?? "",
    library,
    manifest,
    buildid: str("buildid"),
    sizeOnDisk: num("SizeOnDisk"),
    stateFlags: num("StateFlags"),
    lastUpdated: num("LastUpdated"),
    depots,
  };
}

/** StateFlags bits, per third_party/steamlocate-rs/src/app.rs (StateFlag::from_bit_offset). */
export const APP_STATE_FLAGS: Record<number, string> = {
  1: "Uninstalled",
  2: "UpdateRequired",
  4: "FullyInstalled",
  8: "Encrypted",
  16: "Locked",
  32: "FilesMissing",
  64: "AppRunning",
  128: "FilesCorrupt",
  256: "UpdateRunning",
  512: "UpdatePaused",
  1024: "UpdateStarted",
  2048: "Uninstalling",
  4096: "BackupRunning",
  65536: "Reconfiguring",
  131072: "Validating",
  262144: "AddingFiles",
  524288: "Preallocating",
  1048576: "Downloading",
  2097152: "Staging",
  4194304: "Committing",
  8388608: "UpdateStopping",
};

export function decodeStateFlags(flags: number | undefined): string[] {
  if (flags === undefined) return [];
  return Object.entries(APP_STATE_FLAGS)
    .filter(([bit]) => (flags & Number(bit)) !== 0)
    .map(([, name]) => name);
}

const exists = (p: string): string | null => (existsSync(p) ? p : null);

/** Map an appid to every local path Steam uses for it. */
export async function appPaths(
  root: string,
  appid: number,
  accountId?: number,
) {
  const apps = await listApps(root);
  const app = apps.find((a) => a.appid === appid);
  const lib = app?.library ?? root;
  const sa = join(lib, "steamapps");
  const depotManifests = existsSync(join(root, "depotcache"))
    ? readdirSync(join(root, "depotcache"))
        .filter((f) => app?.depots.some((d) => f.startsWith(`${d.depot}_`)))
        .map((f) => join(root, "depotcache", f))
    : [];
  const userdata = join(root, "userdata");
  const users = existsSync(userdata)
    ? readdirSync(userdata).filter((d) => /^\d+$/.test(d))
    : [];
  const userDirs = (accountId ? [String(accountId)] : users).map((u) => ({
    accountId: Number(u),
    appDir: exists(join(userdata, u, String(appid))),
    remote: exists(join(userdata, u, String(appid), "remote")),
    // Any userdata/<accountid>/<n>/remote/<appid>/screenshots directory present on disk
    // (the client stores screenshots as <gameid>/screenshots/, per steamclient64.dll strings).
    screenshots: findScreenshots(join(userdata, u), appid),
  }));
  return {
    appid,
    name: app?.name ?? null,
    installed: Boolean(app),
    library: lib,
    appmanifest: app?.manifest ?? null,
    installDir: app ? exists(join(sa, "common", app.installdir)) : null,
    downloading: exists(join(sa, "downloading", String(appid))),
    shadercache: exists(join(sa, "shadercache", String(appid))),
    workshop: exists(join(sa, "workshop", "content", String(appid))),
    workshopManifest: exists(join(sa, "workshop", `appworkshop_${appid}.acf`)),
    compatdata: exists(join(sa, "compatdata", String(appid))),
    protonPrefix: exists(join(sa, "compatdata", String(appid), "pfx")),
    depotManifests,
    librarycache: exists(join(root, "appcache", "librarycache", String(appid))),
    users: userDirs,
    state: decodeStateFlags(app?.stateFlags),
  };
}

function findScreenshots(userDir: string, appid: number): string[] {
  if (!existsSync(userDir)) return [];
  return readdirSync(userDir)
    .map((d) => join(userDir, d, "remote", String(appid), "screenshots"))
    .filter((p) => existsSync(p));
}

export function dirSize(path: string, limit = 200_000): number {
  let total = 0;
  let seen = 0;
  const walk = (p: string): void => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      if (++seen > limit) return;
      const f = join(p, e.name);
      if (e.isDirectory()) walk(f);
      else total += statSync(f).size;
    }
  };
  walk(path);
  return total;
}

// ---------------------------------------------------------------- SteamID

/** Base of individual SteamID64 values (universe 1, type 1, instance 1). */
export const STEAMID64_BASE = 76561197960265728n;
// Letters per EAccountType index, as SteamKit SteamID.cs AccountTypeChars; unknown types render as "i".
const TYPE_LETTERS = ["I", "U", "M", "G", "A", "P", "C", "g", "T", "i", "a"];

export interface SteamIdForms {
  steamid64: string;
  accountId: number;
  universe: number;
  accountType: number;
  instance: number;
  steam2: string;
  steam3: string;
  profileUrl: string;
}

export function decodeSteamId64(id: bigint): SteamIdForms {
  const accountId = Number(id & 0xffffffffn);
  const instance = Number((id >> 32n) & 0xfffffn);
  const accountType = Number((id >> 52n) & 0xfn);
  const universe = Number((id >> 56n) & 0xffn);
  const letter = TYPE_LETTERS[accountType] ?? "i";
  return {
    steamid64: id.toString(),
    accountId,
    universe,
    accountType,
    instance,
    // STEAM_X uses 0 for public on legacy engines; 1 on newer (Orange Box+). Report 1.
    steam2: `STEAM_${universe}:${accountId & 1}:${accountId >>> 1}`,
    steam3: `[${letter}:${universe}:${accountId}${accountType === 1 && instance !== 1 ? `:${instance}` : ""}]`,
    profileUrl: `https://steamcommunity.com/profiles/${id}`,
  };
}

/** Parse SteamID64, STEAM_X:Y:Z, [U:1:N], a bare account id or a /profiles/ URL.
 * Returns null for vanity names (resolve them over the network). */
export function parseSteamId(input: string): SteamIdForms | null {
  const s = input.trim();
  let m = s.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (m) return decodeSteamId64(BigInt(m[1]!));
  if (/^\d{17}$/.test(s)) return decodeSteamId64(BigInt(s));
  m = s.match(/^STEAM_([0-5]):([01]):(\d+)$/i);
  if (m) {
    const acc = BigInt(Number(m[3]) * 2 + Number(m[2]));
    return decodeSteamId64(STEAMID64_BASE + acc);
  }
  m = s.match(/^\[?U:1:(\d+)\]?$/i);
  if (m) return decodeSteamId64(STEAMID64_BASE + BigInt(m[1]!));
  if (/^\d{1,10}$/.test(s) && Number(s) < 2 ** 32)
    return decodeSteamId64(STEAMID64_BASE + BigInt(s));
  return null;
}

/** Extract a vanity name from a /id/<name> URL or bare name. */
export function vanityOf(input: string): string | null {
  const m = input
    .trim()
    .match(/(?:steamcommunity\.com\/id\/)?([A-Za-z0-9_-]{2,32})\/?$/);
  return m ? m[1]! : null;
}

// ---------------------------------------------------------------- links

export function steamdbLinks(
  kind: string,
  id: string | number,
): Record<string, string> {
  const b = "https://steamdb.info";
  switch (kind) {
    case "app":
      return {
        app: `${b}/app/${id}/`,
        info: `${b}/app/${id}/info/`,
        depots: `${b}/app/${id}/depots/`,
        history: `${b}/app/${id}/history/`,
        patchnotes: `${b}/app/${id}/patchnotes/`,
        charts: `${b}/app/${id}/charts/`,
        packages: `${b}/app/${id}/subs/`,
        store: `https://store.steampowered.com/app/${id}/`,
        community: `https://steamcommunity.com/app/${id}`,
      };
    case "depot":
      return {
        depot: `${b}/depot/${id}/`,
        manifests: `${b}/depot/${id}/manifests/`,
      };
    case "sub":
    case "package":
      return {
        sub: `${b}/sub/${id}/`,
        store: `https://store.steampowered.com/sub/${id}/`,
      };
    case "user":
    case "calculator":
      return {
        calculator: `${b}/calculator/${id}/`,
        profile: `https://steamcommunity.com/profiles/${id}`,
      };
    default:
      throw new Error(`unknown kind ${kind} (app, depot, sub, user)`);
  }
}

// ---------------------------------------------------------------- safety

/** Files that hold login tokens or machine auth: config/config.vdf, config/loginusers.vdf,
 * userdata/<id>/config/local.vdf (cached connect tokens) and ssfn* sentry files. */
export function isSecretFile(path: string): boolean {
  const base = path.replace(/\\/g, "/").split("/").pop()!.toLowerCase();
  return (
    base === "config.vdf" ||
    base === "loginusers.vdf" ||
    base === "local.vdf" ||
    base.startsWith("ssfn")
  );
}

export function isUnder(path: string, dir: string): boolean {
  const norm = (p: string): string =>
    resolve(p).replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
  const p = norm(path);
  const d = norm(dir);
  return p === d || p.startsWith(`${d}/`);
}
