import { Component, Input } from "@angular/core";
import { Tag } from "primeng/tag";
import { Button } from "primeng/button";
import { Tooltip } from "primeng/tooltip";

import type { CasterPublic } from "../../../core/models/Cast";

@Component({
	selector: "app-cast-card",
	standalone: true,
	imports: [Tag, Button, Tooltip],
	templateUrl: "./cast-card.html",
	styleUrl: "./cast-card.css",
})
export class CastCard {
	@Input() caster!: CasterPublic;

	get avatarSrc(): string {
		return this.caster.avatar ?? "https://cdn.discordapp.com/embed/avatars/0.png";
	}
}
