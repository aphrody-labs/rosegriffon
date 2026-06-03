import { createCanvas } from "@aphrody-code/canvas";

import { ensureFonts, RG_THEME as T } from "./theme.js";
import {
	drawCircularImage,
	drawCoveredImage,
	ellipsize,
	fallbackInitial,
	fillRoundedRect,
	fillWrappedText,
	strokeRoundedRect,
} from "./utils.js";

const W = 1200;

interface HeaderOptions {
	title: string;
	subtitle?: string;
	badge?: string;
}

function drawHeader(
	ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
	opts: HeaderOptions
): number {
	const headerH = 110;
	fillRoundedRect(ctx, 0, 0, W, headerH, 0, T.brand);

	ctx.fillStyle = T.fgInverse;
	ctx.font = `52px "${T.fontTitle}", ${T.fontFallback}`;
	ctx.textBaseline = "alphabetic";
	ctx.fillText(opts.title, 40, 70);

	if (opts.subtitle) {
		ctx.fillStyle = "rgba(255,255,255,0.85)";
		ctx.font = `22px ${T.fontBody}`;
		ctx.fillText(opts.subtitle, 40, 96);
	}

	if (opts.badge) {
		ctx.font = `bold 18px ${T.fontBody}`;
		const tw = ctx.measureText(opts.badge).width;
		const bw = tw + 32;
		const bh = 36;
		const bx = W - 40 - bw;
		const by = (headerH - bh) / 2;
		fillRoundedRect(ctx, bx, by, bw, bh, 18, "rgba(255,255,255,0.18)");
		ctx.fillStyle = T.fgInverse;
		ctx.textBaseline = "middle";
		ctx.fillText(opts.badge, bx + 16, by + bh / 2 + 1);
		ctx.textBaseline = "alphabetic";
	}

	return headerH;
}

function drawFooter(
	ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
	height: number,
	text = "rosegriffon.fr"
): void {
	ctx.fillStyle = T.fgMuted;
	ctx.font = `18px ${T.fontBody}`;
	ctx.textBaseline = "alphabetic";
	ctx.fillText(text, 40, height - 24);
}

function drawCardShell(
	ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
	x: number,
	y: number,
	w: number,
	h: number
): void {
	fillRoundedRect(ctx, x, y, w, h, T.radiusMd, T.card);
	strokeRoundedRect(ctx, x, y, w, h, T.radiusMd, T.cardBorder, 1);
}

