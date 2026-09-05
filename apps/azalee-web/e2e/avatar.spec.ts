import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { gzipSync } from "node:zlib";
import sharp from "sharp";

const EMAIL_A = process.env.AZALEE_E2E_EMAIL_A;
const EMAIL_B = process.env.AZALEE_E2E_EMAIL_B;
const PASSWORD_A = process.env.AZALEE_E2E_PASSWORD_A;
const PASSWORD_B = process.env.AZALEE_E2E_PASSWORD_B;

type Sonde = {
	erreursConsole: string[];
	erreursPage: string[];
	ressourcesCritiques: string[];
};

function sonder(page: Page): Sonde {
	const sonde: Sonde = { erreursConsole: [], erreursPage: [], ressourcesCritiques: [] };
	page.on("console", (message) => {
		if (message.type() === "error") sonde.erreursConsole.push(message.text());
	});
	page.on("pageerror", (error) => sonde.erreursPage.push(error.message));
	page.on("response", (response) => {
		if (response.status() >= 400)
			sonde.ressourcesCritiques.push(`${response.status()} ${response.url()}`);
	});
	return sonde;
}

function verifierSonde(sonde: Sonde): void {
	expect(sonde.erreursConsole, "console.error").toEqual([]);
	expect(sonde.erreursPage, "pageerror / WebGPU / model-viewer").toEqual([]);
	expect(sonde.ressourcesCritiques, "réponses HTTP >= 400").toEqual([]);
}

async function ouvrirAtelier(page: Page): Promise<void> {
	await page.goto("/avatar", { waitUntil: "networkidle" });
	await expect(page.getByRole("heading", { name: "Atelier avatar" })).toBeVisible();
	await expect(page.locator("model-viewer")).toHaveAttribute("src", /model-avatar/);
	await expect(page.getByText("Modèle prêt")).toBeVisible({ timeout: 30_000 });
}

async function ouvrirImport(page: Page): Promise<void> {
	await page.getByRole("button", { name: "Importer 2D / 3D" }).click();
	await expect(page.getByRole("heading", { name: "Importer un avatar" })).toBeVisible();
}

async function inscrire(
	context: BrowserContext,
	email: string,
	password: string,
	nom: string
): Promise<Page> {
	const page = await context.newPage();
	await page.goto("/login?returnTo=/avatar");
	await page.getByRole("button", { name: "Pas encore de compte ? S'inscrire" }).click();
	await page.getByLabel("Nom d'utilisateur").fill(nom);
	await page.getByLabel("Adresse e-mail").fill(email);
	await page.getByLabel("Mot de passe").fill(password);
	await page.getByRole("button", { name: "Créer un compte" }).click();
	await page.waitForURL(/\/avatar(?:\?|$)/, { timeout: 30_000 });
	return page;
}

test("parcours public réel : édition, PNG, GLB/gzip, export et refus hors session", async ({
	page,
}) => {
	const sonde = sonder(page);
	let modeleCompose: Buffer | null = null;
	page.on("response", async (response) => {
		if (!modeleCompose && response.ok() && response.url().includes("/model-avatar/")) {
			modeleCompose = await response.body();
		}
	});

	await ouvrirAtelier(page);
	await expect.poll(() => modeleCompose?.length ?? 0).toBeGreaterThan(20);

	const pieces = page.locator("button[data-part-id]");
	const premiere = await pieces.first().getAttribute("data-part-id");
	await pieces.nth(1).click();
	await expect(pieces.nth(1)).toHaveAttribute("aria-pressed", "true");
	expect(await pieces.nth(1).getAttribute("data-part-id")).not.toBe(premiere);

	await ouvrirImport(page);
	const fichier = page.getByLabel("Importer des fichiers avatar");
	const png = await sharp({
		create: { width: 3, height: 4, channels: 4, background: "#ff3366" },
	})
		.png()
		.toBuffer();
	await fichier.setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: png });
	await expect(page.locator(".atelier-import-corps > p[role='status']")).toContainText(
		"reference.png"
	);
	await page.getByRole("button", { name: "Revenir au catalogue" }).click();

	await ouvrirImport(page);
	await fichier.setInputFiles({
		name: "avatar.glb",
		mimeType: "model/gltf-binary",
		buffer: modeleCompose!,
	});
	await expect(page.getByText("Modèle prêt")).toBeVisible({ timeout: 30_000 });
	const telechargement = page.waitForEvent("download");
	await page.getByRole("button", { name: "Exporter le GLB" }).click();
	expect((await telechargement).suggestedFilename()).toBe("avatar.glb");

	await fichier.setInputFiles({
		name: "avatar.glb.gz",
		mimeType: "application/gzip",
		buffer: gzipSync(modeleCompose!),
	});
	await expect(page.locator(".atelier-import-corps > p[role='status']")).toContainText(
		"avatar.glb"
	);
	await expect(page.getByText("Modèle prêt")).toBeVisible({ timeout: 30_000 });
	await page.getByRole("button", { name: "Revenir au catalogue" }).click();

	await page.getByRole("button", { name: "Compte et partage" }).click();
	await page.getByPlaceholder("Nom de l'avatar").fill("Smoke public");
	await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
	await expect(page.getByText(/Connecte-toi pour enregistrer/)).toBeVisible();
	await page.getByPlaceholder("Colle un code ici").fill("O".repeat(69));
	await page.getByRole("button", { name: "Ouvrir", exact: true }).click();
	await expect(page.getByText(/code de partage n'est pas valide/)).toBeVisible();
	verifierSonde(sonde);
});

