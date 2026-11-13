// Validate an IEVR (VR-Framework) modpack profile against the mods on disk and print a report.
// Read-only: it never writes into a mod folder or the game directory.
//
//   bun tools/ie/modpack-check.ts [mods/profiles/complete.toml] [--json]
//
// Checks over the profile's enabled set:
//   - every enabled / ordered id resolves to one mod.toml (id or former_ids) under the profile's roots;
//     enabled == order as sets; the pinned first mod is first
//   - requires satisfied (mod id or former id with version >= x, or a `provides` token of an enabled mod)
//   - declared conflicts not both enabled
//   - [VRFW.TitleArt] own = true owners (config.toml)
//   - VRFW.image/1 sprites / textures written by more than one mod (atlas + name + language); a file whose
//     `when = { config = "*.<key>" ... }` is off for this profile is skipped
//   - VRFW.match_camera presets (duplicate names; more than one whole-match preset switched on)
//   - option ids (<prefix>.<id>) duplicated, (parent, order) ties, profile [options] that do not exist
//   - VRFW.theme/1 accent values shared by several themes (the single theme_engine.ui_theme row)
//   - VRFW.text/2 row ids written by RoseGriffon and another mod
// An overlap matching a profile [[override]] (kind + winner + loser, winner later in the order) is reported as
// intended; anything else is a finding. Overlaps between two mods of the same upstream collection are listed as
// upstream (author-tested) information and do not fail the check.
// Exit code: 0 clean or only intended / upstream items, 1 findings.
import { Glob } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

type Toml = Record<string, any>;
const REPO = join(import.meta.dir, "..", "..");
const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const profilePath = resolve(
  argv.find((a) => !a.startsWith("--")) ??
    join(REPO, "mods", "profiles", "complete.toml"),
);
const profileDir = dirname(profilePath);
const profile = Bun.TOML.parse(readFileSync(profilePath, "utf8")) as Toml;

const readToml = (p: string): Toml | null => {
  try {
    return Bun.TOML.parse(readFileSync(p, "utf8")) as Toml;
  } catch (e) {
    parseErrors.push(`${relative(REPO, p)}: ${(e as Error).message}`);
    return null;
  }
};
const parseErrors: string[] = [];
const arr = <T>(x: T | T[] | undefined): T[] =>
  x === undefined ? [] : Array.isArray(x) ? x : [x];

// ---------------------------------------------------------------- report
type Level = "error" | "warn" | "intended" | "upstream" | "info";
const items: { level: Level; check: string; msg: string }[] = [];
const add = (level: Level, check: string, msg: string) =>
  items.push({ level, check, msg });

// ---------------------------------------------------------------- discover mods
interface Mod {
  id: string;
  dir: string;
  root: string; // the profile root it was found under (collection identity)
  toml: Toml;
  version: string;
  former: string[];
  prefix: string;
  config: Toml | null;
}
const roots: string[] = arr(profile.sources?.roots).map((r: string) =>
  resolve(profileDir, r),
);
const mods: Mod[] = [];
for (const root of roots) {
  if (!existsSync(root)) {
    add("error", "sources", `root missing: ${relative(REPO, root)}`);
    continue;
  }
  for (const f of new Glob("**/mod.toml").scanSync({ cwd: root })) {
    if (f.split(/[\\/]/).some((s) => s.startsWith(".") || s === "node_modules"))
      continue;
    const p = join(root, f);
    const t = readToml(p);
    if (!t?.id) continue;
    const dir = dirname(p);
    const cfgPath = join(dir, "config.toml");
    mods.push({
      id: t.id,
      dir,
      root,
      toml: t,
      version: String(t.version ?? "0"),
      former: arr(t.former_ids),
      prefix: t.prefix ?? t.id,
      config: existsSync(cfgPath) ? readToml(cfgPath) : null,
    });
  }
}
const byName = new Map<string, Mod>();
for (const m of mods)
  for (const n of [m.id, ...m.former]) if (!byName.has(n)) byName.set(n, m);

// ---------------------------------------------------------------- enabled set and order
const enabledIds: string[] = arr(profile.enabled);
const order: string[] = arr(profile.order);
const pinned: string = profile.pinned_first ?? "VRFW";
const enabled: Mod[] = [];
for (const id of enabledIds) {
  const m = byName.get(id);
  if (!m)
    add("error", "exists", `enabled mod not found under the roots: ${id}`);
  else if (m.id !== id)
    add(
      "warn",
      "exists",
      `${id} is a former id of ${m.id}; use the current id`,
    );
  else enabled.push(m);
}
const dup = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
for (const d of dup(enabledIds)) add("error", "exists", `enabled twice: ${d}`);
for (const d of dup(order)) add("error", "order", `ordered twice: ${d}`);
for (const id of order)
  if (!enabledIds.includes(id))
    add("error", "order", `in order but not enabled: ${id}`);
