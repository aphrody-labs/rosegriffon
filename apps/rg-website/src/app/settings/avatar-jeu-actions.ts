"use server";

import { revalidatePath } from "next/cache";

import { createPostgresClient } from "@rosegriffon/db/service";

import { ouvrirParCode } from "@/app/wiki/avatar/actions";
import { codePartageValide, type AvatarEnregistre } from "@/app/wiki/avatar/sauvegardes";
import { getServerUser } from "@/lib/auth-helpers";
import {
  codeValide,
  filtrerBanque,
  parametresBanque,
  seriesDeLaBanque,
  urlPortrait,
  type PageBanque,
} from "@/lib/avatar-jeu/banque";
import { analyserCode, urlApercu } from "@/lib/avatar-jeu/code";
import { CDN, codesAvecPortrait, lireBanque, lireCatalogue } from "@/lib/avatar-jeu/serveur";

const SEAU = "avatars";
const TAILLE_MAX = 2 * 1024 * 1024;
const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type ResultatBanque = PageBanque & { series: { nom: string; total: number }[] };

/** Recherche dans la banque de personnages (nom, jeu, page). */
export async function chercherBanque(brut: {
  q?: unknown;
  serie?: unknown;
  page?: unknown;
}): Promise<ResultatBanque | { error: string }> {
  try {
    const banque = await lireBanque();
    const portraits = codesAvecPortrait();
    const page = filtrerBanque(banque, parametresBanque(brut), portraits);
    return { ...page, series: seriesDeLaBanque(banque.filter(p => portraits.has(p.code))) };
  } catch (error) {
    console.error("[avatar-jeu] banque illisible", error);
    return { error: "La banque de personnages est indisponible pour le moment." };
  }
}

async function ecrireProfil(
  userId: string,
  champs: { avatar_url: string; game_avatar: string | null },
): Promise<{ error?: string }> {
  const { data, error } = await createPostgresClient()
    .from("profiles")
    .update({ ...champs, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("username")
    .maybeSingle();
  if (error) {
    console.error("[avatar-jeu] écriture du profil impossible", error);
    return { error: "Impossible d'enregistrer cet avatar." };
  }
  if (!data) return { error: "Profil introuvable. Reconnecte-toi avant de réessayer." };
  revalidatePath("/settings");
  if (data.username) revalidatePath(`/profil/${data.username}`);
  return {};
}

/** Pose le portrait d'un personnage de la banque comme avatar du compte connecté. */
export async function choisirPortrait(code: string): Promise<{ url?: string; error?: string }> {
  const user = await getServerUser();
  if (!user) return { error: "Session expirée — reconnecte-toi." };
  if (typeof code !== "string" || !codeValide(code) || !codesAvecPortrait().has(code)) {
    return { error: "Ce personnage n'a pas de portrait." };
  }
  const url = urlPortrait(CDN, code, 512);
  const r = await ecrireProfil(user.id, { avatar_url: url, game_avatar: null });
  return r.error ? r : { url };
}

export type ApercuCode = { code: string; apercu: string; nom: string | null; complet: boolean };

/**
 * Valide un code (ou un lien de partage) et rend l'URL du rendu 3D.
 * Si le code correspond à un avatar enregistré sur le site, sa recette complète
 * (couleurs, curseurs) est utilisée ; sinon le rendu ne porte que les pièces codées.
 */
export async function resoudreCode(saisie: string): Promise<ApercuCode | { error: string }> {
  if (typeof saisie !== "string" || saisie.length > 400) return { error: "Code trop long." };
  const catalogue = await lireCatalogue();
  if (!catalogue) return { error: "Le catalogue de l'éditeur est injoignable. Réessaie dans un instant." };
  const analyse = analyserCode(catalogue, saisie);
  if (!analyse.ok) return { error: analyse.erreur };
  if (!codePartageValide(analyse.code)) return { error: "Ce code de partage n'est pas valide." };

  const enregistre = await ouvrirParCode(analyse.code);
  const etat: AvatarEnregistre = enregistre.avatar ?? analyse.etat;
  const apercu = urlApercu(catalogue, CDN, etat);
  if (!apercu) return { error: "Aucune pièce de ce code n'a de modèle 3D : aperçu impossible." };
  return { code: analyse.code, apercu, nom: enregistre.nom ?? null, complet: Boolean(enregistre.avatar) };
}

/**
 * Enregistre l'avatar `chara_edit` : le code est revalidé, l'instantané PNG du rendu devient
 * l'image du profil (donc affichée partout où l'avatar l'est) et le code est conservé pour
 * pouvoir le rouvrir.
 */
export async function enregistrerAvatarJeu(formulaire: FormData): Promise<{ url?: string; error?: string }> {
  const user = await getServerUser();
  if (!user) return { error: "Session expirée — reconnecte-toi." };

  const saisie = formulaire.get("code");
  const image = formulaire.get("image");
  if (typeof saisie !== "string" || !(image instanceof File)) return { error: "Requête incomplète." };

  const catalogue = await lireCatalogue();
  if (!catalogue) return { error: "Le catalogue de l'éditeur est injoignable. Réessaie dans un instant." };
  const analyse = analyserCode(catalogue, saisie);
  if (!analyse.ok) return { error: analyse.erreur };
  if (!codePartageValide(analyse.code)) return { error: "Ce code de partage n'est pas valide." };

  if (image.size === 0 || image.size > TAILLE_MAX) return { error: "Instantané absent ou trop lourd (2 Mo maximum)." };
  const octets = new Uint8Array(await image.arrayBuffer());
  if (!SIGNATURE_PNG.every((o, i) => octets[i] === o)) return { error: "L'instantané doit être un PNG." };

  const admin = createPostgresClient();
  const chemin = `${user.id}/avatar-${Date.now()}.png`;
  const { error: envoi } = await admin.storage
    .from(SEAU)
    .upload(chemin, octets, { contentType: "image/png", upsert: true });
  if (envoi) {
    console.error("[avatar-jeu] téléversement impossible", envoi);
    return { error: "Impossible d'enregistrer l'instantané." };
  }
  const {
    data: { publicUrl },
  } = admin.storage.from(SEAU).getPublicUrl(chemin);

  const r = await ecrireProfil(user.id, { avatar_url: publicUrl, game_avatar: analyse.code });
  return r.error ? r : { url: publicUrl };
}
