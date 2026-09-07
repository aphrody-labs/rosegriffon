import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { formatLicenseNumber, generateQrSecret, LICENSE_VALIDITY_MS } from "@achillea/core";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { singleton } from "tsyringe";

import { urlsConfig } from "@/configs";
import { License, User } from "@/entities";
import { Database } from "@/services/Database";
import { LicenseStatus } from "@/utils/enums";

/** Storage root for generated PDFs (relative to apps/achillea-bot/). */
const STORAGE_ROOT = join(process.cwd(), "storage", "licenses");

/** Public verification base URL (source unique : src/configs/urls.ts). */
const VERIFY_BASE_URL = urlsConfig.licenseVerify;

/** License validity duration (1 year). */
const VALIDITY_MS = LICENSE_VALIDITY_MS;

export interface VerifyResult {
	valid: boolean;
	reason?: "not_found" | "revoked" | "expired";
	licenseNumber?: string;
	validUntil?: Date;
	holder?: { displayName: string; avatar: string | null };
}

@singleton()
export class LicenseService {
	constructor(private db: Database) {}

	// issue

	/**
	 * Issues a new license for a user. Generates a PDF written under
	 * `storage/licenses/<id>.pdf`, persists License and returns it.
	 *
	 * - licenseNumber : `ACH-{year}-{seq:5}` (seq = count(year) + 1)
	 * - qrSecret      : 64 random hex chars (2 × randomUUID stripped)
	 * - validUntil    : +1 an
	 * - pdfUrl        : `/api/licenses/<id>.pdf` (endpoint API qui stream le fichier)
	 */
	async issue(userId: string): Promise<License> {
		const em = this.db.em.fork();

		const user = await em.findOneOrFail(User, { id: userId });

		const year = new Date().getFullYear();
		const yearStart = new Date(`${year}-01-01T00:00:00Z`);
		const yearEnd = new Date(`${year + 1}-01-01T00:00:00Z`);
		const seq = (await em.count(License, { issuedAt: { $gte: yearStart, $lt: yearEnd } })) + 1;
		const licenseNumber = formatLicenseNumber(year, seq);

		// 64 hex chars via Web Crypto (logique pure @achillea/core).
		const qrSecret = generateQrSecret();

		const license = new License();
		license.user = user;
		license.licenseNumber = licenseNumber;
		license.qrSecret = qrSecret;
		license.validUntil = new Date(Date.now() + VALIDITY_MS);
		license.status = LicenseStatus.Active;

		em.persist(license);
		await em.flush();

		// Generate + write PDF to storage
		const pdfBytes = await this.generatePdf(license, {
			displayName: user.displayName || user.username || `User#${user.id}`,
			avatar: user.avatar || null,
		});
		await mkdir(STORAGE_ROOT, { recursive: true });
		const pdfPath = join(STORAGE_ROOT, `${license.id}.pdf`);
		await Bun.write(pdfPath, pdfBytes);

		license.pdfUrl = `/api/licenses/${license.id}.pdf`;
		await em.flush();

		return license;
	}

	// revoke

	/** Revokes a license (sets status = Revoked). */
	async revoke(licenseId: string, _by: string): Promise<License> {
		const em = this.db.em.fork();
		const license = await em.findOneOrFail(License, { id: licenseId });
		license.status = LicenseStatus.Revoked;
		await em.flush();
		return license;
	}

	// verify

	/**
	 * Public verification : never leaks user_id nor License internals.
	 * Returns a sanitized result with valid/holder/licenseNumber/validUntil only.
	 */
	async verify(qrSecret: string): Promise<VerifyResult> {
		const em = this.db.em.fork();
		const license = await em.findOne(License, { qrSecret }, { populate: ["user"] });

		if (!license) return { valid: false, reason: "not_found" };

		if (license.status === LicenseStatus.Revoked) {
			return {
				valid: false,
				reason: "revoked",
				licenseNumber: license.licenseNumber,
			};
		}

		if (license.validUntil.getTime() <= Date.now() || license.status === LicenseStatus.Expired) {
			return {
				valid: false,
				reason: "expired",
				licenseNumber: license.licenseNumber,
			};
		}

		const user = license.user;
		return {
			valid: true,
			licenseNumber: license.licenseNumber,
			validUntil: license.validUntil,
			holder: {
				displayName: user.displayName || user.username || "Inconnu",
				avatar: user.avatar || null,
			},
		};
	}

	// generatePdf — pdf-lib (pure JS, Bun OK)