for (const id of enabledIds)
  if (!order.includes(id))
    add("error", "order", `enabled but missing from order: ${id}`);
if (order[0] !== pinned)
  add("error", "order", `${pinned} must be first (pinned), found ${order[0]}`);
const rank = (id: string) => order.indexOf(id); // higher = later = wins
const isOn = (id: string) => enabled.some((m) => m.id === id);
for (const ex of arr<Toml>(profile.excluded)) {
  if (!byName.has(ex.id))
    add("warn", "excluded", `excluded id not found on disk: ${ex.id}`);
  if (enabledIds.includes(ex.id))
    add("error", "excluded", `${ex.id} is both excluded and enabled`);
}
// every mod on disk is either enabled or excluded with a reason
for (const m of mods)
  if (!isOn(m.id) && !arr<Toml>(profile.excluded).some((e) => e.id === m.id))
    add(
      "warn",
      "coverage",
      `${m.id} is neither enabled nor listed in [[excluded]]`,
    );

// ---------------------------------------------------------------- requires / conflicts
const cmpVer = (a: string, b: string) => {
  const pa = a.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++)
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
};
const provided = new Map<string, { mod: string; version?: string }>();
for (const m of enabled)
  for (const p of arr<string>(m.toml.provides)) {
    const [name, ver] = p.split("=");
    provided.set(name, { mod: m.id, version: ver });
  }
const reqRe =
  /^([A-Za-z0-9_.\-]+?)\s*(>=|<=|==|=|>|<)?\s*([0-9][0-9A-Za-z.\-+]*)?$/;
let reqCount = 0;
for (const m of enabled) {
  for (const r of arr<string>(m.toml.requires)) {
    reqCount++;
    const mm = reqRe.exec(r.trim());
    if (!mm) {
      add("warn", "requires", `${m.id}: unparsed requirement "${r}"`);
      continue;
    }
    const [, name, op = ">=", ver] = mm;
    const dep = byName.get(name);
    if (dep && isOn(dep.id)) {
      if (ver) {
        const c = cmpVer(dep.version, ver);
        const ok =
          op === ">="
            ? c >= 0
            : op === ">"
              ? c > 0
              : op === "<="
                ? c <= 0
                : op === "<"
                  ? c < 0
                  : c === 0;
        if (!ok)
          add(
            "error",
            "requires",
            `${m.id} requires ${r}, enabled ${dep.id} is ${dep.version}`,
          );
      }
      if (dep.id !== name)
        add(
          "info",
          "requires",
          `${m.id} requires former id ${name} -> ${dep.id}`,
        );
      if (rank(dep.id) > rank(m.id))
        add(
          "info",
          "requires",
          `${m.id} is ordered before its requirement ${dep.id} (the loader loads requirements first)`,
        );
      continue;
    }
    const prov = provided.get(name);
    if (prov) {
      if (ver && prov.version && cmpVer(prov.version, ver) < 0)
        add(
          "error",
          "requires",
          `${m.id} requires ${r}, ${prov.mod} provides ${name}=${prov.version}`,
        );
      continue;
    }
    add(
      "error",
      "requires",
      `${m.id} requires ${r}: not enabled and not provided`,
    );
  }
  for (const c of arr<string>(m.toml.conflicts)) {
    const name = c.split(/[<>=]/)[0].trim();
    const other = byName.get(name);
    if (other && isOn(other.id))
      add(
        "error",
        "conflicts",
        `${m.id} declares a conflict with enabled ${other.id}`,
      );
  }
}

// ---------------------------------------------------------------- overlap bookkeeping
const overrides = arr<Toml>(profile.override);
const usedOverride = new Set<number>();
// owners: mod ids in load order (last = winner)
function overlap(kind: string, key: string, owners: string[], extra = "") {
  const sorted = [...new Set(owners)].sort((a, b) => rank(a) - rank(b));
  if (sorted.length < 2) return;
  const winner = sorted[sorted.length - 1];
  const losers = sorted.slice(0, -1);
  const oi = overrides.findIndex(
    (o) =>
      o.kind === kind &&
      o.winner === winner &&
      losers.every((l) => arr<string>(o.losers).includes(l)),
  );
  const desc = `${key}: ${sorted.join(" < ")}${extra ? ` (${extra})` : ""}`;
  if (oi >= 0) {
    usedOverride.add(oi);
    add("intended", kind, `${desc}; ${winner} wins as declared`);
    return;
  }
  const wrongWay = overrides.find(
    (o) =>
      o.kind === kind &&
      losers.includes(o.winner) &&
      arr<string>(o.losers).includes(winner),
  );
  if (wrongWay) {
    add(
      "error",
      kind,
      `${desc}; profile wants ${wrongWay.winner} to win but it loads earlier`,
    );
    return;
  }
  const modsOf = sorted.map((id) => enabled.find((m) => m.id === id)!);
  if (modsOf.every((m) => m.root === modsOf[0].root))
    add("upstream", kind, desc);
  else add("error", kind, `${desc}; undeclared cross-collection overlap`);
}

