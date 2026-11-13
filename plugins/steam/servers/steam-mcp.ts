#!/usr/bin/env bun
// Minimal MCP stdio server (JSON-RPC 2.0, newline-delimited) for the steam plugin.
// No npm dependencies: implements initialize, tools/list, tools/call and ping per the
// MCP specification (https://modelcontextprotocol.io/specification). Logs go to stderr.
// Steam helpers come from the monorepo's single owner, packages/gaming (@aphrody/gaming), whose
// local-install readers run the Rust parsers of crates/steam-depot through `ay steam`
// (docs/gaming/OWNERSHIP.md). The plugin is used from the aphrody-labs/src checkout.

import {
  appPaths,
  compatTools,
  findSteamRoot,
  isSecretFile,
  isUnder,
  launchEnv,
  listApps,
  listLibraries,
  parseSteamId,
  readVdf,
  steamdbLinks,
  vanityOf,
  type VdfFormat,
} from "../../../../../packages/gaming/src/steam.ts";

const PROTOCOL = "2025-06-18";
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const API = "https://api.steampowered.com";
const OPENID = "https://steamcommunity.com/openid/login";
const UA =
  "steam-plugin-mcp/0.1 (+https://github.com/aphrody-labs/rosegriffon)";

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

async function getJson(
  url: string,
  extra: Record<string, string> = {},
): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json", ...extra },
  });
  const text = await res.text();
  if (res.status === 429)
    throw new Error(
      `HTTP 429: rate limited by Steam for ${redact(url)}; retry later`,
    );
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
      // The key travels in the x-webapi-key header, never in the URL
      // (https://partner.steamgames.com/doc/webapi_overview/auth).
      const k = a.use_key === false ? undefined : key();
      u.searchParams.set("format", "json");
      const headers: Record<string, string> = { "user-agent": UA };
      if (k) headers["x-webapi-key"] = k;
      const post = a.http_method === "POST";
      if (post) headers["content-type"] = "application/x-www-form-urlencoded";
      const res = await fetch(post ? `${u.origin}${u.pathname}` : u, {
        method: post ? "POST" : "GET",
        headers,
        body: post ? u.searchParams.toString() : undefined,
      });
      const text = await res.text();
      if ((res.status === 401 || res.status === 403) && !k)
        throw new Error(
          `HTTP ${res.status}: ${iface}/${method} needs a Web API key. Set STEAM_WEB_API_KEY (see the plugin README) or use a keyless method; ISteamWebAPIUtil/GetSupportedAPIList lists the methods available without a key.`,
        );
      if (res.status === 429)
        throw new Error("HTTP 429: rate limited by Steam; retry later");
      if (!res.ok)
        throw new Error(
          `HTTP ${res.status} for ${redact(u.toString())}: ${text.slice(0, 300)}`,
        );
      return {
        status: res.status,
        keyUsed: Boolean(k),
        url: redact(u.toString()),
        body: safeParse(text),
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
        const u = `${API}/ISteamUser/ResolveVanityURL/v1/?vanityurl=${encodeURIComponent(vanity)}`;
        const r = (await getJson(u, { "x-webapi-key": k })) as {
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
      const apps = await listApps(r, f || undefined);
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
      let out: unknown = readVdf(
        path,
        String(a.format ?? "auto") as VdfFormat,
        a.appid === undefined ? undefined : Number(a.appid),
      );
      if (a.key_path)
        for (const k of String(a.key_path).split("/")) out = (out as Json)?.[k];
      return out;
    },
  },
  {
    name: "compat_tools",
    description:
      "Compatibility tools of the local Steam install: Valve Proton and Steam Linux Runtime (steamapps/common), compatibilitytools.d (GE-Proton, proton-cachyos, umu) with kind, source and version file.",
    inputSchema: {
      type: "object",
      properties: { steam_path: { type: "string" } },
    },
    run: async (a) => compatTools(root(a)),
  },
  {
    name: "launch_env",
    description:
      "Proton launch environment for an app outside the client (proton run, umu): STEAM_COMPAT_* variables, ntsync, shader caches, gamemoderun wrapper and the equivalent Steam launch options. No secrets.",
    inputSchema: {
      type: "object",
      properties: {
        appid: { type: "integer" },
        prefix: { type: "string", description: "Proton prefix (default: compatdata/<appid>)" },
        steam_path: { type: "string" },
      },
      required: ["appid"],
    },
    run: async (a) =>
      launchEnv(Number(a.appid), {
        root: a.steam_path ? String(a.steam_path) : undefined,
        prefix: a.prefix ? String(a.prefix) : undefined,
      }),
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
    name: "openid_login_url",
    description:
      "Build the 'Sign in through Steam' OpenID 2.0 redirect URL (checkid_setup on https://steamcommunity.com/openid/login) for a return_to callback. Works without a Web API key.",
    inputSchema: {
      type: "object",
      properties: {
        return_to: {
          type: "string",
          description: "Absolute https callback URL",
        },
        realm: {
          type: "string",
          description: "Defaults to the origin of return_to",
        },
      },
      required: ["return_to"],
    },
    run: async (a) => {
      const returnTo = new URL(String(a.return_to));
      const u = new URL(OPENID);
      const sel = "http://specs.openid.net/auth/2.0/identifier_select";
      u.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
      u.searchParams.set("openid.mode", "checkid_setup");
      u.searchParams.set("openid.return_to", returnTo.toString());
      u.searchParams.set(
        "openid.realm",
        String(a.realm ?? `${returnTo.origin}/`),
      );
      u.searchParams.set("openid.identity", sel);
      u.searchParams.set("openid.claimed_id", sel);
      return { url: u.toString() };
    },
  },
  {
    name: "openid_verify",
    description:
      "Verify a Steam OpenID 2.0 callback: posts every openid.* field back with openid.mode=check_authentication, checks is_valid:true, op_endpoint, return_to and the claimed_id format, and returns the SteamID in every form. Pass the full callback URL or its query string. Works without a Web API key.",
    inputSchema: {
      type: "object",
      properties: {
        callback: {
          type: "string",
          description: "Full callback URL or query string",
        },
        expected_return_to: {
          type: "string",
          description:
            "URL the callback arrived on; openid.return_to must match its scheme, host and path, and contain its query parameters (OpenID 2.0 section 11.1)",
        },
      },
      required: ["callback", "expected_return_to"],
    },
    run: async (a) => {
      const raw = String(a.callback);
      const q = new URLSearchParams(
        raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : raw,
      );
      if (q.get("openid.mode") !== "id_res")
        throw new Error(
          `openid.mode is ${q.get("openid.mode") ?? "missing"}, expected id_res`,
        );
      if (q.get("openid.op_endpoint") !== OPENID)
        throw new Error("openid.op_endpoint is not the Steam endpoint");
      const want = new URL(String(a.expected_return_to));
      let got: URL;
      try {
        got = new URL(String(q.get("openid.return_to") ?? ""));
      } catch {
        throw new Error("openid.return_to is missing or not a URL");
      }
      const sameBase =
        got.protocol === want.protocol &&
        got.host === want.host &&
        got.pathname === want.pathname;
      const sameQuery = [...want.searchParams].every(
        ([k, v]) => got.searchParams.get(k) === v,
      );
      if (!sameBase || !sameQuery)
        throw new Error("openid.return_to does not match expected_return_to");
      const m = (q.get("openid.claimed_id") ?? "").match(
        /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/,
      );
      if (!m) throw new Error("openid.claimed_id has an unexpected format");
      const body = new URLSearchParams();
      for (const [k, v] of q) if (k.startsWith("openid.")) body.set(k, v);
      body.set("openid.mode", "check_authentication");
      const res = await fetch(OPENID, {
        method: "POST",
        headers: {
          "user-agent": UA,
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      });
      const text = await res.text();
      const valid = /^is_valid:true$/m.test(text);
      if (!valid)
        throw new Error("Steam rejected the assertion (is_valid is not true)");
      return {
        valid,
        nonce: q.get("openid.response_nonce"),
        note: "Store the nonce and reject repeats (OpenID 2.0 section 11.3).",
        ...parseSteamId(m[1]!)!,
      };
    },
  },
  {
    name: "steamdb_link",
    description:
      "Build steamdb.info links (and store/community links) for an app, depot, sub or user. Links only: never fetches or scrapes SteamDB.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["app", "depot", "sub", "user"],
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