	/**
	 * Génère un PDF 2 pages (recto / verso) au format A6 paysage (148×105 mm).
	 * - Recto : titre, licenseNumber, displayName, validité, photo (avatar Discord
	 *   ou placeholder gris), QR code vers /achillea/licenses/verify/{qrSecret}.
	 * - Verso : conditions générales courtes.
	 */
	async generatePdf(
		license: License,
		holder: { displayName: string; avatar: string | null }
	): Promise<Uint8Array> {
		const pdf = await PDFDocument.create();
		pdf.setTitle(`Licence Achilléa — ${license.licenseNumber}`);
		pdf.setAuthor("Association Rose Griffon");
		pdf.setSubject("Licence joueur Achilléa");
		pdf.setProducer("achillea-bot LicenseService");

		const font = await pdf.embedFont(StandardFonts.Helvetica);
		const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

		// A6 landscape, in points (1 mm = 2.835 pt)
		const W = 420;
		const H = 297;

		// ------------------------- Recto -------------------------
		const recto = pdf.addPage([W, H]);

		// Bordure
		recto.drawRectangle({
			x: 8,
			y: 8,
			width: W - 16,
			height: H - 16,
			borderColor: rgb(0.45, 0.18, 0.5),
			borderWidth: 2,
		});

		// Bandeau titre
		recto.drawRectangle({
			x: 8,
			y: H - 50,
			width: W - 16,
			height: 42,
			color: rgb(0.45, 0.18, 0.5),
		});
		recto.drawText("LICENCE ACHILLÉA", {
			x: 18,
			y: H - 32,
			size: 18,
			font: fontBold,
			color: rgb(1, 1, 1),
		});
		recto.drawText("Association loi 1901 — Rose Griffon", {
			x: 18,
			y: H - 46,
			size: 8,
			font,
			color: rgb(1, 1, 1),
		});

		// Photo / placeholder
		const photoX = 18;
		const photoY = 60;
		const photoW = 90;
		const photoH = 110;
		let embedded = false;
		if (holder.avatar) {
			try {
				const res = await fetch(holder.avatar, { signal: AbortSignal.timeout(5000) });
				if (res.ok) {
					const buf = new Uint8Array(await res.arrayBuffer());
					const ct = res.headers.get("content-type") ?? "";
					const img = ct.includes("png") ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
					recto.drawImage(img, { x: photoX, y: photoY, width: photoW, height: photoH });
					embedded = true;
				}
			} catch {
				// Fallback to placeholder
			}
		}
		if (!embedded) {
			recto.drawRectangle({
				x: photoX,
				y: photoY,
				width: photoW,
				height: photoH,
				color: rgb(0.85, 0.85, 0.88),
				borderColor: rgb(0.6, 0.6, 0.65),
				borderWidth: 1,
			});
			recto.drawText("PHOTO", {
				x: photoX + 28,
				y: photoY + 50,
				size: 10,
				font,
				color: rgb(0.4, 0.4, 0.45),
			});
		}

		// Champs texte
		const txtX = photoX + photoW + 16;
		const lineH = 14;
		let y = H - 70;
		recto.drawText("Détenteur", { x: txtX, y, size: 8, font, color: rgb(0.45, 0.18, 0.5) });
		y -= lineH;
		recto.drawText(holder.displayName, { x: txtX, y, size: 13, font: fontBold });
		y -= lineH + 4;
		recto.drawText("N° de licence", { x: txtX, y, size: 8, font, color: rgb(0.45, 0.18, 0.5) });
		y -= lineH;
		recto.drawText(license.licenseNumber, { x: txtX, y, size: 12, font: fontBold });
		y -= lineH + 4;
		recto.drawText("Valide jusqu'au", { x: txtX, y, size: 8, font, color: rgb(0.45, 0.18, 0.5) });
		y -= lineH;
		recto.drawText(license.validUntil.toISOString().slice(0, 10), {
			x: txtX,
			y,
			size: 11,
			font,
		});

		// QR code
		const qrUrl = `${VERIFY_BASE_URL}/${license.qrSecret}`;
		const qrPngDataUrl = await QRCode.toDataURL(qrUrl, {
			errorCorrectionLevel: "M",
			margin: 1,
			width: 256,
		});
		const qrPngBytes = Uint8Array.from(Buffer.from(qrPngDataUrl.split(",")[1] ?? "", "base64"));
		const qrImg = await pdf.embedPng(qrPngBytes);
		const qrSize = 80;
		recto.drawImage(qrImg, {
			x: W - qrSize - 18,
			y: 18,
			width: qrSize,
			height: qrSize,
		});
		recto.drawText("Scanner pour vérifier", {
			x: W - qrSize - 18,
			y: 12,
			size: 6,
			font,
			color: rgb(0.4, 0.4, 0.45),
		});

		// ------------------------- Verso -------------------------
		const verso = pdf.addPage([W, H]);
		verso.drawRectangle({
			x: 8,
			y: 8,
			width: W - 16,
			height: H - 16,
			borderColor: rgb(0.45, 0.18, 0.5),
			borderWidth: 2,
		});
		verso.drawText("Conditions générales", {
			x: 18,
			y: H - 28,
			size: 12,
			font: fontBold,
			color: rgb(0.45, 0.18, 0.5),
		});

		const conditions = [
			"Détenteur licencié de l'association loi 1901 Rose Griffon.",
			"Cette licence personnelle et non transférable atteste de",
			"la qualité de membre actif pour la saison en cours.",
			"",
			"Toute personne peut vérifier la validité de la licence en",
			"scannant le QR code au verso. Le résultat de vérification",
			"indique uniquement la validité, le numéro et le détenteur.",
			"",
			"En cas de perte ou de révocation, contacter l'association",
			`via le canal officiel Discord ou ${urlsConfig.websiteHost}.`,
		];
		let cy = H - 56;
		for (const line of conditions) {
			verso.drawText(line, { x: 18, y: cy, size: 9, font });
			cy -= 13;
		}

		verso.drawText(`N° licence : ${license.licenseNumber}`, {
			x: 18,
			y: 22,
			size: 8,
			font,
			color: rgb(0.4, 0.4, 0.45),
		});
		verso.drawText(`Émis le : ${license.issuedAt.toISOString().slice(0, 10)}`, {
			x: 18,
			y: 12,
			size: 8,
			font,
			color: rgb(0.4, 0.4, 0.45),
		});

		return pdf.save();
	}
}