const contentFiles = (m: Mod, sub: string) => {
  const base = join(m.dir, "content", sub);
  if (!existsSync(base)) return [] as string[];
  return [...new Glob("**/*.toml").scanSync({ cwd: base })]
    .filter((f) => !f.split(/[\\/]/).some((s) => s.startsWith("_"))) // developer files, not installed
    .map((f) => join(base, f));
};
const configKey = (cfg: Toml | null, key: string): any =>
  key.split(".").reduce((o: any, k) => (o == null ? o : o[k]), cfg);
// `when = { config = "*.A.B", equals = X, default = D }`: "*" reads every enabled mod's config, the latest wins
function whenOn(when: Toml | undefined): boolean | null {
  if (!when?.config) return true;
  const path = String(when.config);
  let val: any;
  if (path.startsWith("*.")) {
    const k = path.slice(2);
    for (const m of [...enabled].sort((a, b) => rank(a.id) - rank(b.id))) {
      const v = configKey(m.config, k);
      if (v !== undefined) val = v;
    }
  } else {
    const [mid, ...rest] = path.split(".");
    val = configKey(
      enabled.find((m) => m.id === mid)?.config ?? null,
      rest.join("."),
    );
  }
  if (val === undefined) val = when.default;
  if ("equals" in when) return val === when.equals;
  return null;
}

// ---------------------------------------------------------------- title art owners
const titleOwners = enabled
  .filter((m) => configKey(m.config, "VRFW.TitleArt.own") === true)
  .map((m) => m.id);
if (titleOwners.length)
  add(
    "info",
    "title_art",
    `[VRFW.TitleArt] own = true: ${titleOwners.join(", ")} (framework title art off)`,
  );
overlap("title_art", "[VRFW.TitleArt] own", titleOwners);

// ---------------------------------------------------------------- images
const LANGS = ["", "de", "en", "es", "fr", "it", "pt", "zh_hans", "zh_hant"];
const imageOwners = new Map<string, Set<string>>();
let imageEntries = 0;
let imageSkipped = 0;
for (const m of enabled) {
  for (const f of contentFiles(m, "images")) {
    const t = readToml(f);
    if (!t || t.schema !== "VRFW.image/1") continue;
    const on = whenOn(t.when);
    if (on === false) {
      imageSkipped++;
      continue;
    }
    for (const kind of ["sprite", "texture"] as const) {
      for (const e of arr<Toml>(t[kind])) {
        if (!e.atlas || !e.name) continue;
        imageEntries++;
        const langs = String(e.atlas).includes("<LG>")
          ? e.lang === undefined
            ? LANGS
            : arr<string>(e.lang)
          : ["*"];
        for (const lg of langs) {
          const k = `${kind} ${e.atlas.replace("<LG>", lg || "ja")} :: ${e.name}`;
          if (!imageOwners.has(k)) imageOwners.set(k, new Set());
          imageOwners.get(k)!.add(m.id);
        }
      }
    }
  }
}
// group identical owner sets per atlas+name so the report stays short
const grouped = new Map<string, { owners: string[]; langs: string[] }>();
for (const [k, s] of imageOwners) {
  if (s.size < 2) continue;
  const owners = [...s].sort((a, b) => rank(a) - rank(b));
  const m =
    /^(\w+) (.*?)\/(ja|de|en|es|fr|it|pt|zh_hans|zh_hant)\/([^/]+) :: (.*)$/.exec(
      k,
    );
  const gk = m
    ? `${m[1]} ${m[2]}/<LG>/${m[4]} :: ${m[5]}|${owners}`
    : `${k}|${owners}`;
  const g = grouped.get(gk) ?? { owners, langs: [] };
  if (m) g.langs.push(m[3]);
  grouped.set(gk, g);
}
for (const [gk, g] of grouped)
  overlap(
    "image",
    gk.split("|")[0],
    g.owners,
    g.langs.length ? `langs ${g.langs.length}` : "",
  );