test("deux comptes : sauvegarde, restauration, isolation, suppression et lien visiteur", async ({
	browser,
}) => {
	test.skip(
		!EMAIL_A || !EMAIL_B || !PASSWORD_A || !PASSWORD_B,
		"Identifiants éphémères requis pour le smoke authentifié"
	);
	const contexteA = await browser.newContext({
		permissions: ["clipboard-read", "clipboard-write"],
	});
	const pageA = await inscrire(contexteA, EMAIL_A!, PASSWORD_A!, "Smoke Avatar A");
	const sondeA = sonder(pageA);
	await ouvrirAtelier(pageA);
	const piecesA = pageA.locator("button[data-part-id]");
	await piecesA.nth(1).click();
	const partSauvegardee = await piecesA.nth(1).getAttribute("data-part-id");

	await pageA.getByRole("button", { name: "Compte et partage" }).click();
	await pageA.getByPlaceholder("Nom de l'avatar").fill("Smoke compte A");
	await pageA.getByRole("button", { name: "Enregistrer", exact: true }).click();
	await expect(pageA.getByText("Avatar enregistré.")).toBeVisible();
	const code = (await pageA.locator("code").innerText()).trim();
	expect(code).toHaveLength(69);
	await pageA.getByRole("button", { name: "Copier le lien" }).click();
	const lien = await pageA.evaluate(() => navigator.clipboard.readText());
	expect(new URL(lien).searchParams.get("code")).toBe(code);
	await pageA.getByRole("button", { name: "Fermer" }).click();

	await piecesA.nth(2).click();
	await pageA.getByRole("button", { name: "Compte et partage" }).click();
	const ligneA = pageA.getByRole("listitem").filter({ hasText: "Smoke compte A" });
	await ligneA.getByRole("button", { name: "Ouvrir" }).click();
	await expect(pageA.locator(`button[data-part-id="${partSauvegardee}"]`)).toHaveAttribute(
		"aria-pressed",
		"true"
	);

	const contexteVisiteur = await browser.newContext();
	const pageVisiteur = await contexteVisiteur.newPage();
	const sondeVisiteur = sonder(pageVisiteur);
	await pageVisiteur.goto(lien, { waitUntil: "networkidle" });
	await expect(pageVisiteur.locator(`button[data-part-id="${partSauvegardee}"]`)).toHaveAttribute(
		"aria-pressed",
		"true"
	);
	await pageVisiteur.getByRole("button", { name: "Compte et partage" }).click();
	await expect(pageVisiteur.getByText("Smoke compte A")).toHaveCount(0);

	const contexteB = await browser.newContext();
	const pageB = await inscrire(contexteB, EMAIL_B!, PASSWORD_B!, "Smoke Avatar B");
	const sondeB = sonder(pageB);
	await ouvrirAtelier(pageB);
	await pageB.getByRole("button", { name: "Compte et partage" }).click();
	await expect(pageB.getByText("Smoke compte A")).toHaveCount(0);

	await pageA.getByRole("button", { name: "Compte et partage" }).click();
	const ligneASuppression = pageA
		.getByRole("listitem")
		.filter({ hasText: "Smoke compte A" });
	await ligneASuppression.getByRole("button", { name: "Supprimer" }).click();
	await expect(pageA.getByText("Avatar supprimé.")).toBeVisible();
	await expect(pageA.getByText("Smoke compte A")).toHaveCount(0);

	verifierSonde(sondeA);
	verifierSonde(sondeB);
	verifierSonde(sondeVisiteur);
	await Promise.all([contexteA.close(), contexteB.close(), contexteVisiteur.close()]);
});
