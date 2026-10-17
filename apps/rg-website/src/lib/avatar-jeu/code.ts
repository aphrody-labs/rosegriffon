/**
 * Validation d'un code de partage d'avatar `chara_edit` et résolution de son aperçu 3D.
 *
 * S'appuie sur la logique de l'éditeur du wiki (`partage.ts` pour le décodage,
 * `composition.ts` pour l'URL du rendu GLB) : aucune règle n'est dupliquée ici.
 * Le décodage vérifie la FORME du code (alphabet, longueur, bornes de chaque emplacement) ;
 * il ne prouve pas que l'éditeur du jeu relirait ce code (cf. l'avertissement de `partage.ts`).
 */
import { composerUrlAvatar } from "@/app/wiki/avatar/composition";
import {
  choixDepuisValeurs,
  decoder,
  longueurCode,
  specDe,
  verifierSpec,
} from "@/app/wiki/avatar/partage";
import type { EtatAvatar } from "@/app/wiki/avatar/projet";
import type { Catalogue } from "@/app/wiki/avatar/types";

export type AnalyseCode =
  | { ok: true; code: string; etat: EtatAvatar }
  | { ok: false; erreur: string };

/**
 * Extrait le code d'une saisie : le code seul, ou un lien `…/avatar?code=…`.
 * Les blancs (retours à la ligne d'un copier-coller) sont retirés, l'alphabet n'en contient pas.
 */
export function extraireCode(saisie: string): string {
  const brut = saisie.trim();
  if (/^https?:\/\//i.test(brut)) {
    try {
      return new URL(brut).searchParams.get("code")?.replace(/\s+/g, "") ?? "";
    } catch {
      return "";
    }
  }
  return brut.replace(/\s+/g, "");
}

/** Valide un code contre le catalogue et rend l'état d'avatar qu'il décrit. */
export function analyserCode(catalogue: Catalogue, saisie: string): AnalyseCode {
  const spec = specDe(catalogue);
  if (!spec) return { ok: false, erreur: "Le catalogue ne décrit pas le code de partage." };
  const defaut = verifierSpec(spec);
  if (defaut) return { ok: false, erreur: `Catalogue incohérent : ${defaut}.` };

  const code = extraireCode(saisie);
  if (code.length === 0) return { ok: false, erreur: "Colle un code de partage." };
  const attendu = longueurCode(spec);
  if (code.length !== attendu) {
    return { ok: false, erreur: `Un code compte ${attendu} caractères, celui-ci en a ${code.length}.` };
  }
  const intrus = [...code].find(c => !spec.alphabet.includes(c));
  if (intrus) return { ok: false, erreur: `Le caractère « ${intrus} » n'existe pas dans un code.` };

  const valeurs = decoder(spec, code);
  if (!valeurs) return { ok: false, erreur: "Ce code est abîmé ou incomplet." };
  const { choix, genre, morphologie } = choixDepuisValeurs(catalogue, valeurs);
  if (morphologie < 0 || morphologie >= catalogue.modelesDeBase.morphologies.length) {
    return { ok: false, erreur: "Ce code désigne une morphologie inconnue." };
  }
  return { ok: true, code, etat: { choix, valeurs: {}, champs: {}, genre, morphologie } };
}

/** URL du rendu GLB de l'état, ou `null` quand le catalogue ne permet aucun assemblage. */
export function urlApercu(catalogue: Catalogue, cdn: string, etat: EtatAvatar): string | null {
  return composerUrlAvatar(catalogue, cdn, etat);
}