// ---------------------------------------------------------------- cameras
const presets: { mod: string; name: string; schema: string }[] = [];
for (const m of enabled)
  for (const f of contentFiles(m, "cameras")) {
    const t = readToml(f);
    if (!t || !String(t.schema).startsWith("VRFW.match_camera/")) continue;
    for (const p of arr<Toml>(t.preset))
      presets.push({
        mod: m.id,
        name: `${m.prefix}.${p.name}`,
        schema: t.schema,
      });
  }
for (const d of dup(presets.map((p) => p.name)))
  add("error", "camera", `preset name declared twice: ${d}`);
add(
  "info",
  "camera",
  `presets: ${presets.map((p) => `${p.name} (${p.schema.split("/")[1] === "1" ? "whole match" : "drive " + p.schema})`).join(", ")}`,
);
// whole-match presets (schema /1) compete for the same chase camera rows; the profile says which one is on
const toggles = arr<Toml>(profile.camera?.toggle);
const whole = presets.filter((p) => p.schema === "VRFW.match_camera/1");
const optValue = (key: string) => (profile.options ?? {})[key];
const onWhole: string[] = [];
for (const p of whole) {
  const t = toggles.find((x) => x.preset === p.name);
  if (!t) {
    add(
      "error",
      "camera",
      `whole-match preset ${p.name} has no [[camera.toggle]] in the profile`,
    );
    continue;
  }
  const v = optValue(t.option);
  if (v === undefined)
    add(
      "error",
      "camera",
      `${p.name}: option ${t.option} has no value in [options]`,
    );
  else if (v === t.on) onWhole.push(p.name);
}
if (onWhole.length > 1)
  add(
    "error",
    "camera",
    `several whole-match presets switched on: ${onWhole.join(", ")}`,
  );
else if (whole.length > 1) {
  const owner = onWhole[0] ?? "(retail camera)";
  const others = whole.filter((p) => p.name !== owner).map((p) => p.mod);
  // decided by the option rows, not by load order
  const off = whole.filter((p) => p.name !== owner).map((p) => p.name);
  if ((profile.camera?.owner ?? "(retail camera)") === owner)
    add(
      "intended",
      "camera",
      `whole-match chase camera: ${owner} on, ${off.join(", ")} off (option rows), ${others.join(", ")} yield`,
    );
  else
    add(
      "error",
      "camera",
      `whole-match camera on is ${owner}, profile [camera] owner is ${profile.camera?.owner}`,
    );
}
// drive presets (schema /2, /3) are requested at their own priority over the whole-match one
for (const p of presets.filter((p) => p.schema !== "VRFW.match_camera/1"))
  add(
    "info",
    "camera",
    `${p.name}: drive preset (requested with its drive's priority during its event, then released)`,
  );

// ---------------------------------------------------------------- options
const optionIds = new Map<string, string>();
const slots = new Map<string, string[]>();
const optionFiles = (m: Mod) =>
  [join(m.dir, "options.toml"), ...contentFiles(m, "options")].filter(
    existsSync,
  );
for (const m of enabled)
  for (const f of optionFiles(m)) {
    const t = readToml(f);
    for (const o of arr<Toml>(t?.option)) {
      if (!o.id) continue;
      const key = `${m.prefix}.${o.id}`;
      if (optionIds.has(key))
        add(
          "error",
          "options",
          `option id ${key} in ${optionIds.get(key)} and ${m.id}`,
        );
      optionIds.set(key, m.id);
      if (o.parent !== undefined && o.order !== undefined) {
        const sk = `${o.parent} #${o.order}`;
        slots.set(sk, [...(slots.get(sk) ?? []), `${key}`]);
      }
    }
  }
for (const [sk, keys] of slots) {
  if (keys.length < 2) continue;
  const owners = keys.map((k) => optionIds.get(k)!);
  if (new Set(owners).size === 1)
    add("info", "options", `same mod shares slot ${sk}: ${keys.join(", ")}`);
  else overlap("option_slot", `${sk} (${keys.join(", ")})`, owners);
}
for (const k of Object.keys(profile.options ?? {})) {
  if (k === "theme_engine.ui_theme") continue;
  if (!optionIds.has(k))
    add(
      "error",
      "options",
      `profile option ${k} is not declared by an enabled mod`,
    );
}

