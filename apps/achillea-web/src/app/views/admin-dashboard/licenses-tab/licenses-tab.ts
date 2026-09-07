import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Card } from "primeng/card";
import { Button } from "primeng/button";
import { InputText } from "primeng/inputtext";
import { Tag } from "primeng/tag";

import { LicenseService } from "../../../shared/services/license-service";
import { License } from "../../../core/models/License";

@Component({
	selector: "app-licenses-tab",
	standalone: true,
	imports: [CommonModule, FormsModule, Card, Button, InputText, Tag],
	templateUrl: "./licenses-tab.html",
})
export class LicensesTabComponent {
	private licenseSvc = inject(LicenseService);

	readonly issueUserId = signal<string>("");
	readonly revokeId = signal<string>("");
	readonly issuing = signal<boolean>(false);
	readonly revoking = signal<boolean>(false);
	readonly lastIssued = signal<License | null>(null);
	readonly lastRevoked = signal<License | null>(null);

	// Émet une licence pour un userId Discord.
	async issue(): Promise<void> {
		const uid = this.issueUserId().trim();
		if (!uid) return;
		this.issuing.set(true);
		const res = await this.licenseSvc.adminIssue(uid);
		this.issuing.set(false);
		if (res) {
			this.lastIssued.set(res);
			this.issueUserId.set("");
		}
	}

	// Révoque une licence par son identifiant.
	async revoke(): Promise<void> {
		const id = this.revokeId().trim();
		if (!id) return;
		this.revoking.set(true);
		const res = await this.licenseSvc.adminRevoke(id);
		this.revoking.set(false);
		if (res) {
			this.lastRevoked.set(res);
			this.revokeId.set("");
		}
	}
}
