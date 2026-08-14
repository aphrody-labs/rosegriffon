/**
 * Réglages de communauté d'une guilde — le schéma, et lui seul.
 *
 * ── POURQUOI UN DOCUMENT JSON VALIDÉ, ET PAS DES COLONNES ──────────────────
 * `bot_reglages_guilde.valeurs` est un `jsonb`. Le choix est assumé : ces
 * réglages changent au rythme des envies du staff, et une colonne par option
 * voudrait dire une migration par idée. Le prix à payer, c'est qu'une colonne
 * `jsonb` n'a AUCUN schéma — n'importe quel `UPDATE` maladroit peut y écrire
 * `{"niveaux": "oui"}` et la lecture suivante lèvera loin de la cause.
 *
 * Ce module est le contrepoids : le schéma vit ici, en zod, et il s'applique
 * DANS LES DEUX SENS — à l'écriture (refuser une valeur aberrante) comme à la
 * lecture (un document ancien, partiel ou corrompu retombe sur les défauts au
 * lieu de faire tomber une commande).
 *
 * ── MODULE PUR ─────────────────────────────────────────────────────────────
 * Aucune E/S, aucun `discord.js`. Les identifiants réels de la guilde Rose
 * Griffon ne sont PAS ici : ils sont semés en base par la migration
 * `20260814_bot_communaute_reglages.sql`. Un réglage est une donnée, pas une
 * constante de code — le staff doit pouvoir déplacer un salon sans déploiement.
 */
import { z } from "zod";

import { GAIN_DEFAUT } from "./experience";

/** Un flocon Discord, tel qu'il arrive d'une option de commande ou de la base. */
const flocon = z.string().regex(/^\d{15,25}$/, "identifiant Discord attendu");

/** Liste de flocons, dédoublonnée — deux fois le même rôle n'a aucun sens. */
const flocons = z
	.array(flocon)
	.default([])
	.transform((liste) => [...new Set(liste)]);

/**
 * Où annoncer une montée de niveau.
 *
 * `place` (dans le salon où le message a été envoyé) est le défaut des bots du
 * marché, et c'est le plus bruyant : sur un serveur actif, il transforme chaque
 * salon en flux d'annonces. `salon` centralise, `prive` n'embête personne,
 * `aucune` coupe. On garde les quatre parce que les quatre ont un usage réel,
 * mais le DÉFAUT est `salon` : visible, sans polluer les conversations.
 */
export const LIEUX_ANNONCE = ["salon", "place", "prive", "aucune"] as const;

export type LieuAnnonce = (typeof LIEUX_ANNONCE)[number];

const reglagesNiveaux = z
	.object({
		actif: z.boolean().default(true),
		/** Salon d'annonce quand `annonce = "salon"`. */
		salonAnnonce: flocon.nullable().default(null),
		annonce: z.enum(LIEUX_ANNONCE).default("salon"),
		/** Salons qui ne rapportent aucune XP (bots, journaux, vitrines). */
		salonsExclus: flocons,
		/** Rôles qui ne gagnent pas d'XP (bots, comptes de service). */
		rolesExclus: flocons,
		gain: z
			.object({
				minimum: z.number().int().min(0).max(1_000).default(GAIN_DEFAUT.minimum),
				maximum: z.number().int().min(0).max(1_000).default(GAIN_DEFAUT.maximum),
				delaiSecondes: z.number().int().min(0).max(3_600).default(GAIN_DEFAUT.delaiSecondes),
			})
			.prefault({}),
	})
	.prefault({});

const reglagesTickets = z
	.object({
		actif: z.boolean().default(true),
		/** Salon qui porte le panneau d'ouverture, et parent des fils de tickets. */
		salonPanneau: flocon.nullable().default(null),
		/** Salon où part la carte de fermeture. */
		salonHistorique: flocon.nullable().default(null),
		/** Catégorie de salons « Support » — utile en mode `salon` seulement. */
		categorieSupport: flocon.nullable().default(null),
		/** Rôles qui prennent en charge les tickets ordinaires. */
		rolesStaff: flocons,
		/** Rôles qui voient AUSSI les tickets sensibles (signalements). */
		rolesDirection: flocons,
		/**
		 * `fil` reprend le fonctionnement en place (ticketsbot crée des fils) ;
		 * `salon` crée un vrai salon dans la catégorie Support. Le défaut est `fil` :
		 * un serveur est plafonné à 500 salons, jamais aux fils.
		 */
		mode: z.enum(["fil", "salon"]).default("fil"),
	})
	.prefault({});

