#!/usr/bin/env bun
// Unique list of the dx11 textures the wiki asks cdn.rosegriffon.fr for, derived
// from the real URL helpers applied to every prod DB row, plus the URLs seen by
// the page audit (var/wiki-audit/*.json). Read-only.
//
// Usage: INAGLE_DATABASE_URL=... PGOPTIONS="-c default_transaction_read_only=on" \
//          bun tools/crawl/wiki-textures.ts
// Writes var/wiki-textures-manquantes.txt: `<refs>\t<family>\t<vfs path>`, one line
// per texture, refs = DB rows (or audited pages) requesting it.

import {
  getAuraImageUrl,
  getCharacterFaceUrl,
  getCharacterUniformUrl,
  getChrModelTextureUrl,
  getEmblemImageUrl,
  getGalleryImageUrl,
  getItemImageUrl,
  getMiximaxImageUrl,
  getSkillImageUrl,
  listServedChrModelCodes,
  resolveAssetUrl,
  resolveAuraTelopUrl,
  resolveLegacyMenuAsset,
} from "@rosegriffon/azalee/images";
import { TEAM_EMBLEM_MAP } from "@rosegriffon/azalee/game/team-emblem-map";
import { SQL } from "bun";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sql = new SQL(process.env.INAGLE_DATABASE_URL!, { max: 1 });
await sql`set default_transaction_read_only = on`;

/** vfs path → family → refs */
const found = new Map<string, { family: string; refs: number }>();

/** `https://cdn.rosegriffon.fr/dx11/…png?w=…` or `/g4tx/dx11/…` → `dx11/…png`; anything else → null. */
function vfsOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:^|cdn\.rosegriffon\.fr|^\/)\/?(?:g4tx\/|tex\/)?(dx11\/[^?#"]+\.png)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

function add(family: string, url: string | null | undefined, refs = 1) {
  const p = vfsOf(url);
  if (!p) return;
  const hit = found.get(p);
  if (hit) hit.refs += refs;
  else found.set(p, { family, refs });
}

const rows = async (q: string) => (await sql.unsafe(q)) as Record<string, any>[];

for (const r of await rows("select internal_code, chara_id from inagle_characters")) {
  add("chara.face", getCharacterFaceUrl(r.internal_code || r.chara_id));
  add("chara.uniform", getCharacterUniformUrl(r.internal_code || r.chara_id));
}
for (const r of await rows("select internal_code, image_url from inagle_skills")) {
  add("skill.telop", getSkillImageUrl(r.internal_code));
  add("skill.telop", resolveAssetUrl(r.image_url));
}
for (const r of await rows("select internal_code, image_url from inagle_items")) {
  add("item.icon", getItemImageUrl(r.internal_code));
  add("item.icon", resolveAssetUrl(r.image_url));
}
for (const r of await rows("select id, emblem_url from inagle_teams")) {
  const code = TEAM_EMBLEM_MAP[r.id];
  add("team.emblem", (code && getEmblemImageUrl(code)) || resolveLegacyMenuAsset(r.emblem_url));
}
for (const t of ["inagle_auras", "inagle_keshins"]) {
  for (const r of await rows(`select asset_code, image_url from ${t}`)) {
    add("aura.icon", getAuraImageUrl(r.asset_code) || resolveAssetUrl(r.image_url));
    add("aura.telop", resolveAuraTelopUrl(r.asset_code));
  }
}
for (const r of await rows("select icon_code, asset_code, image_url from inagle_miximax")) {
  add("miximax.icon", getMiximaxImageUrl(r.icon_code, r.asset_code, r.image_url));
}
for (const r of await rows("select img_path from inagle_gallery")) add("gallery", getGalleryImageUrl(r.img_path));
for (const r of await rows("select image_path from inagle_stadiums")) {
  const code = String(r.image_path ?? "").split("/").pop();
  if (code) add("stadium", `https://cdn.rosegriffon.fr/dx11/menu/220_img/stadium/${code}.png`);
}
for (const r of await rows("select image_path from inagle_nameplates")) add("nameplate", resolveAssetUrl(r.image_path));
for (const r of await rows("select image_url from inagle_tactics")) add("tactic", resolveAssetUrl(r.image_url));
for (const sub of ["waza", "item", "animal"] as const)
  for (const code of listServedChrModelCodes(sub)) add(`model.${sub}`, getChrModelTextureUrl(sub, code));

// Everything the page audit actually saw (covers avatar atlases, cut-ins, constants).
const glob = new Bun.Glob("var/wiki-audit/*.json");
for await (const f of glob.scan(ROOT)) {
  const j = (await Bun.file(ROOT + f).json().catch(() => null)) as { assets?: Record<string, number> } | null;
  for (const a of Object.keys(j?.assets ?? {})) if (!found.has(vfsOf(a) ?? "")) add("seen-on-page", a);
}
await sql.close();

const lines = [...found].sort((a, b) => a[1].family.localeCompare(b[1].family) || a[0].localeCompare(b[0]));
const byFamily = new Map<string, number>();
for (const [, v] of lines) byFamily.set(v.family, (byFamily.get(v.family) ?? 0) + 1);
const header = [
  `# dx11 textures requested by /wiki on cdn.rosegriffon.fr (${new Date().toISOString().slice(0, 10)})`,
  `# ${lines.length} unique paths. Served by nginx as /tex/<path> -> rg-core, which cannot decode them on the VPS.`,
  `# Extraction: data/<path without trailing /<texture>.png>.g4tx from the game CPK.`,
  ...[...byFamily].map(([f, n]) => `#   ${f}: ${n}`),
  "# refs\tfamily\tpath",
];
await Bun.write(
  `${ROOT}var/wiki-textures-manquantes.txt`,
  `${[...header, ...lines.map(([p, v]) => `${v.refs}\t${v.family}\t${p}`)].join("\n")}\n`,
);
console.log(header.join("\n"));
