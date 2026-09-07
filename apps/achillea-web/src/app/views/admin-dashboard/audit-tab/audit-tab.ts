import { Component, OnInit, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";

import { AdminOpsService } from "../../../shared/services/admin-ops-service";

@Component({
	selector: "app-admin-audit-tab",
	standalone: true,
	imports: [DatePipe, TableModule, Button],
	templateUrl: "./audit-tab.html",
})
export class AdminAuditTabComponent implements OnInit {
	private ops = inject(AdminOpsService);
	readonly rows = signal<any[]>([]);
	readonly loading = signal(false);

	async ngOnInit() {
		await this.reload();
	}

	async reload() {
		this.loading.set(true);
		try {
			const r = await this.ops.loadAudit(80);
			this.rows.set(r.data);
		} catch {
			this.rows.set([]);
		} finally {
			this.loading.set(false);
		}
	}
}
