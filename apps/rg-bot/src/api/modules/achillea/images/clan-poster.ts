/**
 * Affiche de clan Achilléa (1080×1920, PNG) — portage de `ClanPosterService`.
 * Top 5 des membres par ELO 1v1 de la saison courante, ELO moyen, effectif.
 */

import { createCanvas, type Image } from "@aphrody/canvas";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { MatchMode } from "@rosegriffon/achillea-core/enums";
import { resolveDiscordAvatarUrl } from "@rosegriffon/achillea-core/identity";
import {
  drawCircleImage,
  fetchImage,
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
const HEIGHT = 1920;

export interface PosterMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  elo: number;
  rankIndex: number;
}

export interface PosterData {
  clan: { id: number; name: string; shortenedName: string; avatarUrl: string | null; seed: string };
  members: PosterMember[];
  averageElo: number;
  membersCount: number;
}

export async function loadClanPosterData(db: Kysely<Database>, clanId: number): Promise<PosterData> {
  const clan = await db
    .selectFrom("clan")
    .select(["id", "name", "shortened_name", "clan_avatar_url", "normalized_short_name", "normalized_name"])
    .where("id", "=", clanId)
    .executeTakeFirst();
  if (!clan) throw new ImageNotFoundError(`Clan ${clanId} introuvable`);
  const rows = await db
    .selectFrom("clan_member")
    .innerJoin("user", "user.id", "clan_member.user_id")
    .leftJoin("user_elo", join =>
      join
        .onRef("user_elo.user_id", "=", "user.id")
        .on("user_elo.mode", "=", MatchMode.ONE_VS_ONE)
        .on("user_elo.season_id", "is", null),
    )
    .select(["user.id", "user.display_name", "user.username", "user.avatar", "user_elo.elo"])
    .where("clan_member.clan_id", "=", clanId)
    .execute();
  const members = rows
    .map(row => {
      const elo = Number(row.elo ?? 0);
      const fallback = row.username || `User#${row.id}`;
      return {
        userId: row.id,
        displayName: sanitizeName(row.display_name || fallback) || fallback,
        avatarUrl: resolveDiscordAvatarUrl(row.id, row.avatar, 256),
        elo,
        rankIndex: rankFromElo(elo),
      };
    })
    .toSorted((a, b) => b.elo - a.elo);
  return {
    clan: {
      id: clan.id,
      name: sanitizeName(clan.name) || clan.name,
      shortenedName: clan.shortened_name,
      avatarUrl: clan.clan_avatar_url || null,
      seed: clan.normalized_short_name || clan.normalized_name || clan.name,
    },
    members: members.slice(0, 5),
    averageElo: members.length ? Math.round(members.reduce((sum, m) => sum + m.elo, 0) / members.length) : 0,
    membersCount: members.length,
  };
}

/** Couleur primaire stable dérivée du tag du clan (hash → palette des rangs). */
export function clanColors(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const index = (hash % 11) + 1;
  return [RANK_COLORS[index] ?? "#959595", RANK_COLORS[index === 11 ? 1 : index + 1] ?? "#959595"];
}

export async function renderClanPoster(
  data: PosterData,
  images?: { logo: Image | null; avatars: Array<Image | null> },
): Promise<Buffer> {
  registerAchilleaFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const [primary, secondary] = clanColors(data.clan.seed);
  const [logo, avatars] = images
    ? [images.logo, images.avatars]
    : await Promise.all([fetchImage(data.clan.avatarUrl), Promise.all(data.members.map(m => fetchImage(m.avatarUrl)))]);

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#0b0b10");
  bg.addColorStop(1, "#1b1320");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const accent = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  accent.addColorStop(0, hexWithAlpha(primary, 0.55));
  accent.addColorStop(1, hexWithAlpha(secondary, 0.4));
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = hexWithAlpha(primary, 0.9);
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, WIDTH - 40, HEIGHT - 40);

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(40, 40, WIDTH - 80, 140);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 64px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ACHILLÉA — CLAN", WIDTH / 2, 100);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `28px ${FONT_SANS}`;
  ctx.fillText(`Affiche officielle · #${data.clan.id}`, WIDTH / 2, 150);

  const logoSize = 280;
  const lx = (WIDTH - logoSize) / 2;
  const ly = 220;
  drawCircleImage(ctx, logo, lx, ly, logoSize);
  ctx.beginPath();
  ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2 + 6, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  const ny = ly + logoSize + 60;
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 88px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(truncate(data.clan.name, 22), WIDTH / 2, ny);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `44px ${FONT_SANS}`;
  ctx.fillText(`[${data.clan.shortenedName}]`, WIDTH / 2, ny + 70);

  const top = ly + logoSize + 220;
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 48px ${FONT_SANS}`;
  ctx.fillText("TOP 5 MEMBRES", WIDTH / 2, top);
  const rowHeight = 130;
  const padX = 80;
  const rowWidth = WIDTH - padX * 2;
  if (data.members.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `36px ${FONT_SANS}`;
    ctx.fillText("Aucun membre classé", WIDTH / 2, top + 130);
  }
  for (const [i, member] of data.members.entries()) {
    const y = top + 70 + i * rowHeight;
    const color = RANK_COLORS[member.rankIndex] ?? "#959595";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, padX, y, rowWidth, rowHeight - 14, 24);
    ctx.fill();
    const size = rowHeight - 40;
    const ax = padX + 24;
    drawCircleImage(ctx, avatars[i] ?? null, ax, y + 13, size, "#3a2f44");
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 40px ${FONT_SANS}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(member.displayName, 22), ax + size + 30, y + 50);
    ctx.fillStyle = color;
    ctx.font = `28px ${FONT_SANS}`;
    ctx.fillText(`${RANK_NAMES[member.rankIndex]} · ${member.elo} ELO`, ax + size + 30, y + 90);
    ctx.font = `bold 64px ${FONT_SANS}`;
    ctx.textAlign = "right";
    ctx.fillText(`#${i + 1}`, padX + rowWidth - 32, y + (rowHeight - 14) / 2);
  }

  const fy = HEIGHT - 180;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(40, fy, WIDTH - 80, 140);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 40px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`ELO moyen : ${data.averageElo}`, 80, fy + 50);
  ctx.fillText(`Membres : ${data.membersCount}`, 80, fy + 100);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `28px ${FONT_SANS}`;
  ctx.fillText(`Généré le ${new Date().toISOString().slice(0, 10)}`, WIDTH - 80, fy + 100);
  ctx.fillText(websiteHost(), WIDTH - 80, fy + 50);

  return canvas.toBuffer("image/png");
}
