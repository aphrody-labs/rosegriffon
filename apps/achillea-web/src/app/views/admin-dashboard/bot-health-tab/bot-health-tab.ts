import { Component, OnInit, inject, signal, computed } from "@angular/core";
import { DecimalPipe, JsonPipe } from "@angular/common";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";
import { TableModule } from "primeng/table";

import { AdminOpsService } from "../../../shared/services/admin-ops-service";

@Component({
	selector: "app-admin-bot-health-tab",
	standalone: true,
	imports: [DecimalPipe, JsonPipe, Button, Tag, TableModule],
	templateUrl: "./bot-health-tab.html",
})
export class AdminBotHealthTabComponent implements OnInit {
	private ops = inject(AdminOpsService);
	readonly health = signal<any>(null);
	readonly metrics = signal<{ counters: Record<string, number>; rawLines: number } | null>(null);
	readonly loading = signal(false);
	readonly logs = signal<string[] | null>(null);
	readonly logsLoading = signal(false);

	readonly counterRows = computed(() => {
		const c = this.metrics()?.counters ?? {};
		return Object.entries(c)
			.map(([name, value]) => ({ name, value }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	async ngOnInit() {
		await this.reload();
	}

	async reload() {
		this.loading.set(true);
		try {
			const [h, m] = await Promise.all([
				this.ops.loadHealth(),
				this.ops.loadMetricsSummary().catch(() => null),
			]);
			this.health.set(h);
			this.metrics.set(m);
		} catch {
			this.health.set(null);
			this.metrics.set(null);
		} finally {
			this.loading.set(false);
		}
	}

	async loadLogs() {
		this.logsLoading.set(true);
		try {
			const r = await this.ops.loadLogs();
			this.logs.set(r.data);
		} catch {
			this.logs.set(null);
		} finally {
			this.logsLoading.set(false);
		}
	}

	async toggleMaintenance() {
		const cur = !!this.health()?.bot?.maintenance;
		if (await this.ops.setMaintenance(!cur)) await this.reload();
	}

	uptimeLabel(ms: number | undefined) {
		if (!ms) return "—";
		const s = Math.floor(ms / 1000);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		return `${h}h ${m}m`;
	}
}
