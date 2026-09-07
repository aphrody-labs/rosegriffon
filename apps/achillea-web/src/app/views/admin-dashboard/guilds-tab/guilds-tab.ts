import { Component, OnInit, inject, signal } from "@angular/core";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";

import { AdminOpsService } from "../../../shared/services/admin-ops-service";

interface GuildRow {
	id: string;
	name: string;
	iconURL: string | null;
	memberCount: number;
	ownerId: string;
	createdAt: string | null;
}

interface CommandRow {
	name: string;
	description?: string;
	type: number;
}

@Component({
	selector: "app-admin-guilds-tab",
	standalone: true,
	imports: [TableModule, Button, Tag],
	templateUrl: "./guilds-tab.html",
})
export class AdminGuildsTabComponent implements OnInit {
	private ops = inject(AdminOpsService);

	readonly guilds = signal<GuildRow[]>([]);
	readonly commands = signal<CommandRow[]>([]);
	readonly loading = signal(false);
	readonly invitingId = signal<string | null>(null);
	readonly lastInvite = signal<{ guildId: string; url: string } | null>(null);

	async ngOnInit() {
		await this.reload();
	}

	async reload() {
		this.loading.set(true);
		try {
			const [g, c] = await Promise.all([this.ops.loadGuilds(), this.ops.loadCommands()]);
			this.guilds.set(g.data);
			this.commands.set(c.data);
		} catch {
			this.guilds.set([]);
			this.commands.set([]);
		} finally {
			this.loading.set(false);
		}
	}

	async invite(guild: GuildRow) {
		this.invitingId.set(guild.id);
		this.lastInvite.set(null);
		const url = await this.ops.createGuildInvite(guild.id);
		if (url) this.lastInvite.set({ guildId: guild.id, url });
		this.invitingId.set(null);
	}

	async copyInvite(url: string) {
		try {
			await navigator.clipboard.writeText(url);
		} catch {
			// pas de presse-papier disponible (contexte non sécurisé) — l'URL reste affichée à l'écran
		}
	}
}
