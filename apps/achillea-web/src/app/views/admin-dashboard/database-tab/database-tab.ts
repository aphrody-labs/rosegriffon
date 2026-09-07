import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { TableModule } from "primeng/table";
import { Button } from "primeng/button";
import { InputText } from "primeng/inputtext";
import { Textarea } from "primeng/textarea";
import { Dialog } from "primeng/dialog";
import { Tag } from "primeng/tag";
import { Message } from "primeng/message";
import { MessageService, ConfirmationService } from "primeng/api";
import { ConfirmDialog } from "primeng/confirmdialog";

import { AdminOpsService, DbColumn } from "../../../shared/services/admin-ops-service";

type FieldKind = "boolean" | "number" | "json" | "text";

function kindOf(dataType: string): FieldKind {
	const t = dataType.toLowerCase();
	if (t === "boolean") return "boolean";
	// json/jsonb et colonnes tableau Postgres (ex. founders, languages) : édition
	// via JSON.parse/stringify — un tableau JS est sérialisé nativement en array
	// Postgres par le driver.
	if (t.includes("json") || t === "array") return "json";
	if (
		t.includes("int") ||
		t.includes("numeric") ||
		t.includes("real") ||
		t.includes("double") ||
		t.includes("decimal")
	) {
		return "number";
	}
	return "text";
}

/**
 * "Base de données" — éditeur générique de tables Supabase depuis le
 * dashboard admin (SuperAdmin uniquement, cf. AdminDatabaseController).
 * Parcours de table + édition ligne par ligne + console SQL lecture seule.
 */
@Component({
	selector: "app-admin-database-tab",
	standalone: true,
	imports: [
		FormsModule,
		TableModule,
		Button,
		InputText,
		Textarea,
		Dialog,
		Tag,
		Message,
		ConfirmDialog,
	],
	providers: [ConfirmationService],
	templateUrl: "./database-tab.html",
})
export class AdminDatabaseTabComponent implements OnInit {
	private ops = inject(AdminOpsService);
	private msg = inject(MessageService);
	private confirm = inject(ConfirmationService);

	readonly mode = signal<"browse" | "sql">("browse");
	readonly tables = signal<Array<{ name: string; estimatedRows: number; protected: boolean }>>([]);
	readonly tablesLoading = signal(false);
	readonly tableFilter = signal("");

	readonly filteredTables = computed(() => {
		const q = this.tableFilter().trim().toLowerCase();
		const all = this.tables();
		return q ? all.filter((t) => t.name.toLowerCase().includes(q)) : all;
	});

	readonly selectedTable = signal<string | null>(null);
	readonly columns = signal<DbColumn[]>([]);
	readonly rows = signal<Array<Record<string, unknown>>>([]);
	readonly rowsLoading = signal(false);
	readonly page = signal(1);
	readonly limit = 25;
	readonly total = signal(0);
	readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

	readonly hasPk = computed(() => this.columns().some((c) => c.isPrimaryKey));

	// Dialog édition / insertion (formulaire générique piloté par les colonnes).
	readonly editOpen = signal(false);
	readonly editIsNew = signal(false);
	readonly editSaving = signal(false);
	editValues: Record<string, string> = {};
	private editPk: Record<string, unknown> = {};

	// Console SQL (lecture seule).
	sqlText = "SELECT * FROM ";
	readonly sqlRunning = signal(false);
	readonly sqlColumns = signal<string[]>([]);
	readonly sqlRows = signal<Array<Record<string, unknown>>>([]);
	readonly sqlMeta = signal<{ rowCount: number; durationMs: number } | null>(null);

	async ngOnInit() {
		await this.loadTables();
	}

	async loadTables() {
		this.tablesLoading.set(true);
		try {
			const res = await this.ops.dbListTables();
			this.tables.set(res.data);
		} catch {
			this.tables.set([]);
		}
		this.tablesLoading.set(false);
	}

	async selectTable(name: string) {
		this.selectedTable.set(name);
		this.page.set(1);
		await this.loadRows();
	}

	rowColumnNames = computed(() => this.columns().map((c) => c.name));

	async loadRows() {
		const table = this.selectedTable();
		if (!table) return;
		this.rowsLoading.set(true);
		try {
			const res = await this.ops.dbRows(table, this.page(), this.limit);
			this.columns.set(res.columns);
			this.rows.set(res.data);
			this.total.set(res.meta.total);
		} catch {
			this.rows.set([]);
			this.total.set(0);
		}
		this.rowsLoading.set(false);
	}

