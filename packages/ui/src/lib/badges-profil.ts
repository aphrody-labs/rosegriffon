/**
 * Les badges de profil — la description, hors de tout module client.
 *
 * ── POURQUOI CE FICHIER EXISTE (ET PAS LE COMPOSANT) ───────────────────────
 * `AVAILABLE_BADGES` vivait dans `account-profile-form.tsx`, qui porte
 * `"use client"`. Dans un tel module, CHAQUE export devient une *référence*
 * client, pas la valeur : le formulaire s'en accommodait, mais la page serveur
 * `/profil/[username]` qui a voulu la lire a fait échouer le build entier —
 * « AVAILABLE_BADGES.map is not a function », au moment de la collecte des
 * données de page, pas à la compilation des types.
 *
 * C'est le même piège que `ADSENSE_CLIENT` (cf. CLAUDE.md) : les constantes
 * partagées entre serveur et client vivent dans `lib/`, jamais dans un
 * composant. Les icônes ne changent rien à l'affaire — un composant Lucide
 * s'importe des deux côtés tant que le module qui le réexporte n'est pas marqué
 * client.
 */
import { Crown, Heart, ShieldCheck, Sparkles, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BADGES_PROFIL, MAX_BADGES_PROFIL } from "@rosegriffon/types/profil";

export interface BadgeProfilAffichable {
	id: string;
	label: string;
	description: string;
	icon: LucideIcon;
	/** Classes de teinte, en tokens du design system — jamais de couleur en dur. */
	tone: string;
}

/**
 * Badges cosmétiques affichables à côté du pseudo.
 *
 * Les couleurs passent par les tokens de marque et sémantiques (`rg-or`,
 * `rg-rose`, `info`, `patreon`, `succes`) : elles suivent le thème actif au lieu
 * d'être figées. La page de profil public en gardait une copie avec des teintes
 * Tailwind en dur (`amber-500`, `purple-500`…), si bien que le même badge
 * n'avait pas la même couleur dans le formulaire et sur le profil.
 *
 * ⚠ Les identifiants doivent rester alignés sur `BADGES_PROFIL` de
 * `@rosegriffon/types/profil`, qui est ce que la validation serveur accepte.
 */
export const AVAILABLE_BADGES: readonly BadgeProfilAffichable[] = [
	{
		description: "Membre fondateur de la communauté Rose Griffon.",
		icon: Crown,
		id: "founder",
		label: "Fondateur",
		tone: "border-rg-or/25 bg-rg-or/10 text-rg-or",
	},
	{
		description: "Invité de marque ou contributeur exceptionnel.",
		icon: Star,
		id: "vip",
		label: "VIP",
		tone: "border-rg-rose/25 bg-rg-rose/10 text-rg-rose",
	},
	{
		description: "A participé activement aux tests de Victory Road.",
		icon: Sparkles,
		id: "beta",
		label: "Bêta-testeur",
		tone: "border-info/25 bg-info/10 text-info",
	},
	{
		description: "Soutien officiel du projet sur Patreon.",
		icon: Heart,
		id: "patreon",
		label: "Patreon",
		tone: "border-patreon/25 bg-patreon/10 text-patreon",
	},
	{
		description: "Membre de l'équipe d'administration du site.",
		icon: ShieldCheck,
		id: "staff",
		label: "Staff",
		tone: "border-succes/25 bg-succes/10 text-succes",
	},
] as const;

/**
 * Nombre de badges affichables à la fois.
 *
 * Repris du contrat partagé plutôt que recopié : c'est la même limite que la
 * validation serveur applique, et deux valeurs qui divergent donneraient un
 * formulaire qui accepte ce que la base refuse.
 */
export const MAX_BADGES = MAX_BADGES_PROFIL;

/**
 * Garde-fou de non-dérive : la liste d'affichage doit couvrir exactement les
 * identifiants que la validation accepte. Une entrée manquante ici ferait
 * disparaître un badge de l'interface sans que rien ne le signale.
 */
const IDENTIFIANTS_COUVERTS = new Set(AVAILABLE_BADGES.map((badge) => badge.id));
for (const identifiant of BADGES_PROFIL) {
	if (!IDENTIFIANTS_COUVERTS.has(identifiant)) {
		console.warn(`[badges] « ${identifiant} » est accepté en base mais n'a pas de description.`);
	}
}
