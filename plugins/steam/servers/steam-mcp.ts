#!/usr/bin/env bun
// Minimal MCP stdio server (JSON-RPC 2.0, newline-delimited) for the steam plugin.
// No dependencies: implements initialize, tools/list, tools/call and ping per the
// MCP specification (https://modelcontextprotocol.io/specification). Logs go to stderr.

import {
  appPaths,
  findSteamRoot,
  listApps,
  listLibraries,
  parseBinaryVdf,
  parseSteamId,
  parseVdf,
  readAppInfo,
  steamdbLinks,
  vanityOf,
  decodeStateFlags,
  isSecretFile,
  isUnder,
} from "../lib/steam.ts";

const PROTOCOL = "2025-06-18";
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const API = "https://api.steampowered.com";
const UA = "steam-plugin-mcp/0.1 (+https://github.com/aphrody-dev)";

type Json = Record<string, unknown>;
type Tool = {
  name: string;
  description: string;
  inputSchema: Json;
  run: (a: Json) => Promise<unknown>;
};

const key = (): string | undefined =>
  process.env.STEAM_WEB_API_KEY || undefined;

function root(a: Json): string {
  const r = (a.steam_path as string | undefined) ?? findSteamRoot();
  if (!r)
    throw new Error(
      "Steam install not found; pass steam_path or set STEAM_PATH",
    );
  return r;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok)
    throw new Error(
      `HTTP ${res.status} for ${redact(url)}: ${text.slice(0, 300)}`,
    );
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 20000) };
  }
}

const redact = (u: string): string =>
  u.replace(/([?&](?:key|access_token)=)[^&]+/gi, "$1***");

