import { Component, OnInit, inject, signal } from "@angular/core";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { RouterLink } from "@angular/router";

import { AdminOpsService } from "../../../shared/services/admin-ops-service";

@Component({
	selector: "app-admin-leagues-tab",
	standalone: true,
	imports: [TableModule, Button, RouterLink],
	templateUrl: "./leagues-tab.html",
})
export class AdminLeaguesTabComponent implements OnInit {
	private ops = inject(AdminOpsService);
	readonly items = signal<any[]>([]);
	readonly astral = signal<any>(null);
	readonly loading = signal(false);

	async ngOnInit() {
		await this.reload();
	}

	async reload() {
		this.loading.set(true);
		try {
			const [list, detail] = await Promise.all([this.ops.loadLeagues(), this.ops.loadAstral()]);
			this.items.set(list.items as any[]);
			this.astral.set(detail);
		} catch {
			this.items.set([]);
			this.astral.set(null);
		} finally {
			this.loading.set(false);
		}
	}
}
