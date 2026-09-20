import type { LicenseStatus } from "../enums/license";

/**
 * Licence joueur — un titulaire = un userId Discord, une licence active à la
 * fois, vérifiable publiquement via un QR code.
 */
export interface License {
	id: string;
	userId: string;
	licenseNumber: string;
	issuedAt: string;
	validUntil: string;
	status: LicenseStatus;
	pdfUrl: string;
	createdAt: string;
	updatedAt: string;
}

/** Motif d'invalidité renvoyé par la vérification publique. */
export type LicenseVerifyReason = "not_found" | "revoked" | "expired";

/** Résultat de `GET /licenses/verify/{qr}` (endpoint PUBLIC, sans auth). */
export interface LicenseVerifyResult {
	valid: boolean;
	reason?: LicenseVerifyReason;
	licenseNumber?: string;
	validUntil?: string;
	holder?: {
		displayName: string;
		avatar: string | null;
	};
}

/** `GET /licenses/me` — `null` tant qu'aucune licence n'a été émise. */
export interface LicenseHolderResponse {
	license: License | null;
}
