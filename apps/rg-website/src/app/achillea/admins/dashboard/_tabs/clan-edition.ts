/**
 * Édition complète d'un clan depuis le back-office — logique pure.
 *
 * Portage de `ClanInfoForm` (legacy Angular) : mêmes champs, mêmes bornes que
 * l'API (`PATCH /clans/:id`, `ClanService.update`), plus origine, langues et
 * visibilité, que l'API accepte désormais d'un administrateur. Le formulaire
 * n'envoie que les champs modifiés ; « inactif » et « masqué » ne partent que
 * pour un administrateur, comme l'exige l'API.
 */
import type { ClanDTO, UpdateClanPayload } from "@rosegriffon/achillea-types/domain/clan";

export interface SaisieClan {
  name: string;
  shortenedName: string;
  clanAvatarUrl: string;
  clanBiography: string;
  xUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  isRecruiting: boolean;
  autoAcceptMembers: boolean;
  isInactive: boolean;
  isHidden: boolean;
  origin: string;
  languages: string[];
}

export type ChampClan = keyof SaisieClan;
export type ErreursClan = Partial<Record<ChampClan, string>>;

/** Bornes de l'API (`ClanService.validateName` / `validateShortName`). */
export const NOM_MIN = 3;
export const NOM_MAX = 30;
export const TAG_MIN = 2;
export const TAG_MAX = 3;
export const BIO_MAX = 1500;

export function saisieDepuisClan(clan: ClanDTO): SaisieClan {
  return {
    name: clan.name,
    shortenedName: clan.shortenedName,
    clanAvatarUrl: clan.clanAvatarUrl,
    clanBiography: clan.clanBiography ?? "",
    xUrl: clan.xUrl ?? "",
    instagramUrl: clan.instagramUrl ?? "",
    tiktokUrl: clan.tiktokUrl ?? "",
    isRecruiting: clan.isRecruiting,
    autoAcceptMembers: clan.autoAcceptMembers,
    isInactive: clan.isInactive,
    isHidden: clan.isHidden,
    origin: clan.origin ?? "",
    languages: [...(clan.languages ?? [])],
  };
}

const HOTES_RESEAU = {
  xUrl: ["x.com", "twitter.com"],
  instagramUrl: ["instagram.com"],
  tiktokUrl: ["tiktok.com"],
} as const;

/** Lien social accepté par l'API : URL du bon réseau avec un identifiant. Vide = aucun lien. */
export function lienSocialValide(valeur: string, champ: keyof typeof HOTES_RESEAU): boolean {
  const saisie = valeur.trim();
  if (!saisie) return true;
  try {
    const url = new URL(saisie);
    const hote = url.hostname.replace(/^www\./, "");
    const identifiant = url.pathname.split("/").filter(Boolean)[0];
    return (HOTES_RESEAU[champ] as readonly string[]).includes(hote) && Boolean(identifiant);
  } catch {
    return false;
  }
}

/**
 * Erreurs par champ ; objet vide quand la saisie est valide. Origine et langues
 * ne sont contrôlées que si elles changent : d'anciens clans portent une
 * origine hors référentiel (« legacy ») qui ne doit pas bloquer une autre
 * modification — l'API ne les revalide pas non plus quand elles ne sont pas envoyées.
 */
export function validerSaisieClan(
  saisie: SaisieClan,
  codesPays: ReadonlySet<string>,
  initial?: SaisieClan,
): ErreursClan {
  const erreurs: ErreursClan = {};
  const nom = saisie.name.trim();
  if (nom.length < NOM_MIN || nom.length > NOM_MAX)
    erreurs.name = `Le nom doit faire entre ${NOM_MIN} et ${NOM_MAX} caractères.`;
  const tag = saisie.shortenedName.trim();
  if (tag.length < TAG_MIN || tag.length > TAG_MAX || /\s/.test(tag))
    erreurs.shortenedName = `Le tag fait ${TAG_MIN} à ${TAG_MAX} caractères, sans espace.`;
  if (!saisie.clanAvatarUrl.trim()) erreurs.clanAvatarUrl = "Le logo est obligatoire.";
  if (saisie.clanBiography.length > BIO_MAX)
    erreurs.clanBiography = `La biographie est limitée à ${BIO_MAX} caractères.`;
  if (!lienSocialValide(saisie.xUrl, "xUrl")) erreurs.xUrl = "Lien X / Twitter invalide (https://x.com/…).";
  if (!lienSocialValide(saisie.instagramUrl, "instagramUrl"))
    erreurs.instagramUrl = "Lien Instagram invalide (https://instagram.com/…).";
  if (!lienSocialValide(saisie.tiktokUrl, "tiktokUrl"))
    erreurs.tiktokUrl = "Lien TikTok invalide (https://tiktok.com/@…).";
  if ((!initial || saisie.origin !== initial.origin) && !codesPays.has(saisie.origin))
    erreurs.origin = "Choisis une origine.";
  if (!initial || !memesLangues(saisie.languages, initial.languages)) {
    if (saisie.languages.length === 0) erreurs.languages = "Choisis au moins une langue.";
    else if (saisie.languages.some(code => !codesPays.has(code))) erreurs.languages = "Langue inconnue.";
  }
  return erreurs;
}

function memesLangues(a: readonly string[], b: readonly string[]): boolean {
  const gauche = [...new Set(a)].toSorted();
  const droite = [...new Set(b)].toSorted();
  return gauche.length === droite.length && gauche.every((code, i) => code === droite[i]);
}

/** Champs modifiés, au format de `client.clans.update`. Vide si rien n'a changé. */
export function patchClan(initial: SaisieClan, saisie: SaisieClan, estAdmin: boolean): UpdateClanPayload {
  const patch: UpdateClanPayload = {};
  const nom = saisie.name.trim();
  if (nom !== initial.name) patch.name = nom;
  const tag = saisie.shortenedName.trim().toUpperCase();
  if (tag !== initial.shortenedName) patch.shortenedName = tag;
  if (saisie.clanAvatarUrl.trim() !== initial.clanAvatarUrl) patch.clanAvatarUrl = saisie.clanAvatarUrl.trim();
  if (saisie.clanBiography !== initial.clanBiography) patch.clanBiography = saisie.clanBiography;
  for (const champ of ["xUrl", "instagramUrl", "tiktokUrl"] as const) {
    const valeur = saisie[champ].trim();
    if (valeur !== initial[champ]) patch[champ] = valeur || null;
  }
  if (saisie.isRecruiting !== initial.isRecruiting) patch.isRecruiting = saisie.isRecruiting;
  if (saisie.autoAcceptMembers !== initial.autoAcceptMembers) patch.autoAcceptMembers = saisie.autoAcceptMembers;
  if (saisie.origin !== initial.origin) patch.origin = saisie.origin;
  if (!memesLangues(saisie.languages, initial.languages)) patch.languages = [...new Set(saisie.languages)];
  if (estAdmin) {
    if (saisie.isInactive !== initial.isInactive) patch.isInactive = saisie.isInactive;
    if (saisie.isHidden !== initial.isHidden) patch.isHidden = saisie.isHidden;
  }
  return patch;
}
