import { Component, OnInit, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";
import { RouterLink } from "@angular/router";

import { AdminOpsService } from "../../../shared/services/admin-ops-service";

@Component({
	selector: "app-admin-casts-tab",
	standalone: true,
	imports: [DatePipe, TableModule, Button, Tag, RouterLink],
	templateUrl: "./casts-tab.html",
})
export class AdminCastsTabComponent implements OnInit {
	private ops = inject(AdminOpsService);
	readonly events = signal<any[]>([]);
	readonly total = signal(0);
	readonly loading = signal(false);

	async ngOnInit() {
		await this.reload();
	}

	async reload() {
		this.loading.set(true);
		try {
			const r = await this.ops.loadCasts(1, 40);
			this.events.set(r.data as any[]);
			this.total.set(r.total);
		} catch {
			this.events.set([]);
			this.total.set(0);
		} finally {
			this.loading.set(false);
		}
	}
}
