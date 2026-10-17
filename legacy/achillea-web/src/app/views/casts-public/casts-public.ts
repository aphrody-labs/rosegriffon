import { Component, OnInit, signal, inject } from "@angular/core";

import { CastCard } from "../../shared/components/cast-card/cast-card";
import { CastService } from "../../shared/services/cast-service";
import type { CasterPublic } from "../../core/models/Cast";

@Component({
	selector: "app-casts-public",
	standalone: true,
	imports: [CastCard],
	templateUrl: "./casts-public.html",
	styleUrl: "./casts-public.css",
})
export class CastsPublicComponent implements OnInit {
	private castService = inject(CastService);

	casters = signal<CasterPublic[]>([]);
	loading = signal(true);

	ngOnInit(): void {
		this.castService.listCasters().subscribe({
			next: (data) => {
				this.casters.set(data);
				this.loading.set(false);
			},
			error: () => this.loading.set(false),
		});
	}
}