const reglagesKizuna = z
	.object({
		actif: z.boolean().default(true),
		/** Salon où annoncer les recrutements remarquables (Héros, BASARA). */
		salonAnnonce: flocon.nullable().default(null),
	})
	.prefault({});

export const SchemaReglages = z
	.object({
		niveaux: reglagesNiveaux,
		tickets: reglagesTickets,
		kizuna: reglagesKizuna,
	})
	.prefault({});

export type ReglagesCommunaute = z.infer<typeof SchemaReglages>;

/** Le document par défaut — celui d'une guilde qui n'a jamais rien réglé. */
export const REGLAGES_DEFAUT: ReglagesCommunaute = SchemaReglages.parse({});

/**
 * Lit un document venu de la base.
 *
 * Ne lève JAMAIS. Un `jsonb` illisible ou obsolète rend les défauts : une
 * commande de profil ne doit pas tomber parce qu'un réglage de tickets a été
 * mal écrit il y a six mois. Le problème se voit dans le journal, pas dans la
 * figure du membre.
 */
export function lireReglages(brut: unknown): ReglagesCommunaute {
	const resultat = SchemaReglages.safeParse(brut ?? {});
	if (resultat.success) {
		return resultat.data;
	}
	console.warn(
		"[reglages] document illisible, retour aux défauts :",
		resultat.error.issues.map((probleme) => `${probleme.path.join(".")} ${probleme.message}`).join(" · ")
	);
	return REGLAGES_DEFAUT;
}

/**
 * Valide un document AVANT écriture. Ici, on lève : une écriture est un acte
 * volontaire, et la refuser en disant pourquoi vaut mieux que d'enregistrer une
 * valeur qui sera silencieusement ignorée à la relecture.
 */
export function validerReglages(brut: unknown): ReglagesCommunaute {
	return SchemaReglages.parse(brut);
}

/**
 * Fusionne une modification partielle dans un document existant.
 *
 * Fusion PROFONDE sur les trois sections, superficielle en dessous : régler
 * `niveaux.annonce` ne doit pas effacer `niveaux.salonsExclus`, mais remplacer
 * `niveaux.salonsExclus` doit bien le remplacer et non l'additionner (sinon on
 * ne pourrait jamais retirer une exclusion).
 */
export function fusionnerReglages(
	actuels: ReglagesCommunaute,
	modification: {
		niveaux?: Partial<ReglagesCommunaute["niveaux"]>;
		tickets?: Partial<ReglagesCommunaute["tickets"]>;
		kizuna?: Partial<ReglagesCommunaute["kizuna"]>;
	}
): ReglagesCommunaute {
	return validerReglages({
		kizuna: { ...actuels.kizuna, ...modification.kizuna },
		niveaux: { ...actuels.niveaux, ...modification.niveaux },
		tickets: { ...actuels.tickets, ...modification.tickets },
	});
}

/**
 * Les réglages sont-ils exploitables pour les tickets ?
 *
 * Rendu comme une liste de manques plutôt qu'un booléen : le staff a besoin de
 * savoir CE QU'IL RESTE à poser, pas seulement que ça ne marche pas.
 */
export function manquesTickets(reglages: ReglagesCommunaute): string[] {
	const manques: string[] = [];
	if (!reglages.tickets.salonPanneau) {
		manques.push("le salon du panneau (`salon-panneau`)");
	}
	if (!reglages.tickets.salonHistorique) {
		manques.push("le salon d'historique (`salon-historique`)");
	}
	if (reglages.tickets.rolesStaff.length === 0 && reglages.tickets.rolesDirection.length === 0) {
		manques.push("au moins un rôle de prise en charge (`role-staff`)");
	}
	if (reglages.tickets.mode === "salon" && !reglages.tickets.categorieSupport) {
		manques.push("la catégorie Support (`categorie`), obligatoire en mode salon");
	}
	return manques;
}
