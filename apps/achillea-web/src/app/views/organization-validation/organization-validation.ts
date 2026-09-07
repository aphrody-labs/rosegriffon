import { Component, OnInit, inject, signal } from "@angular/core";
import { OrganizerForm } from "../../shared/components/organizer-form/organizer-form";
import { OrganizationDTO, OrganizationFormMode } from "../../core/models/Organization";
import { OrganizationService } from "../../shared/services/organization-service";
import { ActivatedRoute, Router } from "@angular/router";
import { ProgressSpinner } from "primeng/progressspinner";
import { Button } from "primeng/button";

@Component({
	selector: "app-organization-validation",
	imports: [OrganizerForm, ProgressSpinner, Button],
	templateUrl: "./organization-validation.html",
	styleUrl: "./organization-validation.css",
})
export class OrganizationValidation implements OnInit {
	private orgService = inject(OrganizationService);
	private route = inject(ActivatedRoute);
	private router = inject(Router);

	org: OrganizationDTO | undefined;
	orgId: number | null = null;
	protected readonly busy = signal(false);

	// Approuve l'organisation (état Approved) puis revient au dashboard.
	protected async approve(): Promise<void> {
		if (!this.orgId) return;
		this.busy.set(true);
		const ok = await this.orgService.approveOrganization(this.orgId);
		this.busy.set(false);
		if (ok) await this.router.navigate(["/admins/dashboard"]);
	}

	// Rejette l'organisation (état Rejected) puis revient au dashboard.
	protected async reject(): Promise<void> {
		if (!this.orgId) return;
		this.busy.set(true);
		const ok = await this.orgService.rejectOrganization(this.orgId);
		this.busy.set(false);
		if (ok) await this.router.navigate(["/admins/dashboard"]);
	}

	async ngOnInit() {
		// Subscribes to changes in route parameters
		this.route.paramMap.subscribe(async (params) => {
			this.orgId = Number.parseInt(params.get("id") ?? "0");

			if (this.orgId == null || this.orgId < 1) return await this.router.navigate(["/not-found"]);

			// Perform logic (e.g., fetch data) whenever the ID changes
			const res = await this.orgService.getOrganization(this.orgId);

			this.org = res?.data;

			if (this.org === undefined) return await this.router.navigate(["/not-found"]);

			return;
		});
	}

	protected readonly OrganizationFormMode = OrganizationFormMode;
}
