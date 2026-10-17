import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { Card } from "primeng/card";
import { Button } from "primeng/button";
import { Tag } from "primeng/tag";
import { ProgressSpinner } from "primeng/progressspinner";

import { LicenseService } from "../../shared/services/license-service";
import { UserService } from "../../shared/services/user-service";
import { apiUrl } from "../../core/http/api-url";
import { LicenseStatus } from "../../core/models/License";

@Component({
	selector: "app-licence",
	standalone: true,
	imports: [CommonModule, Card, Button, Tag, ProgressSpinner],
	templateUrl: "./licence.html",
})
export class Licence implements OnInit {
	private licenseSvc = inject(LicenseService);
	private user = inject(UserService);
	private router = inject(Router);

	readonly license = this.licenseSvc.myLicense;
	readonly loading = signal<boolean>(true);

	// Lien direct vers le PDF (cible d'un <a href> _blank), préfixé par apiUrl().
	readonly pdfHref = computed(() => {
		const l = this.license();
		return l ? apiUrl(`/api/licenses/${l.id}.pdf`) : "";
	});

	async ngOnInit(): Promise<void> {
		await this.user.loadUserIfNeeded();
		if (!this.user.user()) {
			void this.router.navigate(["/auth"]);
			return;
		}
		this.loading.set(true);
		await this.licenseSvc.loadMyLicense();
		this.loading.set(false);
	}

	statusSeverity(status: LicenseStatus): "success" | "danger" | "secondary" {
		if (status === "Active") return "success";
		if (status === "Revoked") return "danger";
		return "secondary";
	}

	statusLabel(status: LicenseStatus): string {
		if (status === "Active") return "Active";
		if (status === "Revoked") return "Révoquée";
		return "Expirée";
	}
}
