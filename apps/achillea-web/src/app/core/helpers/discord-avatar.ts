/**
 * Avatars Discord — la résolution d'URL vit dans `@rosegriffon/achillea-core`
 * (pure, partagée avec le bot et les futurs fronts). Ne reste ici que le repli
 * au chargement, qui touche le DOM et n'est donc pas portable.
 */

export {
	discordDefaultAvatarIndex,
	discordDefaultAvatarUrl,
	resolveDiscordAvatarUrl,
} from "@rosegriffon/achillea-core";

import { discordDefaultAvatarUrl } from "@rosegriffon/achillea-core";

/** Handler `(error)` pour <img> / p-avatar host — bascule vers l'embed Discord. */
export function onDiscordAvatarError(event: Event, userId?: string | null): void {
	const el = event.target as HTMLImageElement | null;
	if (!el || el.dataset["avatarFallback"] === "1") return;
	el.dataset["avatarFallback"] = "1";
	el.src = discordDefaultAvatarUrl(userId ?? "0");
}
