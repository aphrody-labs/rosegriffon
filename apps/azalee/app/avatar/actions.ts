"use server";

/**
 * Appliquer l'avatar composé dans l'éditeur comme photo du compte.
 *
 * Le mécanisme de photo de profil existait déjà (téléversement dans le seau `avatars`, puis
 * écriture de `profiles.avatar_url`) : cette action s'y branche au lieu d'en ouvrir un second
 * chemin. Deux différences avec le téléversement depuis les réglages — l'image ne vient pas du
 * poste de l'utilisateur mais du CDN du jeu, et elle est donc récupérée **côté serveur**.
 *
 * L'identité vient de la session, jamais d'un paramètre : sans cela, n'importe quel appelant
 * réécrirait la photo d'un autre compte.
 */

import { revalidatePath } from "next/cache";

import { getServerSession } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

/** Origine qui sert les vignettes décodées du jeu. */
const CDN = process.env.NEXT_PUBLIC_CDN_ORIGIN ?? "https://cdn.rosegriffon.fr";

/** Seau de stockage des photos de profil, celui des réglages du compte. */
const SEAU = "avatars";

/** Plafond de taille de la vignette récupérée — une icône du jeu pèse quelques kilo-octets. */
const TAILLE_MAX = 2 * 1024 * 1024;

/**
 * Nom d'icône du jeu : lettres, chiffres et soulignés uniquement.
 *
 * La valeur part dans une URL ; sans ce filtre, un nom fabriqué ferait sortir la requête du
 * chemin des vignettes.
 */
const NOM_VALIDE = /^[A-Za-z0-9_]{3,64}$/;

/**
 * Pose la vignette `icone` (une image du jeu) comme photo du compte connecté.
 *
 * @param icone nom d'icône tel que le catalogue le fournit, p. ex. `icon_ava_face05_001`.
 * @returns l'URL publique enregistrée, ou un message d'erreur affichable.
 */
export async function definirPhotoDepuisAvatar(
	icone: string,
): Promise<{ url?: string; error?: string }> {
	const session = await getServerSession();
	if (!session?.user) {
		return { error: "Connecte-toi pour utiliser cet avatar comme photo de profil." };
	}
	if (!NOM_VALIDE.test(icone)) {
		return { error: "Vignette inconnue." };
	}

	let octets: ArrayBuffer;
	try {
		const reponse = await fetch(`${CDN}/avatar/icon/${icone}.png`, { cache: "no-store" });
		if (!reponse.ok) {
			return { error: "Cette vignette n'a pas pu être récupérée." };
		}
		octets = await reponse.arrayBuffer();
	} catch {
		return { error: "Le service d'images du jeu est injoignable." };
	}
	if (octets.byteLength === 0 || octets.byteLength > TAILLE_MAX) {
		return { error: "Cette vignette n'a pas pu être récupérée." };
	}

	const admin = createAdminClient();
	// Chemin daté, comme le téléversement des réglages : un chemin fixe resservirait l'ancienne
	// image depuis le cache du CDN et du navigateur.
	const chemin = `${session.user.id}/avatar-${Date.now()}.png`;
	const { error: erreurEnvoi } = await admin.storage
		.from(SEAU)
		.upload(chemin, octets, { contentType: "image/png", upsert: true });
	if (erreurEnvoi) {
		console.error("[avatar] téléversement impossible", erreurEnvoi);
		return { error: "Impossible d'enregistrer cette photo." };
	}

	const {
		data: { publicUrl },
	} = admin.storage.from(SEAU).getPublicUrl(chemin);

	const { error: erreurProfil } = await admin
		.from("profiles")
		.update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
		.eq("id", session.user.id);
	if (erreurProfil) {
		console.error("[avatar] écriture du profil impossible", erreurProfil);
		return { error: "Impossible d'enregistrer cette photo." };
	}

	revalidatePath("/settings");
	revalidatePath("/avatar");
	return { url: publicUrl };
}
