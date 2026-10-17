import { Component, computed, input, signal } from "@angular/core";
import { Avatar } from "primeng/avatar";
import {
	discordDefaultAvatarUrl,
	resolveDiscordAvatarUrl,
} from "../../../core/helpers/discord-avatar";

/**
 * Avatar Discord robuste : normalise l'URL CDN et bascule sur l'embed
 * par défaut si l'image 404 (hash d'avatar périmé).
 */
@Component({
	selector: "app-user-avatar",
	imports: [Avatar],
	template: `
		<p-avatar
			[image]="displaySrc()"
			[label]="showLabel() ? initial() : undefined"
			[shape]="shape()"
			[size]="size()"
			[styleClass]="styleClass()"
			(onImageError)="markBroken()"
		/>
	`,
})
export class UserAvatar {
	userId = input<string | null | undefined>(undefined);
	avatar = input<string | null | undefined>(undefined);
	/** Nom pour initiale de secours si pas d'image. */
	name = input<string | null | undefined>(undefined);
	shape = input<"square" | "circle">("circle");
	size = input<"normal" | "large" | "xlarge" | undefined>("normal");
	styleClass = input<string>("");

	private broken = signal(false);

	displaySrc = computed(() => {
		if (this.broken()) {
			return discordDefaultAvatarUrl(this.userId() ?? "0");
		}
		return resolveDiscordAvatarUrl(this.userId(), this.avatar());
	});

	initial = computed(() => {
		const n = (this.name() ?? "?").trim();
		return n.charAt(0).toUpperCase() || "?";
	});

	/** Si l'image casse, on bascule sur l'embed (toujours une URL) — pas de label. */
	showLabel = computed(() => false);

	markBroken() {
		if (!this.broken()) this.broken.set(true);
	}
}