const tools: Tool[] = [
  {
    name: "web_api_call",
    description:
      "Call a Steam Web API method on api.steampowered.com (GET or POST). Uses STEAM_WEB_API_KEY from the environment when set; without it only keyless methods work (e.g. ISteamNews/GetNewsForApp, ISteamUserStats/GetNumberOfCurrentPlayers, ISteamUserStats/GetGlobalAchievementPercentagesForApp, ISteamWebAPIUtil/GetSupportedAPIList, ISteamWebAPIUtil/GetServerInfo). Pass params as a flat object; pass input_json for service interfaces (I*Service).",
    inputSchema: {
      type: "object",
      properties: {
        interface: {
          type: "string",
          description: "e.g. ISteamUser, IPlayerService, ISteamNews",
        },
        method: { type: "string", description: "e.g. GetPlayerSummaries" },
        version: {
          type: "integer",
          default: 1,
          description: "Method version, v<N> in the URL",
        },
        params: {
          type: "object",
          description: "Query parameters (key is added automatically)",
        },
        input_json: {
          type: "object",
          description: "Service-interface request body, sent as input_json",
        },
        http_method: { type: "string", enum: ["GET", "POST"], default: "GET" },
        use_key: {
          type: "boolean",
          default: true,
          description: "Attach STEAM_WEB_API_KEY if available",
        },
      },
      required: ["interface", "method"],
    },
    run: async (a) => {
      const iface = String(a.interface);
      const method = String(a.method);
      if (!/^I\w+$/.test(iface) || !/^\w+$/.test(method))
        throw new Error("invalid interface or method name");
      const u = new URL(
        `${API}/${iface}/${method}/v${Number(a.version ?? 1)}/`,
      );
      const params = { ...((a.params as Json) ?? {}) };
      for (const [k, v] of Object.entries(params))
        u.searchParams.set(
          k,
          typeof v === "object" ? JSON.stringify(v) : String(v),
        );
      if (a.input_json)
        u.searchParams.set("input_json", JSON.stringify(a.input_json));
      const k = a.use_key === false ? undefined : key();
      if (k) u.searchParams.set("key", k);
      u.searchParams.set("format", "json");
      if (a.http_method === "POST") {
        const body = u.searchParams.toString();
        const res = await fetch(`${u.origin}${u.pathname}`, {
          method: "POST",
          headers: {
            "user-agent": UA,
            "content-type": "application/x-www-form-urlencoded",
          },
          body,
        });
        const text = await res.text();
        return {
          status: res.status,
          keyUsed: Boolean(k),
          body: safeParse(text),
        };
      }
      return {
        keyUsed: Boolean(k),
        url: redact(u.toString()),
        body: await getJson(u.toString()),
      };
    },
  },
  {
    name: "store_appdetails",
    description:
      "Fetch store.steampowered.com/api/appdetails for one appid (undocumented public store endpoint, rate limited). Optional cc (country), l (language), filters (e.g. basic,price_overview).",
    inputSchema: {
      type: "object",
      properties: {
        appid: { type: "integer" },
        cc: { type: "string" },
        l: { type: "string", description: "Language, e.g. english, french" },
        filters: { type: "string" },
      },
      required: ["appid"],
    },
    run: async (a) => {
      const u = new URL("https://store.steampowered.com/api/appdetails");
      u.searchParams.set("appids", String(a.appid));
      for (const p of ["cc", "l", "filters"])
        if (a[p]) u.searchParams.set(p, String(a[p]));
      return await getJson(u.toString());
    },
  },
  {
    name: "resolve_steamid",
    description:
      "Convert any SteamID form (SteamID64, STEAM_X:Y:Z, [U:1:N], account id, profiles/ URL) to every other form offline. Vanity names or /id/<name> URLs are resolved with ISteamUser/ResolveVanityURL when STEAM_WEB_API_KEY is set, otherwise via the public steamcommunity.com/id/<name>/?xml=1 profile feed.",
    inputSchema: {
      type: "object",
      properties: { input: { type: "string" } },
      required: ["input"],
    },
    run: async (a) => {
      const input = String(a.input);
      const direct = parseSteamId(input);
      if (direct) return { source: "offline", ...direct };
      const vanity = vanityOf(input);
      if (!vanity) throw new Error("unrecognized SteamID or vanity");
      const k = key();
      if (k) {
        const u = `${API}/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(k)}&vanityurl=${encodeURIComponent(vanity)}`;
        const r = (await getJson(u)) as {
          response?: { success?: number; steamid?: string; message?: string };
        };
        if (r.response?.success === 1 && r.response.steamid)
          return {
            source: "ISteamUser/ResolveVanityURL",
            vanity,
            ...parseSteamId(r.response.steamid)!,
          };
        throw new Error(
          `ResolveVanityURL: ${r.response?.message ?? "no match"}`,
        );
      }
      const res = await fetch(
        `https://steamcommunity.com/id/${encodeURIComponent(vanity)}/?xml=1`,
        { headers: { "user-agent": UA } },
      );
      const xml = await res.text();
      const m = xml.match(/<steamID64>(\d{17})<\/steamID64>/);
      if (!m) throw new Error("vanity not found (community XML feed)");
      return {
        source: "steamcommunity.com/id/<vanity>/?xml=1",
        vanity,
        ...parseSteamId(m[1]!)!,
      };
    },
  },
  {
    name: "local_apps",
    description:
      "List the local Steam install: root, library folders, and installed apps from appmanifest_*.acf (appid, name, installdir, buildid, size, state flags, depots).",
    inputSchema: {
      type: "object",
      properties: {
        steam_path: { type: "string", description: "Override Steam root" },
        filter: {
          type: "string",
          description: "Substring or appid to filter on",
        },
      },
    },
    run: async (a) => {
      const r = root(a);
      const f = a.filter ? String(a.filter).toLowerCase() : "";
      const apps = (await listApps(r))
        .filter(
          (x) =>
            !f || String(x.appid) === f || x.name.toLowerCase().includes(f),
        )
        .map((x) => ({ ...x, state: decodeStateFlags(x.stateFlags) }));
      return {
        steamRoot: r,
        libraries: await listLibraries(r),
        count: apps.length,
        apps,
      };
    },
  },
  {
    name: "read_vdf",
    description:
      "Parse a VDF/ACF file to JSON. Text KeyValues (libraryfolders.vdf, appmanifest_*.acf, localconfig.vdf), binary KeyValues (shortcuts.vdf) or appcache/appinfo.vdf (summary, or one app with appid). Only paths under the Steam root or its library folders; refuses config.vdf, loginusers.vdf, local.vdf and ssfn files, which hold credentials.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        format: {
          type: "string",
          enum: ["auto", "text", "binary", "appinfo"],
          default: "auto",
        },
        appid: {
          type: "integer",
          description: "For appinfo: extract this app",
        },
        key_path: {
          type: "string",
          description: "Optional slash-separated sub-path to return",
        },
        steam_path: { type: "string", description: "Override Steam root" },
      },
      required: ["path"],
    },
    run: async (a) => {
      const path = String(a.path);
      const base = path.replace(/\\/g, "/").split("/").pop()!.toLowerCase();
      if (isSecretFile(path))
        throw new Error(`${base} holds credentials; not read`);
      const r = a.steam_path ? String(a.steam_path) : findSteamRoot();
      const allowed = r
        ? [r, ...(await listLibraries(r)).map((l) => l.path)]
        : [];
      if (!allowed.some((dir) => isUnder(path, dir)))
        throw new Error(
          "path is outside the Steam root and its library folders",
        );
      const buf = new Uint8Array(await Bun.file(path).arrayBuffer());
      let fmt = String(a.format ?? "auto");
      if (fmt === "auto")
        fmt =
          base === "appinfo.vdf"
            ? "appinfo"
            : buf[0] === 0x00 || buf.subarray(0, 512).includes(0)
              ? "binary"
              : "text";
      let out: unknown;
      if (fmt === "appinfo")
        out = readAppInfo(
          buf,
          a.appid === undefined ? undefined : Number(a.appid),
        );
      else if (fmt === "binary") out = parseBinaryVdf(buf).value;
      else out = parseVdf(new TextDecoder().decode(buf));
      if (a.key_path)
        for (const k of String(a.key_path).split("/")) out = (out as Json)?.[k];
      return out;
    },
  },
  {
    name: "app_paths",
    description:
      "Map an appid to every local Steam path: appmanifest, install dir, depotcache manifests, shadercache, workshop, compatdata/pfx (Proton), downloading, librarycache, userdata/<accountid>/<appid>/remote and screenshots.",
    inputSchema: {
      type: "object",
      properties: {
        appid: { type: "integer" },
        account_id: {
          type: "integer",
          description: "Restrict userdata to this 32-bit account id",
        },
        steam_path: { type: "string" },
      },
      required: ["appid"],
    },
    run: async (a) =>
      appPaths(
        root(a),
        Number(a.appid),
        a.account_id ? Number(a.account_id) : undefined,
      ),
  },
  {
    name: "steamdb_link",
    description:
      "Build steamdb.info links (and store/community links) for an app, depot, sub, build or user. Links only: never fetches or scrapes SteamDB.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["app", "depot", "sub", "build", "user"],
        },
        id: { type: "string" },
      },
      required: ["kind", "id"],
    },
    run: async (a) => {
      if (!/^\d+$/.test(String(a.id))) throw new Error("id must be numeric");
      return steamdbLinks(String(a.kind), String(a.id));
    },
  },
];

