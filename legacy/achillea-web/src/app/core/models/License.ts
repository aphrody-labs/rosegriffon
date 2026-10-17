// Modèles pour la feature Licences joueur.
// Côté serveur : entity License (achillea-bot) — un titulaire = un userId Discord,
// une licence active à la fois, vérifiable publiquement via un QR code.

// Statut d'une licence (doit matcher l'enum côté bot).
export type LicenseStatus = "Active" | "Revoked" | "Expired";

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

// Motif d'invalidité renvoyé par la vérification publique.
export type LicenseVerifyReason = "not_found" | "revoked" | "expired";

// Résultat de GET /api/licenses/verify/{qr} (endpoint PUBLIC, sans auth).
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
