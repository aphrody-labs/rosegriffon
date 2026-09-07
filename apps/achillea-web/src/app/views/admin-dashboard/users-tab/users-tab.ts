import { Component, OnInit, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { InputText } from "primeng/inputtext";
import { Select } from "primeng/select";
import { Tag } from "primeng/tag";
import { RouterLink } from "@angular/router";

import { AdminOpsService, type AdminUserRow } from "../../../shared/services/admin-ops-service";

@Component({
	selector: "app-admin-users-tab",
	standalone: true,
	imports: [DatePipe, FormsModule, TableModule, Button, InputText, Select, Tag, RouterLink],
	templateUrl: "./users-tab.html",
})
export class AdminUsersTabComponent implements OnInit {
	private ops = inject(AdminOpsService);
	readonly rows = signal<AdminUserRow[]>([]);
	readonly total = signal(0);
	readonly loading = signal(false);
	q = "";
	page = 1;
	readonly pageSize = 25;

	roleOptions = [
		{ label: "Membre (0)", value: 0 },
		{ label: "Modérateur (1)", value: 1 },
		{ label: "Admin (2)", value: 2 },
		{ label: "Super-Admin (3)", value: 3 },
	];

	async ngOnInit() {
		await this.reload();
	}

	async reload() {
		this.loading.set(true);
		try {
			const res = await this.ops.listUsers(this.page, this.pageSize, this.q);
			this.rows.set(res.data);
			this.total.set(res.meta.total);
		} catch {
			this.rows.set([]);
			this.total.set(0);
		} finally {
			this.loading.set(false);
		}
	}

	async onPage(e: { first?: number; rows?: number }) {
		const rows = e.rows ?? this.pageSize;
		this.page = Math.floor((e.first ?? 0) / rows) + 1;
		await this.reload();
	}

	async setRole(u: AdminUserRow, role: number) {
		if (await this.ops.setUserRole(u.id, role)) await this.reload();
	}

	roleLabel(r: number) {
		return this.roleOptions.find((o) => o.value === r)?.label ?? String(r);
	}
}
