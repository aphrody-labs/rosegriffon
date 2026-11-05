// SPDX-License-Identifier: Apache-2.0
/**
 * Builds runnable copies of the legacy Achilléa renderers.
 *
 * The drawing code of `legacy/achillea-bot/src/services/{PlayerCardService,
 * ClanPosterService}.ts` is kept verbatim: only the imports, the database
 * class shell and the font registration (pointed at legacy/achillea-bot/assets/fonts)
 * are replaced, so the PNGs are what the legacy bot would have drawn.
 */
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dir, "../../../..");
const LEGACY = join(REPO, "legacy/achillea-bot").replaceAll("\\", "/");

const HEADER = `
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@aphrody/canvas";
const urlsConfig = { websiteHost: "rosegriffon.fr" };
const FONTS = [
  ["InterVariable.woff2", "Achillea Sans"],
  ["Satoshi-Black.woff2", "Achillea Display Num"],
  ["MSGothic.woff2", "Achillea Body"],
];
let registered = false;
function registerAchilleaFonts() {
  if (registered) return;
  registered = true;
  for (const [file, alias] of FONTS) GlobalFonts.registerFromPath("${LEGACY}/assets/fonts/" + file, alias);
}
`;

async function extract(file: string, method: string, signature: string, extra = ""): Promise<string> {
  const src = (await Bun.file(join(LEGACY, "src/services", file)).text()).split(String.fromCharCode(13)).join("");
  const consts = src.slice(src.indexOf("const CANVAS_WIDTH"), src.indexOf("export interface"));
  const types = src.slice(src.indexOf("export interface"), src.indexOf("@singleton()"));
  const start = src.indexOf(`private async ${method}(`);
  const open = src.indexOf("{", src.indexOf(")", start));
  let depth = 0;
  let end = open;
  for (; end < src.length; end++) {
    if (src[end] === "{") depth++;
    else if (src[end] === "}" && --depth === 0) break;
  }
  const helpers = src.slice(src.indexOf("\n}\n", end) + 3);
  return `${HEADER}${extra}${consts}${types}export async function ${method}(${signature}): Promise<Buffer> ${src.slice(open, end + 1)}\n${helpers}`;
}

/** Writes the legacy renderers under `dir` and returns their modules. */
export async function legacyRenderers(dir: string) {
  await mkdir(dir, { recursive: true });
  await Bun.write(join(dir, "legacy-card.ts"), await extract("PlayerCardService.ts", "renderCard", "data: PlayerCardData"));
  await Bun.write(
    join(dir, "legacy-poster.ts"),
    await extract(
      "ClanPosterService.ts",
      "renderPoster",
      "data: PosterData",
      "interface PosterClan { id: number; name: string; shortenedName: string; clanAvatarUrl: string; normalizedShortName: string; normalizedName: string; }\n",
    ),
  );
  const card = (await import(join(dir, "legacy-card.ts"))) as { renderCard: (data: unknown) => Promise<Buffer> };
  const poster = (await import(join(dir, "legacy-poster.ts"))) as { renderPoster: (data: unknown) => Promise<Buffer> };
  return { renderCard: card.renderCard, renderPoster: poster.renderPoster };
}
