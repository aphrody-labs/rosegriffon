import {
	DiscordIcon,
	InstagramIcon,
	TikTokIcon,
	TwitchIcon,
	XIcon,
	YouTubeIcon,
} from "@rosegriffon/ui";
import type { ComponentType, SVGProps } from "react";

/**
 * LES RÉSEAUX DE L'ASSOCIATION — SOURCE UNIQUE.
 *
 * ── CE QUE CE FICHIER REMPLACE ─────────────────────────────────────────────
 * Les six mêmes liens existaient en TROIS exemplaires : cette liste (sans
 * icônes), un `switch` de SVG inlinés dans la barre latérale, et six blocs
 * `<Link>` écrits à la main dans le pied de page. Ils avaient déjà divergé —
 * le survol TikTok du pied de page portait le dégradé d'Instagram, recopié
 * d'un bloc voisin, et les icônes n'avaient ni le même `viewBox` ni la même
 * façon d'être dimensionnées.
 *
 * Ajouter un réseau, en retirer un, corriger une URL : **une seule ligne, ici**.
 *
 * ── PAS DE COULEUR EN DUR ──────────────────────────────────────────────────
 * `couleurSurvol` ne porte plus de hex. Les teintes de marque tierces qui
 * méritaient d'être gardées (Discord, Twitch, YouTube) sont des TOKENS déclarés
 * dans `packages/ui/src/styles.css` ; les autres retombent sur `bg-foreground`,
 * qui suit les quatre thèmes. Un hex ne suit pas le sélecteur de thème : c'est
 * exactement ce qui rendait des surfaces illisibles en thème sombre.
 */

export interface Reseau {
	/** Nom lisible, employé dans les libellés d'accessibilité. */
	nom: string;
	/** Abréviation pour les surfaces très étroites. */
	abrege: string;
	url: string;
	/** Libellé lu par un lecteur d'écran. Il dit l'ACTION, pas seulement le nom. */
	libelle: string;
	/** Classes de survol — tokens uniquement. */
	couleurSurvol: string;
	icone: ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;
	/** Encart affiché à côté du lien (barre latérale seulement). */
	badge?: string;
}

export const RESEAUX: readonly Reseau[] = [
	{
		abrege: "X",
		couleurSurvol: "hover:bg-foreground hover:text-background",
		icone: XIcon,
		libelle: "Suivre Rose Griffon sur X",
		nom: "X",
		url: "https://x.com/rose_griffon",
	},
	{
		abrege: "DC",
		badge: "Rejoignez-nous !",
		couleurSurvol: "hover:bg-discord hover:text-rg-sur-marine",
		icone: DiscordIcon,
		libelle: "Rejoindre le serveur Discord Rose Griffon",
		nom: "Discord",
		url: "https://discord.com/invite/rosegriffon",
	},
	{
		abrege: "TW",
		couleurSurvol: "hover:bg-twitch hover:text-rg-sur-marine",
		icone: TwitchIcon,
		libelle: "Suivre Rose Griffon TV sur Twitch",
		nom: "Twitch",
		url: "https://twitch.tv/rose_griffontv",
	},
	{
		abrege: "YT",
		couleurSurvol: "hover:bg-youtube hover:text-rg-sur-marine",
		icone: YouTubeIcon,
		libelle: "S'abonner à la chaîne YouTube Rose Griffon",
		nom: "YouTube",
		url: "https://www.youtube.com/@RoseGriffon",
	},
	{
		abrege: "IG",
		couleurSurvol: "hover:bg-instagram hover:text-rg-sur-marine",
		icone: InstagramIcon,
		libelle: "Suivre Rose Griffon sur Instagram",
		nom: "Instagram",
		url: "https://www.instagram.com/rose_griffonfr",
	},
	{
		abrege: "Tk",
		couleurSurvol: "hover:bg-foreground hover:text-background",
		icone: TikTokIcon,
		libelle: "Suivre Rose Griffon sur TikTok",
		nom: "TikTok",
		url: "https://www.tiktok.com/@rose_griffon",
	},
];

/**
 * Ancien nom de la liste, conservé le temps que les appelants migrent.
 *
 * @deprecated Utiliser `RESEAUX`, qui porte aussi l'icône.
 */
export const socialConfig = RESEAUX.map((reseau) => ({
	ariaLabel: reseau.libelle,
	badge: reseau.badge,
	color: reseau.couleurSurvol,
	name: reseau.nom,
	shortName: reseau.abrege,
	url: reseau.url,
}));
