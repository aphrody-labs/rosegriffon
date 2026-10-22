/**
 * Licence Achilléa imprimable : PDF A6 paysage, recto / verso, rendu par
 * Skia (`PDFDocument` de `@aphrody/canvas`). Le QR code est tracé en vecteurs
 * (modules de `qrcode-generator`), il reste net à toute échelle d'impression.
 *
 * Contrairement au legacy, le PDF n'est plus écrit sur le disque du bot à
 * l'émission : il est rendu à la demande depuis la base, si bien qu'une
 * licence révoquée ou expirée l'affiche immédiatement.
 */

import { PDFDocument, type SKRSContext2D } from "@aphrody/canvas";
import qrcode from "qrcode-generator";
import { fetchImage, FONT_SANS, registerAchilleaFonts, websiteHost } from "../images/render";

/** A6 paysage en points (148 × 105 mm). */
const W = 420;
const H = 297;
const PURPLE = "#732e80";
const GREY = "#666673";

export interface LicensePdfInput {
  licenseNumber: string;
  qrSecret: string;
  issuedAt: Date;
  validUntil: Date;
  status: string;
  holder: { displayName: string; avatar: string | null };
}

/** Page publique de vérification (QR) — surchargée par `ACHILLEA_LICENSE_VERIFY_URL`. */
export function licenseVerifyBaseUrl(): string {
  const override = process.env.ACHILLEA_LICENSE_VERIFY_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  return `${(process.env.WEBSITE_URL ?? "https://rosegriffon.fr").replace(/\/+$/, "")}/achillea/licence/verify`;
}

function drawQr(ctx: SKRSContext2D, text: string, x: number, y: number, size: number): void {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const margin = 1;
  const cell = size / (count + margin * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#000000";
  for (let row = 0; row < count; row++)
    for (let col = 0; col < count; col++)
      if (qr.isDark(row, col))
        // +0.02 : recouvrement léger, pas de liseré blanc entre modules à l'impression.
        ctx.fillRect(x + (col + margin) * cell, y + (row + margin) * cell, cell + 0.02, cell + 0.02);
}

function frame(ctx: SKRSContext2D): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = PURPLE;
  ctx.lineWidth = 2;
  ctx.strokeRect(9, 9, W - 18, H - 18);
}

function text(ctx: SKRSContext2D, value: string, x: number, y: number, size: number, opts: { bold?: boolean; color?: string } = {}) {
  ctx.fillStyle = opts.color ?? "#000000";
  ctx.font = `${opts.bold ? "bold " : ""}${size}px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x, y);
}

const day = (date: Date) => date.toISOString().slice(0, 10);

export async function renderLicensePdf(input: LicensePdfInput): Promise<Buffer> {
  registerAchilleaFonts();
  const avatar = await fetchImage(input.holder.avatar);
  const pdf = new PDFDocument({
    title: `Licence Achilléa — ${input.licenseNumber}`,
    author: "Association Rose Griffon",
    subject: "Licence joueur Achilléa",
    creator: "API unifiée Rose Griffon",
  });

  // ── Recto ──
  const recto = pdf.beginPage(W, H) as unknown as SKRSContext2D;
  frame(recto);
  recto.fillStyle = PURPLE;
  recto.fillRect(8, 8, W - 16, 42);
  text(recto, "LICENCE ACHILLÉA", 18, 32, 18, { bold: true, color: "#ffffff" });
  text(recto, "Association loi 1901 — Rose Griffon", 18, 45, 8, { color: "#ffffff" });

  const photo = { x: 18, y: H - 60 - 110, w: 90, h: 110 };
  if (avatar) {
    recto.drawImage(avatar, photo.x, photo.y, photo.w, photo.h);
  } else {
    recto.fillStyle = "#d9d9e0";
    recto.fillRect(photo.x, photo.y, photo.w, photo.h);
    recto.strokeStyle = "#9999a6";
    recto.lineWidth = 1;
    recto.strokeRect(photo.x, photo.y, photo.w, photo.h);
    text(recto, "PHOTO", photo.x + 28, photo.y + 60, 10, { color: GREY });
  }

  const tx = photo.x + photo.w + 16;
  let y = 70;
  const field = (label: string, value: string, size: number, bold = true) => {
    text(recto, label, tx, y, 8, { color: PURPLE });
    y += 14;
    text(recto, value, tx, y, size, { bold });
    y += 18;
  };
  field("Détenteur", input.holder.displayName.slice(0, 32), 13);
  field("N° de licence", input.licenseNumber, 12);
  field("Valide jusqu'au", day(input.validUntil), 11, false);
  if (input.status !== "Active") {
    text(recto, input.status === "Revoked" ? "LICENCE RÉVOQUÉE" : "LICENCE EXPIRÉE", tx, y + 6, 12, {
      bold: true,
      color: "#c0392b",
    });
  }

  const qrSize = 80;
  drawQr(recto, `${licenseVerifyBaseUrl()}/${input.qrSecret}`, W - qrSize - 18, H - 18 - qrSize - 8, qrSize);
  text(recto, "Scanner pour vérifier", W - qrSize - 18, H - 14, 6, { color: GREY });
  pdf.endPage();

  // ── Verso ──
  const verso = pdf.beginPage(W, H) as unknown as SKRSContext2D;
  frame(verso);
  text(verso, "Conditions générales", 18, 28, 12, { bold: true, color: PURPLE });
  const conditions = [
    "Détenteur licencié de l'association loi 1901 Rose Griffon.",
    "Cette licence personnelle et non transférable atteste de",
    "la qualité de membre actif pour la saison en cours.",
    "",
    "Toute personne peut vérifier la validité de la licence en",
    "scannant le QR code au recto. Le résultat de vérification",
    "indique uniquement la validité, le numéro et le détenteur.",
    "",
    "En cas de perte ou de révocation, contacter l'association",
    `via le canal officiel Discord ou ${websiteHost()}.`,
  ];
  let cy = 56;
  for (const line of conditions) {
    text(verso, line, 18, cy, 9);
    cy += 13;
  }
  text(verso, `N° licence : ${input.licenseNumber}`, 18, H - 22, 8, { color: GREY });
  text(verso, `Émis le : ${day(input.issuedAt)}`, 18, H - 12, 8, { color: GREY });
  pdf.endPage();

  return pdf.close();
}
