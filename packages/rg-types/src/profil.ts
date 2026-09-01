/**
 * Le profil public — ce qu'un membre peut écrire sur lui-même, et ce qu'il ne
 * peut pas.
 *
 * ── POURQUOI CE FICHIER EXISTE ─────────────────────────────────────────────
 * Le même schéma était écrit deux fois, dans `apps/website/.../account/actions.ts`
 * et dans `apps/azalee/app/settings/actions.ts`, et les deux acceptaient
 * `badges: z.array(z.string())` — c'est-à-dire n'importe quoi. Deux
 * conséquences, l'une visible et l'autre pas :
 *
 *   - un badge inventé s'écrivait en base et n'apparaissait nulle part (la
 *     table de rendu ne connaît que cinq identifiants) : l'enregistrement
 *     répondait « profil mis à jour » et le membre ne voyait rien ;
 *   - surtout, **« Staff » et « Patreon » étaient auto-attribuables**. Le
 *     formulaire les proposait à tout le monde, le serveur les écrivait sans
 *     rien vérifier, et le profil public affichait « Membre de l'équipe
 *     d'administration du site » à côté du pseudo de qui le demandait.
 *
 * Le contrat vit donc ici, une fois, comme celui du bot dans `bot.ts`.
 */
import { z } from "zod";

/** Les seuls badges qui existent — la table de rendu ne connaît qu'eux. */
export const BADGES_PROFIL = ["founder", "vip", "beta", "patreon", "staff"] as const;

export type BadgeProfil = (typeof BADGES_PROFIL)[number];

/**
 * Badges que l'on ne s'attribue pas soi-même.
 *
 * Ils affirment quelque chose de vérifiable : appartenir à l'équipe, soutenir
 * le projet. Les autres (`founder`, `vip`, `beta`) sont des distinctions posées
 * à la main par l'administration ; ils restent modifiables par leur porteur,
 * qui peut choisir de les afficher ou non, mais l'ajout d'un badge mérité passe
 * par une vérification en base.
 */
export const BADGES_MERITES = ["staff", "patreon"] as const satisfies readonly BadgeProfil[];

/** Nombre de badges affichables à la fois, à côté du pseudo. */
export const MAX_BADGES_PROFIL = 3;

/** Longueur maximale de la biographie. */
export const MAX_BIO_PROFIL = 500;

/** Les schémas d'URL qu'un navigateur doit suivre — et rien d'autre. */
const SCHEMAS_LIEN = new Set(["http:", "https:"]);

/**
 * Un lien de profil, rendu en `href` sur une page publique.
 *
 * `z.string().url()` ne suffit PAS : `javascript:alert(1)` est une URL valide au
 * sens de la norme, et elle était acceptée telle quelle puis posée en `href`
 * sur `/profil/<pseudo>`. Un clic d'un visiteur exécutait alors le script de
 * quelqu'un d'autre, dans sa propre session.
 */
export const SchemaLienPublic = z
	.string()
	.url("URL invalide")
	.refine((valeur) => {
		try {
			return SCHEMAS_LIEN.has(new URL(valeur).protocol);
		} catch {
			return false;
		}
	}, "Le lien doit commencer par http:// ou https://");

/**
 * Ce qu'une page de compte a le droit d'écrire sur `profiles`.
 *
 * `badges` est déclaré en `string[]` EN ENTRÉE — le formulaire partagé n'a pas
 * de raison de connaître le type littéral — et restreint aux badges connus en
 * sortie. Les actions serveur doivent donc typer leur paramètre avec
 * `z.input<typeof SchemaProfilPublic>`, jamais `z.infer`.
 */
export const SchemaProfilPublic = z.object({
	badges: z
		.array(z.string())
		.max(MAX_BADGES_PROFIL)
		.pipe(z.array(z.enum(BADGES_PROFIL)).max(MAX_BADGES_PROFIL)),
	banner_url: z.string().optional().or(z.literal("")),
	bio: z.string().max(MAX_BIO_PROFIL).optional(),
	full_name: z.string().optional(),
	twitter_handle: z.string().optional(),
	username: z
		.string()
		.min(3, "Le nom d'utilisateur doit faire au moins 3 caractères.")
		.max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères."),
	website: SchemaLienPublic.optional().or(z.literal("")),
});

export type ProfilPublic = z.infer<typeof SchemaProfilPublic>;
export type ProfilPublicSaisi = z.input<typeof SchemaProfilPublic>;

/** Un badge doit-il être mérité pour être ajouté ? */
export function badgeMerite(badge: string): boolean {
	return (BADGES_MERITES as readonly string[]).includes(badge);
}

/**
 * Filtre les badges demandés selon ce que le compte peut prouver.
 *
 * Les badges DÉJÀ posés sont conservés : cette fonction filtre les ajouts. Sans
 * cette nuance, une simple modification de biographie retirerait le badge
 * « Staff » d'un administrateur le jour où la lecture de son rôle échoue — un
 * effet de bord silencieux, et dans le sens le plus difficile à diagnostiquer.
 */
export function filtrerBadges(
	demandes: readonly string[],
	droits: { estStaff: boolean; estMecene: boolean; dejaPoses: readonly string[] }
): string[] {
	const deja = new Set(droits.dejaPoses);
	return demandes.filter((badge) => {
		if (badge === "staff") {
			return droits.estStaff || deja.has("staff");
		}
		if (badge === "patreon") {
			return droits.estMecene || deja.has("patreon");
		}
		return true;
	});
}
