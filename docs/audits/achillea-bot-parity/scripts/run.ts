// SPDX-License-Identifier: Apache-2.0
/**
 * Canvas parity audit: renders each fixture with the legacy Achilléa renderers
 * and with the current ones (apps/rg-bot/src/api/modules/achillea/images), then
 * counts differing pixels.
 *
 *   bun docs/audits/achillea-bot-parity/scripts/run.ts
 *
 * Writes `<case>.legacy.png`, `<case>.current.png` and `diff.json` next to this
 * folder. Fixtures use no network image (the clan logo is the local
 * packages/rg-assets Achilléa logo), so the output is reproducible offline.
 * A pixel "differs" when the summed RGB delta exceeds 6 (anti-aliasing noise).
 * The "before" case renders the current poster as it was at 3c36d153, before
 * the 96px placeholder fix (8599f6ed).
 */
import { createCanvas, loadImage, type Image } from "@aphrody/canvas";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { legacyRenderers } from "./legacy-harness";

process.env.WEBSITE_URL = "https://rosegriffon.fr";

const REPO = resolve(import.meta.dir, "../../../..");
const OUT = resolve(import.meta.dir, "..");
const WORK = join(import.meta.dir, ".work");
const IMAGES = join(REPO, "apps/rg-bot/src/api/modules/achillea/images");
const BEFORE_FIX = "3c36d153";

const { renderCard, renderPoster } = await legacyRenderers(WORK);
const { renderPlayerCard } = await import(join(IMAGES, "player-card.ts"));
const { renderClanPoster } = await import(join(IMAGES, "clan-poster.ts"));

// Current poster as it was before the fix, restored from git into the work folder.
await mkdir(join(WORK, "before"), { recursive: true });
for (const file of ["render.ts", "clan-poster.ts"]) {
  const proc = Bun.spawnSync(["git", "show", `${BEFORE_FIX}:apps/rg-bot/src/api/modules/achillea/images/${file}`], { cwd: REPO });
  if (proc.exitCode !== 0) throw new Error(`git show ${file} failed`);
  await Bun.write(join(WORK, "before", file), proc.stdout);
}
const { renderClanPoster: renderClanPosterBefore } = await import(join(WORK, "before", "clan-poster.ts"));

const logoBytes = await Bun.file(join(REPO, "packages/rg-assets/public/achillea/logo1.webp")).bytes();
const logoUrl = `data:image/webp;base64,${Buffer.from(logoBytes).toString("base64")}`;
const logo: Image = await loadImage(logoBytes);

function pixels(img: Image): Uint8ClampedArray {
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height).data;
}

interface Result { case: string; width: number; height: number; differingPixels: number; percent: number; rows: string | null }
const results: Result[] = [];

async function compare(name: string, legacy: Buffer, current: Buffer): Promise<void> {
  const [a, b] = await Promise.all([loadImage(legacy), loadImage(current)]);
  if (a.width !== b.width || a.height !== b.height) throw new Error(`${name}: size ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  const [pa, pb] = [pixels(a), pixels(b)];
  let bad = 0;
  let minY = Infinity;
  let maxY = -1;
  for (let i = 0; i < pa.length; i += 4) {
    const delta = Math.abs(pa[i]! - pb[i]!) + Math.abs(pa[i + 1]! - pb[i + 1]!) + Math.abs(pa[i + 2]! - pb[i + 2]!);
    if (delta > 6) {
      bad++;
      const y = Math.floor(i / 4 / a.width);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const total = a.width * a.height;
  results.push({ case: name, width: a.width, height: a.height, differingPixels: bad, percent: Number(((bad / total) * 100).toFixed(3)), rows: bad ? `${minY}-${maxY}` : null });
  await Bun.write(join(OUT, `${name}.legacy.png`), legacy);
  await Bun.write(join(OUT, `${name}.current.png`), current);
}

// Player card
for (const [name, displayName, handle] of [["card-latin", "Ayane", "ayane_ie"], ["card-cjk", "円堂守", "endo"]] as const) {
  const card = { userId: "123456789012345678", displayName, avatarUrl: null, elo: 1234, rankIndex: 8, wins: 12, losses: 5, winrate: 71, season: "Saison 2026-11" };
  await compare(name, await renderCard({ ...card, normalizedDisplayName: handle }), await renderPlayerCard({ ...card, handle }, null));
}

// Clan poster
const members = [1800, 900, 420, 60, 0].map((elo, i) => ({ userId: String(i), displayName: `Joueur ${i}`, avatarUrl: null, elo, rankIndex: [10, 6, 4, 2, 1][i]! }));
const legacyClan = (clanAvatarUrl: string) => ({ id: 42, name: "Raimon Eleven", shortenedName: "RMN", clanAvatarUrl, normalizedShortName: "rmn", normalizedName: "raimon eleven" });
const currentClan = { id: 42, name: "Raimon Eleven", shortenedName: "RMN", avatarUrl: null, seed: "rmn" };
const noAvatars = { avatars: [null, null, null, null, null] };

await compare("poster-logo", await renderPoster({ clan: legacyClan(logoUrl), members, averageElo: 636, membersCount: 7 }),
  await renderClanPoster({ clan: currentClan, members, averageElo: 636, membersCount: 7 }, { logo, ...noAvatars }));
const legacyNoLogo = await renderPoster({ clan: legacyClan(""), members, averageElo: 636, membersCount: 7 });
await compare("poster-nologo-before-fix", legacyNoLogo,
  await renderClanPosterBefore({ clan: currentClan, members, averageElo: 636, membersCount: 7 }, { logo: null, ...noAvatars }));
await compare("poster-nologo-after-fix", legacyNoLogo,
  await renderClanPoster({ clan: currentClan, members, averageElo: 636, membersCount: 7 }, { logo: null, ...noAvatars }));
await compare("poster-empty", await renderPoster({ clan: legacyClan(""), members: [], averageElo: 0, membersCount: 0 }),
  await renderClanPoster({ clan: currentClan, members: [], averageElo: 0, membersCount: 0 }, { logo: null, avatars: [] }));

await Bun.write(join(OUT, "diff.json"), `${JSON.stringify({ threshold: "summed RGB delta > 6", beforeFix: BEFORE_FIX, cases: results }, null, 2)}\n`);
console.table(results);