function safeParse(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t.slice(0, 20000);
  }
}

async function handle(msg: Json): Promise<Json | null> {
  const id = msg.id as string | number | undefined;
  const method = msg.method as string;
  const reply = (result: unknown): Json => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string): Json => ({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
  if (id === undefined) return null; // notification (e.g. notifications/initialized)
  switch (method) {
    case "initialize": {
      const asked = (msg.params as Json | undefined)?.protocolVersion;
      return reply({
        protocolVersion:
          typeof asked === "string" && SUPPORTED_PROTOCOLS.includes(asked)
            ? asked
            : PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "steam", version: "0.1.0" },
        instructions:
          "Steam ecosystem tools. Local tools read the Steam install; web_api_call uses STEAM_WEB_API_KEY when present. steamdb_link never scrapes.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: tools.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });
    case "tools/call": {
      const p = (msg.params ?? {}) as Json;
      const tool = tools.find((t) => t.name === p.name);
      if (!tool) return fail(-32602, `unknown tool ${String(p.name)}`);
      try {
        const out = await tool.run((p.arguments as Json) ?? {});
        return reply({
          content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
        });
      } catch (e) {
        return reply({
          content: [
            { type: "text", text: redact(String((e as Error).message ?? e)) },
          ],
          isError: true,
        });
      }
    }
    default:
      return fail(-32601, `method not found: ${method}`);
  }
}

async function main(): Promise<void> {
  const dec = new TextDecoder();
  let buf = "";
  const write = (o: Json): void => {
    process.stdout.write(`${JSON.stringify(o)}\n`);
  };
  for await (const chunk of Bun.stdin.stream()) {
    buf += dec.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg: Json;
      try {
        msg = JSON.parse(line);
      } catch {
        write({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "parse error" },
        });
        continue;
      }
      const out = await handle(msg);
      if (out) write(out);
    }
  }
}

if (import.meta.main) await main();

export { handle, tools };