// ---------------------------------------------------------------- themes
const accentOwners = new Map<number, string[]>();
const themeIds = new Map<string, string>();
for (const m of enabled)
  for (const f of contentFiles(m, "themes")) {
    const t = readToml(f);
    if (!t || t.schema !== "VRFW.theme/1") continue;
    const tid = t.theme?.id;
    if (tid && themeIds.has(tid))
      add(
        "error",
        "theme",
        `theme id ${tid} in ${themeIds.get(tid)} and ${m.id}`,
      );
    if (tid) themeIds.set(tid, m.id);
    for (const a of arr<Toml>(t.accent))
      accentOwners.set(a.value, [
        ...(accentOwners.get(a.value) ?? []),
        `${m.id}:${tid}.${a.id}`,
      ]);
  }
for (const [v, owners] of accentOwners)
  if (owners.length > 1)
    add(
      "error",
      "theme",
      `ui_theme value ${v} declared by ${owners.join(", ")}`,
    );
add(
  "info",
  "theme",
  `themes: ${[...themeIds].map(([t, m]) => `${t} (${m})`).join(", ")}; accent values ${[...accentOwners.keys()].sort((a, b) => a - b).join(", ")}`,
);
const uiTheme = optValue("theme_engine.ui_theme");
if (uiTheme !== undefined && uiTheme !== 0 && !accentOwners.has(uiTheme))
  add(
    "error",
    "theme",
    `profile theme_engine.ui_theme = ${uiTheme} matches no accent`,
  );

// ---------------------------------------------------------------- text rows touching RoseGriffon
const rowOwners = new Map<string, string[]>();
for (const m of enabled) {
  const base = join(m.dir, "text");
  if (!existsSync(base)) continue;
  for (const f of new Glob("**/*.toml").scanSync({ cwd: base })) {
    const t = readToml(join(base, f));
    if (!t || t.schema !== "VRFW.text/2") continue;
    for (const r of arr<Toml>(t.row))
      if (r.id)
        rowOwners.set(`${t.table}:${r.id}`, [
          ...(rowOwners.get(`${t.table}:${r.id}`) ?? []),
          m.id,
        ]);
  }
}
let upstreamRows = 0;
for (const [k, o] of rowOwners) {
  const owners = [...new Set(o)];
  if (owners.length < 2) continue;
  if (owners.includes("RoseGriffon")) overlap("text_row", k, owners);
  else upstreamRows++;
}
if (upstreamRows)
  add(
    "upstream",
    "text_row",
    `${upstreamRows} VRFW.text/2 row ids shared between collection mods (author-tested)`,
  );
add(
  "info",
  "text",
  'VRFW.text_key/1 keys are namespaced per mod (crc32("<prefix>.<key>")): no cross-mod collision possible',
);

// ---------------------------------------------------------------- unused overrides
overrides.forEach((o, i) => {
  if (!usedOverride.has(i))
    add(
      "warn",
      "override",
      `declared override not matched by any overlap: ${o.kind} ${o.winner} > ${arr(o.losers).join(", ")}`,
    );
});
for (const e of parseErrors) add("warn", "parse", e);

// ---------------------------------------------------------------- print
const counts = Object.fromEntries(
  (["error", "warn", "intended", "upstream", "info"] as Level[]).map((l) => [
    l,
    items.filter((i) => i.level === l).length,
  ]),
);
if (asJson) {
  console.log(
    JSON.stringify(
      {
        profile: relative(REPO, profilePath),
        enabled: enabled.length,
        counts,
        items,
      },
      null,
      2,
    ),
  );
} else {
  console.log(
    `modpack-check ${relative(REPO, profilePath).replaceAll("\\", "/")}`,
  );
  console.log(
    `  mods on disk ${mods.length}, enabled ${enabled.length}, requirements ${reqCount}, image entries ${imageEntries} (${imageSkipped} files off by \`when\`)`,
  );
  const show = (l: Level, title: string, limit = Infinity) => {
    const xs = items.filter((i) => i.level === l);
    if (!xs.length) return;
    console.log(`\n${title} (${xs.length})`);
    for (const x of xs.slice(0, limit)) console.log(`  [${x.check}] ${x.msg}`);
    if (xs.length > limit)
      console.log(`  ... ${xs.length - limit} more (--json for all)`);
  };
  show("error", "ERRORS");
  show("warn", "WARNINGS");
  show("intended", "INTENDED OVERRIDES (declared in the profile)");
  show(
    "upstream",
    "UPSTREAM OVERLAPS (inside one collection, author-tested)",
    25,
  );
  show("info", "INFO", 40);
  console.log(
    `\nverdict: ${counts.error || counts.warn ? "FINDINGS" : "clean"} (errors ${counts.error}, warnings ${counts.warn}, intended ${counts.intended}, upstream ${counts.upstream})`,
  );
}
process.exit(counts.error || counts.warn ? 1 : 0);
