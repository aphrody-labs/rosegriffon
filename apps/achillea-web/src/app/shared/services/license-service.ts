import { Injectable, signal, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { MessageService } from "primeng/api";

import { License, LicenseVerifyResult } from "../../core/models/License";

@Injectable({ providedIn: "root" })
export class LicenseService {
	private http = inject(HttpClient);
	private msg = inject(MessageService);

	private readonly API = "/api/licenses";

	// Licence du joueur connecté (null tant que non chargée ou inexistante).
	readonly myLicense = signal<License | null>(null);
	// Résultat de la dernière vérification publique de QR.
	readonly verifyResult = signal<LicenseVerifyResult | null>(null);

	// Charge la licence du joueur connecté. Le backend renvoie { license: null }
	// quand aucune licence n'a encore été émise.
	async loadMyLicense(): Promise<License | null> {
		try {
			const resp = await firstValueFrom(
				this.http.get<{ license: License | null }>(`${this.API}/me`, {
					withCredentials: true,
				})
			);
			const license = resp.license ?? null;
			this.myLicense.set(license);
			return license;
		} catch {
			this.myLicense.set(null);
			return null;
		}
	}

	// Vérification PUBLIQUE d'une licence depuis son code QR (pas d'auth).
	async verify(qr: string): Promise<LicenseVerifyResult> {
		try {
			const resp = await firstValueFrom(
				this.http.get<LicenseVerifyResult>(`${this.API}/verify/${encodeURIComponent(qr)}`)
			);
			this.verifyResult.set(resp);
			return resp;
		} catch {
			const fallback: LicenseVerifyResult = { valid: false, reason: "not_found" };
			this.verifyResult.set(fallback);
			return fallback;
		}
	}

	// (Admin) Émet une licence pour un userId Discord. Renvoie la licence créée.
	async adminIssue(userId: string): Promise<License | null> {
		try {
			const resp = await firstValueFrom(
				this.http.post<License>(
					`${this.API}/issue/${encodeURIComponent(userId)}`,
					{},
					{ withCredentials: true }
				)
			);
			this.msg.add({
				severity: "success",
				summary: "Licence émise",
				detail: `Licence ${resp.licenseNumber} créée`,
			});
			return resp;
		} catch {
			this.msg.add({
				severity: "error",
				summary: "Échec de l'émission",
				detail: "Impossible d'émettre la licence",
			});
			return null;
		}
	}

	// (Admin) Révoque une licence par son identifiant. Renvoie la licence révoquée.
	async adminRevoke(id: string): Promise<License | null> {
		try {
			const resp = await firstValueFrom(
				this.http.post<License>(
					`${this.API}/${encodeURIComponent(id)}/revoke`,
					{},
					{ withCredentials: true }
				)
			);
			this.msg.add({
				severity: "success",
				summary: "Licence révoquée",
				detail: `Licence ${resp.licenseNumber} révoquée`,
			});
			return resp;
		} catch {
			this.msg.add({
				severity: "error",
				summary: "Échec de la révocation",
				detail: "Impossible de révoquer la licence",
			});
			return null;
		}
	}
}
