/**
 * Carte joueur Achilléa (1080×1350, PNG) — portage de `PlayerCardService`.
 * ELO, victoires et défaites du mode 1v1 de la saison courante (`season_id`
 * nul), comme le classement.
 */

import { createCanvas, type Image, type SKRSContext2D } from "@aphrody/canvas";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { MatchMode } from "@rosegriffon/achillea-core/enums";
import { resolveDiscordAvatarUrl } from "@rosegriffon/achillea-core/identity";
import {
  drawCircleImage,
  fetchImage,
  FONT_NUM,
  FONT_SANS,
  hexWithAlpha,
  ImageNotFoundError,
  RANK_COLORS,
  RANK_NAMES,
  rankFromElo,
  registerAchilleaFonts,
  roundRect,
  sanitizeName,
  truncate,
  websiteHost,
} from "./render";

const WIDTH = 1080;
const HEIGHT = 1350;

export interface PlayerCardData {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  elo: number;
  rankIndex: number;
  wins: number;
  losses: number;
  winrate: number;
  season: string;
}

export async function loadPlayerCardData(db: Kysely<Database>, userId: string): Promise<PlayerCardData> {
  const row = await db
    .selectFrom("user")
    .leftJoin("user_elo", join =>
      join
        .onRef("user_elo.user_id", "=", "user.id")
        .on("user_elo.mode", "=", MatchMode.ONE_VS_ONE)
        .on("user_elo.season_id", "is", null),
    )
    .select([
      "user.id",
      "user.display_name",
      "user.normalized_display_name",
      "user.username",
      "user.avatar",
      "user_elo.elo",
      "user_elo.wins",
      "user_elo.losses",
    ])
    .where("user.id", "=", userId)
    .executeTakeFirst();
  if (!row) throw new ImageNotFoundError(`Utilisateur ${userId} introuvable`);
  const elo = Number(row.elo ?? 0);
  const wins = Number(row.wins ?? 0);
  const losses = Number(row.losses ?? 0);
  const fallback = row.username || `User#${row.id}`;
  return {
    userId: row.id,
    displayName: sanitizeName(row.display_name || fallback) || fallback,
    handle: sanitizeName(row.normalized_display_name || ""),
    avatarUrl: resolveDiscordAvatarUrl(row.id, row.avatar, 512),
    elo,
    rankIndex: rankFromElo(elo),
    wins,
    losses,
    winrate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
    season: seasonLabel(new Date()),
  };
}

export function seasonLabel(date: Date): string {
  return `Saison ${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function renderPlayerCard(data: PlayerCardData, avatar?: Image | null): Promise<Buffer> {
  registerAchilleaFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const color = RANK_COLORS[data.rankIndex] ?? "#959595";

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#0b0b10");
  bg.addColorStop(1, "#1b1320");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const halo = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  halo.addColorStop(0, hexWithAlpha(color, 0.45));
  halo.addColorStop(1, hexWithAlpha(color, 0.1));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = hexWithAlpha(color, 0.95);
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, WIDTH - 40, HEIGHT - 40);

  // En-tête
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(40, 40, WIDTH - 80, 140);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 60px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ACHILLÉA — CARTE JOUEUR", WIDTH / 2, 95);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `26px ${FONT_SANS}`;
  ctx.fillText(data.season, WIDTH / 2, 145);

  // Avatar
  const size = 360;
  const ax = (WIDTH - size) / 2;
  const ay = 220;
  drawCircleImage(ctx, avatar === undefined ? await fetchImage(data.avatarUrl) : avatar, ax, ay, size);
  ctx.beginPath();
  ctx.arc(ax + size / 2, ay + size / 2, size / 2 + 8, 0, Math.PI * 2);
  ctx.lineWidth = 10;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Identité
  const iy = ay + size + 60;
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 72px ${FONT_SANS}`;
  ctx.fillText(truncate(data.displayName, 22), WIDTH / 2, iy);
  if (data.handle && data.handle !== data.displayName) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `32px ${FONT_SANS}`;
    ctx.fillText(`@${truncate(data.handle, 26)}`, WIDTH / 2, iy + 60);
  }

  // Rang
  const ry = ay + size + 230;
  const rw = WIDTH - 280;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, 140, ry, rw, 130, 28);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  roundRect(ctx, 140, ry, rw, 130, 28);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `bold 52px ${FONT_SANS}`;
  ctx.fillText(RANK_NAMES[data.rankIndex] ?? "Non classé", WIDTH / 2, ry + 50);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 44px ${FONT_NUM}`;
  ctx.fillText(`${data.elo} ELO`, WIDTH / 2, ry + 96);

  drawStats(ctx, data, ay + size + 410);

  // Pied
  const fy = HEIGHT - 110;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(40, fy, WIDTH - 80, 70);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `22px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText(`ID ${data.userId}`, 70, fy + 35);
  ctx.textAlign = "right";
  ctx.fillText(`Généré le ${new Date().toISOString().slice(0, 10)} · ${websiteHost()}`, WIDTH - 70, fy + 35);

  return canvas.toBuffer("image/png");
}

function drawStats(ctx: SKRSContext2D, data: PlayerCardData, y: number): void {
  const padX = 100;
  const w = WIDTH - padX * 2;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, padX, y, w, 220, 24);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `26px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("STATISTIQUES SAISON", WIDTH / 2, y + 36);
  const col = w / 3;
  const blocks: Array<[string, string, string]> = [
    ["Victoires", String(data.wins), "#7EDCB5"],
    ["Défaites", String(data.losses), "#FF5648"],
    ["Winrate", `${data.winrate}%`, "#FFA910"],
  ];
  for (const [i, [label, value, color]] of blocks.entries()) {
    const cx = padX + col * i + col / 2;
    ctx.fillStyle = color;
    ctx.font = `bold 58px ${FONT_NUM}`;
    ctx.fillText(value, cx, y + 110);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `24px ${FONT_SANS}`;
    ctx.fillText(label, cx, y + 160);
  }
}