	async nextPage() {
		if (this.page() >= this.pageCount()) return;
		this.page.update((p) => p + 1);
		await this.loadRows();
	}

	async prevPage() {
		if (this.page() <= 1) return;
		this.page.update((p) => p - 1);
		await this.loadRows();
	}

	fieldKind(col: DbColumn): FieldKind {
		return kindOf(col.dataType);
	}

	private stringifyForEdit(value: unknown, kind: FieldKind): string {
		if (value === null || value === undefined) return "";
		if (kind === "json") return JSON.stringify(value, null, 2);
		return String(value);
	}

	openInsert() {
		this.editIsNew.set(true);
		this.editPk = {};
		this.editValues = {};
		for (const c of this.columns()) {
			if (c.isPrimaryKey && c.default) continue; // laisse la base générer (uuid/serial)
			this.editValues[c.name] = "";
		}
		this.editOpen.set(true);
	}

	openEdit(row: Record<string, unknown>) {
		this.editIsNew.set(false);
		const pk: Record<string, unknown> = {};
		const values: Record<string, string> = {};
		for (const c of this.columns()) {
			const kind = this.fieldKind(c);
			if (c.isPrimaryKey) pk[c.name] = row[c.name];
			values[c.name] = this.stringifyForEdit(row[c.name], kind);
		}
		this.editPk = pk;
		this.editValues = values;
		this.editOpen.set(true);
	}

	closeEdit() {
		this.editOpen.set(false);
	}

	private parseForSave(raw: string, kind: FieldKind): unknown {
		if (kind === "boolean") return raw === "true";
		if (kind === "number") return raw === "" ? null : Number(raw);
		if (kind === "json") return raw.trim() === "" ? null : JSON.parse(raw);
		return raw === "" ? null : raw;
	}

	async saveEdit() {
		const table = this.selectedTable();
		if (!table) return;
		this.editSaving.set(true);
		try {
			const values: Record<string, unknown> = {};
			for (const c of this.columns()) {
				if (!this.editIsNew() && c.isPrimaryKey) continue;
				if (this.editIsNew() && c.isPrimaryKey && !(c.name in this.editValues)) continue;
				const raw = this.editValues[c.name] ?? "";
				try {
					values[c.name] = this.parseForSave(raw, this.fieldKind(c));
				} catch {
					this.msg.add({
						severity: "error",
						summary: "Champ invalide",
						detail: `"${c.name}" : JSON invalide.`,
						life: 6000,
					});
					this.editSaving.set(false);
					return;
				}
			}

			const res = this.editIsNew()
				? await this.ops.dbInsertRow(table, values)
				: await this.ops.dbUpdateRow(table, this.editPk, values);

			if (res) {
				this.editOpen.set(false);
				await this.loadRows();
			}
		} finally {
			this.editSaving.set(false);
		}
	}

	confirmDelete(row: Record<string, unknown>) {
		this.confirm.confirm({
			header: "Supprimer cette ligne ?",
			message: "Action irréversible — la ligne sera définitivement supprimée.",
			acceptLabel: "Supprimer",
			rejectLabel: "Annuler",
			acceptButtonProps: { severity: "danger" },
			accept: () => this.deleteRow(row),
		});
	}

	private async deleteRow(row: Record<string, unknown>) {
		const table = this.selectedTable();
		if (!table) return;
		const pk: Record<string, unknown> = {};
		for (const c of this.columns()) if (c.isPrimaryKey) pk[c.name] = row[c.name];
		const ok = await this.ops.dbDeleteRow(table, pk);
		if (ok) await this.loadRows();
	}

	cellPreview(value: unknown): string {
		if (value === null || value === undefined) return "—";
		if (typeof value === "object") return JSON.stringify(value);
		const s = String(value);
		return s.length > 80 ? s.slice(0, 80) + "…" : s;
	}

	async runSql() {
		this.sqlRunning.set(true);
		try {
			const res = await this.ops.dbQuery(this.sqlText);
			if (res) {
				this.sqlRows.set(res.data);
				this.sqlColumns.set(res.data.length > 0 ? Object.keys(res.data[0]) : []);
				this.sqlMeta.set({ rowCount: res.rowCount, durationMs: res.durationMs });
			}
		} finally {
			this.sqlRunning.set(false);
		}
	}
}