async function drawAvatarOrInitial(
	ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
	src: string | null,
	cx: number,
	cy: number,
	r: number,
	name: string
): Promise<void> {
	let drawn = false;
	if (src) drawn = await drawCircularImage(ctx, src, cx, cy, r);
	if (!drawn) {
		fillRoundedRect(ctx, cx - r, cy - r, r * 2, r * 2, r, T.surfaceMuted);
		ctx.fillStyle = T.brand;
		ctx.font = `bold ${Math.round(r * 1.1)}px "${T.fontTitle}", ${T.fontFallback}`;
		ctx.textBaseline = "middle";
		ctx.textAlign = "center";
		ctx.fillText(fallbackInitial(name), cx, cy + 2);
		ctx.textAlign = "left";
		ctx.textBaseline = "alphabetic";
	}
	// Outer ring
	ctx.save();
	ctx.beginPath();
	ctx.strokeStyle = T.brand;
	ctx.lineWidth = 3;
	ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

// ─── Team grid ─────────────────────────────────────────────────────────

export interface TeamCardData {
	name: string;
	role: string;
	image_url: string | null;
}

export async function renderTeamGrid(
	members: TeamCardData[],
	title: string,
	subtitle?: string
): Promise<Buffer> {
	ensureFonts();
	const cols = members.length <= 4 ? 2 : 3;
	const rows = Math.ceil(members.length / cols);
	const cardW = (W - 40 * 2 - 24 * (cols - 1)) / cols;
	const cardH = 220;
	const headerH = 110;
	const footerH = 50;
	const H = headerH + 30 + rows * (cardH + 24) - 24 + footerH;
	const canvas = createCanvas(W, Math.max(H, 400));
	const ctx = canvas.getContext("2d");

	ctx.fillStyle = T.background;
	ctx.fillRect(0, 0, W, canvas.height);

	drawHeader(ctx, {
		title,
		subtitle,
		badge: `${members.length} membre${members.length > 1 ? "s" : ""}`,
	});

	for (let i = 0; i < members.length; i++) {
		const m = members[i]!;
		const col = i % cols;
		const row = Math.floor(i / cols);
		const x = 40 + col * (cardW + 24);
		const y = headerH + 30 + row * (cardH + 24);

		drawCardShell(ctx, x, y, cardW, cardH);

		await drawAvatarOrInitial(ctx, m.image_url, x + 70, y + cardH / 2, 50, m.name);

		ctx.textBaseline = "alphabetic";
		ctx.fillStyle = T.fg;
		ctx.font = `bold 26px "${T.fontTitle}", ${T.fontFallback}`;
		ctx.fillText(ellipsize(ctx, m.name, cardW - 160), x + 140, y + 80);

		ctx.fillStyle = T.brand;
		ctx.font = `18px ${T.fontBody}`;
		fillWrappedText(ctx, m.role, x + 140, y + 112, {
			maxWidth: cardW - 160,
			maxLines: 4,
			lineHeight: 24,
		});
	}

	drawFooter(ctx, canvas.height);
	return await canvas.encode("png");
}

// ─── Profile (single hero card) ────────────────────────────────────────

export interface ProfileCardData {
	username: string | null;
	full_name: string | null;
	avatar_url: string | null;
	banner_url: string | null;
	bio: string | null;
	role: string | null;
	twitter_handle?: string | null;
	website?: string | null;
	discord_id?: string | null;
}

export async function renderProfileCard(p: ProfileCardData): Promise<Buffer> {
	ensureFonts();
	const H = 540;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");

	ctx.fillStyle = T.background;
	ctx.fillRect(0, 0, W, H);

	// Banner
	const bannerH = 220;
	if (p.banner_url) {
		const ok = await drawCoveredImage(ctx, p.banner_url, 0, 0, W, bannerH);
		if (!ok) fillRoundedRect(ctx, 0, 0, W, bannerH, 0, T.brand);
	} else {
		fillRoundedRect(ctx, 0, 0, W, bannerH, 0, T.brand);
	}

	// Card body
	const bodyY = bannerH - 40;
	fillRoundedRect(ctx, 40, bodyY, W - 80, H - bodyY - 40, T.radiusLg, T.card);
	strokeRoundedRect(ctx, 40, bodyY, W - 80, H - bodyY - 40, T.radiusLg, T.cardBorder, 1);

	// Avatar overlapping
	await drawAvatarOrInitial(
		ctx,
		p.avatar_url,
		140,
		bodyY + 0,
		80,
		p.full_name ?? p.username ?? "?"
	);

	// Name + username
	const displayName = p.full_name ?? p.username ?? "Anonyme";
	ctx.fillStyle = T.fg;
	ctx.font = `bold 42px "${T.fontTitle}", ${T.fontFallback}`;
	ctx.fillText(ellipsize(ctx, displayName, W - 320), 250, bodyY + 24);

	if (p.username) {
		ctx.fillStyle = T.fgMuted;
		ctx.font = `22px ${T.fontBody}`;
		ctx.fillText(`@${p.username}`, 250, bodyY + 56);
	}

	// Role badge
	if (p.role) {
		ctx.font = `bold 16px ${T.fontBody}`;
		const rw = ctx.measureText(p.role).width + 24;
		fillRoundedRect(ctx, 250, bodyY + 70, rw, 28, 14, T.brand);
		ctx.fillStyle = T.fgInverse;
		ctx.textBaseline = "middle";
		ctx.fillText(p.role, 262, bodyY + 70 + 14 + 1);
		ctx.textBaseline = "alphabetic";
	}

	// Bio
	ctx.fillStyle = T.fg;
	ctx.font = `22px ${T.fontBody}`;
	fillWrappedText(ctx, p.bio ?? "—", 80, bodyY + 150, {
		maxWidth: W - 160,
		maxLines: 5,
		lineHeight: 32,
	});

	// Footer links
	const linkParts: string[] = [];
	if (p.twitter_handle) linkParts.push(`𝕏 @${p.twitter_handle}`);
	if (p.website) linkParts.push(`🌐 ${p.website}`);
	if (p.discord_id) linkParts.push(`Discord ID ${p.discord_id}`);
	if (linkParts.length > 0) {
		ctx.fillStyle = T.fgMuted;
		ctx.font = `18px ${T.fontBody}`;
		ctx.fillText(ellipsize(ctx, linkParts.join("  •  "), W - 160), 80, H - 70);
	}

	drawFooter(ctx, H);
	return await canvas.encode("png");
}

// ─── Event list ────────────────────────────────────────────────────────

export interface EventCardData {
	title: string;
	description: string | null;
	start_time: Date | string;
	location: string | null;
	image_url: string | null;
}

function fmtFR(d: Date | string): string {
	const date = typeof d === "string" ? new Date(d) : d;
	return date.toLocaleDateString("fr-FR", {
		weekday: "short",
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export async function renderEventList(events: EventCardData[]): Promise<Buffer> {
	ensureFonts();
	const headerH = 110;
	const cardH = 150;
	const gap = 16;
	const footerH = 50;
	const H = headerH + 30 + events.length * (cardH + gap) - gap + footerH;
	const canvas = createCanvas(W, Math.max(H, 400));
	const ctx = canvas.getContext("2d");

	ctx.fillStyle = T.background;
	ctx.fillRect(0, 0, W, canvas.height);

	drawHeader(ctx, {
		title: "Événements à venir",
		subtitle: "Rose Griffon",
		badge: `${events.length}`,
	});

	for (let i = 0; i < events.length; i++) {
		const e = events[i]!;
		const x = 40;
		const y = headerH + 30 + i * (cardH + gap);
		const w = W - 80;

		drawCardShell(ctx, x, y, w, cardH);

		if (e.image_url) {
			await drawCoveredImage(ctx, e.image_url, x + 16, y + 16, 200, cardH - 32, 12);
		} else {
			fillRoundedRect(ctx, x + 16, y + 16, 200, cardH - 32, 12, T.surfaceMuted);
			ctx.fillStyle = T.brand;
			ctx.font = `bold 56px "${T.fontTitle}", ${T.fontFallback}`;
			ctx.textBaseline = "middle";
			ctx.textAlign = "center";
			ctx.fillText("📅", x + 16 + 100, y + cardH / 2);
			ctx.textAlign = "left";
			ctx.textBaseline = "alphabetic";
		}

		ctx.fillStyle = T.fg;
		ctx.font = `bold 28px "${T.fontTitle}", ${T.fontFallback}`;
		ctx.fillText(ellipsize(ctx, e.title, w - 250), x + 232, y + 50);

		ctx.fillStyle = T.brand;
		ctx.font = `bold 18px ${T.fontBody}`;
		ctx.fillText(fmtFR(e.start_time), x + 232, y + 80);

		if (e.location) {
			ctx.fillStyle = T.fgMuted;
			ctx.font = `18px ${T.fontBody}`;
			ctx.fillText(`📍 ${ellipsize(ctx, e.location, w - 350)}`, x + 232, y + 108);
		}

		if (e.description) {
			ctx.fillStyle = T.fgMuted;
			ctx.font = `16px ${T.fontBody}`;
			fillWrappedText(ctx, e.description, x + 232, y + 130, {
				maxWidth: w - 250,
				maxLines: 1,
				lineHeight: 20,
			});
		}
	}

	drawFooter(ctx, canvas.height);
	return await canvas.encode("png");
}

// ─── Chronicle list / detail ───────────────────────────────────────────

export interface ChroniqueCardData {
	title: string;
	slug: string;
	excerpt: string | null;
	category: string;
	views_count: number | null;
	featured_image: string | null;
	created_at: Date | string | null;
}

export async function renderChroniqueList(
	rows: ChroniqueCardData[],
	filterLabel?: string
): Promise<Buffer> {
	ensureFonts();
	const headerH = 110;
	const cardH = 170;
	const gap = 16;
	const footerH = 50;
	const H = headerH + 30 + rows.length * (cardH + gap) - gap + footerH;
	const canvas = createCanvas(W, Math.max(H, 400));
	const ctx = canvas.getContext("2d");

	ctx.fillStyle = T.background;
	ctx.fillRect(0, 0, W, canvas.height);

	drawHeader(ctx, {
		title: "Chroniques",
		subtitle: filterLabel ?? "Dernières publications",
		badge: `${rows.length}`,
	});

	for (let i = 0; i < rows.length; i++) {
		const c = rows[i]!;
		const x = 40;
		const y = headerH + 30 + i * (cardH + gap);
		const w = W - 80;

		drawCardShell(ctx, x, y, w, cardH);

		if (c.featured_image) {
			await drawCoveredImage(ctx, c.featured_image, x + 16, y + 16, 240, cardH - 32, 12);
		} else {
			fillRoundedRect(ctx, x + 16, y + 16, 240, cardH - 32, 12, T.surfaceMuted);
		}

		// Category pill
		ctx.font = `bold 14px ${T.fontBody}`;
		const cw = ctx.measureText(c.category).width + 20;
		fillRoundedRect(ctx, x + 272, y + 20, cw, 26, 13, T.brand);
		ctx.fillStyle = T.fgInverse;
		ctx.textBaseline = "middle";
		ctx.fillText(c.category, x + 282, y + 20 + 13 + 1);
		ctx.textBaseline = "alphabetic";

		ctx.fillStyle = T.fg;
		ctx.font = `bold 28px "${T.fontTitle}", ${T.fontFallback}`;
		ctx.fillText(ellipsize(ctx, c.title, w - 290), x + 272, y + 78);

		if (c.excerpt) {
			ctx.fillStyle = T.fgMuted;
			ctx.font = `18px ${T.fontBody}`;
			fillWrappedText(ctx, c.excerpt, x + 272, y + 108, {
				maxWidth: w - 290,
				maxLines: 2,
				lineHeight: 24,
			});
		}

		const dateSrc = c.created_at || new Date();
		const date = typeof dateSrc === "string" ? new Date(dateSrc) : dateSrc;
		ctx.fillStyle = T.fgMuted;
		ctx.font = `15px ${T.fontBody}`;
		ctx.fillText(
			`${date.toLocaleDateString("fr-FR")} · 👁 ${c.views_count ?? 0}`,
			x + 272,
			y + cardH - 22
		);
	}

	drawFooter(ctx, canvas.height);
	return await canvas.encode("png");
}

// ─── Discord member list ───────────────────────────────────────────────

export interface MemberCardData {
	username: string;
	display_name: string | null;
	avatar_url: string | null;
	roles_count: number;
	joined_at: Date | string | null;
}

export async function renderMemberList(rows: MemberCardData[]): Promise<Buffer> {
	ensureFonts();
	const headerH = 110;
	const rowH = 90;
	const gap = 8;
	const footerH = 50;
	const H = headerH + 24 + rows.length * (rowH + gap) - gap + footerH;
	const canvas = createCanvas(W, Math.max(H, 300));
	const ctx = canvas.getContext("2d");

	ctx.fillStyle = T.background;
	ctx.fillRect(0, 0, W, canvas.height);

	drawHeader(ctx, {
		title: "Membres Discord",
		subtitle: "Rose Griffon",
		badge: `${rows.length}`,
	});

	for (let i = 0; i < rows.length; i++) {
		const m = rows[i]!;
		const x = 40;
		const y = headerH + 24 + i * (rowH + gap);
		const w = W - 80;

		drawCardShell(ctx, x, y, w, rowH);
		await drawAvatarOrInitial(
			ctx,
			m.avatar_url,
			x + 50,
			y + rowH / 2,
			32,
			m.display_name ?? m.username
		);

		ctx.fillStyle = T.fg;
		ctx.font = `bold 22px "${T.fontTitle}", ${T.fontFallback}`;
		ctx.fillText(ellipsize(ctx, m.display_name ?? m.username, w - 250), x + 100, y + 36);

		ctx.fillStyle = T.fgMuted;
		ctx.font = `16px ${T.fontBody}`;
		const tag = m.display_name ? `@${m.username}` : "";
		const joined =
			m.joined_at &&
			(typeof m.joined_at === "string" ? new Date(m.joined_at) : m.joined_at).toLocaleDateString(
				"fr-FR"
			);
		const meta = [tag, joined ? `Rejoint ${joined}` : null].filter(Boolean).join(" · ");
		if (meta) ctx.fillText(ellipsize(ctx, meta, w - 250), x + 100, y + 62);

		// Roles count badge
		ctx.font = `bold 14px ${T.fontBody}`;
		const rb = `${m.roles_count} rôle${m.roles_count > 1 ? "s" : ""}`;
		const rbw = ctx.measureText(rb).width + 18;
		fillRoundedRect(ctx, x + w - rbw - 16, y + rowH / 2 - 14, rbw, 28, 14, T.surfaceMuted);
		ctx.fillStyle = T.brand;
		ctx.textBaseline = "middle";
		ctx.fillText(rb, x + w - rbw - 16 + 9, y + rowH / 2 + 1);
		ctx.textBaseline = "alphabetic";
	}

	drawFooter(ctx, canvas.height);
	return await canvas.encode("png");
}
