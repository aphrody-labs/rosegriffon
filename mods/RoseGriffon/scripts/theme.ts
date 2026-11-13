// Resolve the mod theme from Rose Griffon's published packages:
//   colours  @rosegriffon/ui/tokens   md3(<theme>) official Material 3 roles, MARQUE brand colours
//   files    @rosegriffon/assets      package files first; otherwise cdn.rosegriffon.fr via sharedAssetUrl(),
//                                     cached under var/ie-work/rg-cache
// No path to another checkout, no colour computed here.
//
//   bun mods/RoseGriffon/scripts/theme.ts [theme.toml] [out.json]
// Env: RG_CDN_ORIGIN (optional CDN origin override, passed to sharedAssetUrl).
import { sharedAssetUrl } from "@rosegriffon/assets";
import { MARQUE, NOMS_THEMES, md3 } from "@rosegriffon/ui/tokens";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(import.meta.path);
const themePath = resolve(process.argv[2] ?? join(here, "..", "theme.toml"));
const outPath = resolve(
  process.argv[3] ??
    join(here, "..", "..", "..", "var", "ie-work", "rg-build", "theme.json"),
);
const cacheDir = join(here, "..", "..", "..", "var", "ie-work", "rg-cache");

type ModTheme = {
  schema: string;
  theme: string;
  assets?: Record<string, string>;
  pet?: { name: string } & Record<string, string>;
  kit?: {
    id: string;
    ramp: string[];
    crest?: string;
    crest_size?: number;
    crest_box?: number[];
  };
};
const mod = Bun.TOML.parse(await Bun.file(themePath).text()) as ModTheme;
if (mod.schema !== "aphrody.theme/3")
  throw new Error(`${themePath}: unsupported schema ${mod.schema}`);
if (!(NOMS_THEMES as readonly string[]).includes(mod.theme)) {
  throw new Error(
    `unknown Rose Griffon theme "${mod.theme}" (@rosegriffon/ui has: ${NOMS_THEMES.join(", ")})`,
  );
}
const scheme = md3(mod.theme as (typeof NOMS_THEMES)[number]) as Record<
  string,
  string
>;

/** A file of @rosegriffon/assets: the installed package, else downloaded once from the Rose Griffon CDN. */
async function asset(name?: string) {
  if (!name) return null;
  const rel = name.replace(/^\/+/, "");
  try {
    const path = fileURLToPath(
      import.meta.resolve(`@rosegriffon/assets/public/${rel}`),
    );
    if (existsSync(path)) return { name: rel, path, from: "package" as const };
  } catch {
    // not in the package: fall through to the CDN
  }
  const url = sharedAssetUrl(rel, process.env.RG_CDN_ORIGIN);
  const path = join(cacheDir, rel);
  if (!existsSync(path)) {
    const res = await fetch(url);
    if (!res.ok)
      return {
        name: rel,
        path: null,
        from: "missing" as const,
        url,
        status: res.status,
      };
    mkdirSync(dirname(path), { recursive: true });
    await Bun.write(path, res);
  }
  return { name: rel, path, from: "cdn" as const, url };
}

const assets = Object.fromEntries(
  await Promise.all(
    Object.entries(mod.assets ?? {}).map(
      async ([k, v]) => [k, await asset(v)] as const,
    ),
  ),
);
const pet = mod.pet && {
  name: mod.pet.name,
  emotes: Object.fromEntries(
    await Promise.all(
      Object.entries(mod.pet)
        .filter(([k]) => k !== "name")
        .map(async ([k, v]) => [k, await asset(v)] as const),
    ),
  ),
};

const role = (r: string) => {
  const hex = scheme[r];
  if (!hex)
    throw new Error(
      `unknown md3 role "${r}" (has: ${Object.keys(scheme).join(", ")})`,
    );
  return hex;
};
const kit = mod.kit && {
  id: mod.kit.id,
  ramp: mod.kit.ramp.map(role),
  crest: mod.kit.crest ?? "logo",
  crest_size: mod.kit.crest_size ?? 180,
  crest_box: mod.kit.crest_box ?? null,
};

const out = {
  id: mod.theme,
  title: "Rose Griffon",
  name: mod.theme.replace(/^theme-/, ""),
  source: {
    mod: themePath,
    ui: "@rosegriffon/ui/tokens md3()",
    assets: "@rosegriffon/assets",
  },
  brand: MARQUE,
  scheme,
  kit,
  assets,
  pet,
};
mkdirSync(dirname(outPath), { recursive: true });
await Bun.write(outPath, `${JSON.stringify(out, null, 2)}\n`);

console.log(
  `theme ${mod.theme}: ${Object.keys(scheme).length} md3 roles, kit ramp ${kit?.ramp.join(" ") ?? "-"}`,
);
for (const [k, a] of [
  ...Object.entries(assets),
  ...Object.entries(pet?.emotes ?? {}),
]) {
  if (a && a.from !== "package")
    console.warn(`${k}: ${a.from}${"url" in a ? ` ${a.url}` : ""}`);
}
console.log(`wrote ${outPath}`);
