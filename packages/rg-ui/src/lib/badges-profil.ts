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
import { Flame, Mountain, Trees, Wind } from "lucide-react";
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
 * Les quatre éléments d'Inazuma Eleven, tels qu'ils s'affichent.
 *
 * ── LES COULEURS SONT CELLES DU JEU ────────────────────────────────────────
 * Elles passent par les tokens `element-*` de `styles.css`, relevés sur les
 * icônes officielles (`public/spirit_type/*.webp`). C'est ce qui règle une
 * divergence ancienne : le VENT était bleu dans certains écrans d'Azalée et
 * vert dans d'autres. L'icône du jeu tranche — il est bleu.
 *
 * ── POURQUOI DES ICÔNES LUCIDE ET PAS LES `.webp` DU JEU ───────────────────
 * Les icônes officielles vivent dans `apps/website/public/spirit_type/` et
 * n'existent pas côté Azalée : un composant partagé qui les référencerait
 * afficherait quatre carrés vides sur le wiki. Les pictogrammes Lucide
 * (flamme, tourbillon, feuillage, sommet) disent la même chose, se colorent
 * avec le thème et ne dépendent d'aucun fichier.
 */
export const AVAILABLE_BADGES: readonly BadgeProfilAffichable[] = [
	{
		description: "Frappe et pression : l'attaque avant tout.",
		icon: Flame,
		id: "fire",
		label: "Feu",
		tone: "border-element-feu/30 bg-element-feu/10 text-element-feu",
	},
	{
		description: "Vitesse et esquive : passer avant d'être vu.",
		icon: Wind,
		id: "wind",
		label: "Vent",
		tone: "border-element-vent/30 bg-element-vent/10 text-element-vent",
	},
	{
		description: "Technique et contrôle : le ballon ne se perd pas.",
		icon: Trees,
		id: "forest",
		label: "Forêt",
		tone: "border-element-foret/30 bg-element-foret/10 text-element-foret",
	},
	{
		description: "Défense et endurance : rien ne passe.",
		icon: Mountain,
		id: "mountain",
		label: "Montagne",
		tone: "border-element-montagne/30 bg-element-montagne/10 text-element-montagne",
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
