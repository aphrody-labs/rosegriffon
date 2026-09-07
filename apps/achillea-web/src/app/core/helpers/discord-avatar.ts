/**
 * Helpers avatar Discord côté front (miroir bot).
 * Les URLs CDN expirent quand le joueur change d'avatar — toujours prévoir un fallback.
 */

const EMBED = "https://cdn.discordapp.com/embed/avatars";
const AVATAR_CDN = "https://cdn.discordapp.com/avatars";

export function discordDefaultAvatarIndex(userId: string): number {
	try {
		return Number((BigInt(userId) >> 22n) % 6n);
	} catch {
		return 0;
	}
}

export function discordDefaultAvatarUrl(userId: string): string {
	return `${EMBED}/${discordDefaultAvatarIndex(userId)}.png`;
}

export function resolveDiscordAvatarUrl(
	userId: string | null | undefined,
	avatar: string | null | undefined
): string {
	const id = userId?.trim() || "0";
	const raw = (avatar ?? "").trim();
	if (!raw) return discordDefaultAvatarUrl(id);

	if (!/^https?:\/\//i.test(raw)) {
		const hash = raw.replace(/\.(gif|png|webp|jpg|jpeg)$/i, "");
		const ext = hash.startsWith("a_") ? "gif" : "webp";
		return `${AVATAR_CDN}/${id}/${hash}.${ext}?size=256`;
	}

	const fixed = raw.replace(
		/(\/avatars\/\d+\/a_[a-f0-9]+)\.(webp|png|jpg|jpeg)(\?[^#]*)?$/i,
		"$1.gif$3"
	);

	if (/cdn\.discordapp\.com\/avatars\//i.test(fixed) && !/[?&]size=/.test(fixed)) {
		return fixed.includes("?") ? `${fixed}&size=256` : `${fixed}?size=256`;
	}

	return fixed;
}

/** Handler `(error)` pour <img> / p-avatar host — bascule vers l'embed Discord. */
export function onDiscordAvatarError(event: Event, userId?: string | null): void {
	const el = event.target as HTMLImageElement | null;
	if (!el || el.dataset["avatarFallback"] === "1") return;
	el.dataset["avatarFallback"] = "1";
	el.src = discordDefaultAvatarUrl(userId ?? "0");
}
