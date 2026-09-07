import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { Card } from "primeng/card";
import { ProgressSpinner } from "primeng/progressspinner";

import { LicenseService } from "../../shared/services/license-service";
import { LicenseVerifyReason } from "../../core/models/License";

@Component({
	selector: "app-licence-verify",
	standalone: true,
	imports: [CommonModule, Card, ProgressSpinner],
	templateUrl: "./licence-verify.html",
})
export class LicenceVerify implements OnInit {
	private route = inject(ActivatedRoute);
	private licenseSvc = inject(LicenseService);

	readonly result = this.licenseSvc.verifyResult;
	readonly loading = signal<boolean>(true);

	// Vérification PUBLIQUE : aucune auth requise.
	async ngOnInit(): Promise<void> {
		const qr = this.route.snapshot.paramMap.get("qr") ?? "";
		this.loading.set(true);
		await this.licenseSvc.verify(qr);
		this.loading.set(false);
	}

	reasonLabel(reason: LicenseVerifyReason | undefined): string {
		if (reason === "revoked") return "Cette licence a été révoquée.";
		if (reason === "expired") return "Cette licence est expirée.";
		return "Licence introuvable.";
	}
}
