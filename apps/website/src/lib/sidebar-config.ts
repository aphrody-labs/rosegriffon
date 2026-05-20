/**
 * Configuration centralisée du menu latéral
 * Maintient la séparation entre config et logique de composant
 * Optimisé pour UI/UX moderne avec support complet des états et animations
 */

import {
	Building,
	Handshake,
	Heart,
	Mail,
	MapPin,
	Newspaper,
	PencilLine,
	ScrollText,
	Sparkles,
	UserPlus,
	Users,
} from "lucide-react";

import { RGTVIcon } from "@/components/sidebar/atoms/RGTVIcon";
export interface SubMenuItem {
	title: string;
	url: string;
	icon: React.ElementType;
	badge?: {
		text: string;
		variant?: "new" | "hot" | "beta" | "soon";
		color?: string;
	};
	description?: string; // Pour tooltips ou sous-titres
	shortcut?: string; // Ex: "⌘K" pour accessibilité clavier
	ariaLabel?: string; // Accessibilité améliorée
}

export interface MenuItem {
	title: string;
	url?: string;
	icon: React.ElementType;
	className?: string;
	collapsible?: boolean;
	items?: SubMenuItem[];
	badge?: {
		text: string;
		variant?: "new" | "hot" | "beta" | "soon";
		color?: string;
	};
	description?: string; // Pour tooltips
	isExternal?: boolean; // Pour liens externes
	ariaLabel?: string; // Accessibilité améliorée
}

export interface MenuSection {
	label: string;
	items: MenuItem[];
	icon?: React.ElementType; // Icône optionnelle pour la section
	collapsedByDefault?: boolean; // Pour sections pliables
}

/**
 * Helper pour générer les classes CSS des badges de manière cohérente
 * Adapté aux thèmes Roy (#344E8C bleu) et Gaëlle (#B03519 vermillon)
 * Retourne un objet avec bg, text, border et animation
 */
export function getBadgeVariant(
	variant: "new" | "hot" | "beta" | "soon" = "new",
) {
	const variants = {
		// NOUVEAU - Thème Roy (Bleu élégant #344E8C)
		new: {
			animation: "animate-pulse",
			bg: "bg-[#344E8C]/15 dark:bg-[#4088b8]/20",
			border: "border-[#344E8C]/30 dark:border-[#4088b8]/40",
			text: "text-[#243d5b] dark:text-[#4088b8]",
		},
		// HOT - Thème Gaëlle (Vermillon passion #B03519)
		hot: {
			animation: "animate-pulse",
			bg: "bg-[#B03519]/15 dark:bg-[#B03519]/20",
			border: "border-[#B03519]/30 dark:border-[#B03519]/40",
			text: "text-[#770007] dark:text-[#FABBA2]",
		},
		// BETA - Doré Roy (#FFC46E)
		beta: {
			animation: "",
			bg: "bg-[#FFC46E]/20 dark:bg-[#FFC46E]/25",
			border: "border-[#FFC46E]/40 dark:border-[#FFC46E]/50",
			text: "text-[#344E8C] dark:text-[#FFC46E]",
		},
		// SOON - Beige Gaëlle (#FABBA2)
		soon: {
			animation: "",
			bg: "bg-[#FABBA2]/20 dark:bg-[#FABBA2]/25",
			border: "border-[#FABBA2]/40 dark:border-[#FABBA2]/50",
			text: "text-[#B03519] dark:text-[#FABBA2]",
		},
	};

	return variants[variant];
}

/**
 * Classes de transition pré-configurées pour cohérence
 */
export const sidebarTransitions = {
	activeIndicator: "border-l-4 border-primary",
	badge: "transition-all duration-200 hover:scale-110",
	focus:
		"focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/30",
	hover: "hover:scale-105 hover:shadow-md",
	item: "transition-all duration-200 ease-in-out",
};

/**
 * Configuration du menu "L'association"
 * Organisé par importance et fréquence d'utilisation
 */
export const assoMenu: MenuSection = {
	items: [
		{
			title: "Notre équipe",
			collapsible: true,
			icon: Users,
			description: "Découvrez qui nous sommes",
			ariaLabel: "Menu de l'équipe Rose Griffon",
			items: [
				{
					title: "L'association",
					url: "/notre-equipe/association",
					icon: Building,
					description: "Présentation officielle",
				},
				{
					title: "Le Staff RG",
					url: "/notre-equipe/staff",
					icon: Users,
					description: "Rencontrez notre équipe",
				},
				{
					title: "Les partenaires",
					url: "/notre-equipe/partenaires",
					icon: Handshake,
					description: "Nos précieux partenaires",
				},
			],
		},
		{
			title: "Projets",
			url: "/projets",
			icon: Sparkles,
			description: "Outils et projets",
			ariaLabel: "Testez les",
		},
		{
			title: "Chroniques",
			url: "/chroniques",
			icon: Newspaper,
			description: "Articles et actualités",
			ariaLabel: "Lire les chroniques",
		},

		{
			title: "Rose Griffon TV",
			url: "/rose-griffon-tv",
			icon: RGTVIcon,
			description: "Notre chaîne officielle",
			isExternal: false,
			ariaLabel: "Accéder à Rose Griffon TV",
		},
		{
			title: "Événements",
			url: "/evenements",
			icon: MapPin,
			description: "Nos événements à venir",
			ariaLabel: "Voir nos événements",
		},
	],
	label: "L'association",
};

/**
 * Configuration du menu "Explorer"
 */
export const exploreMenu: MenuSection = {
	items: [],
	label: "Explorer",
};

/**
 * Configuration du menu "Nous concernant"
 * Call-to-actions organisés par priorité
 */
export const contactMenu: MenuSection = {
	items: [
		{
			title: "Nous rejoindre",
			url: "/a-propos/rejoindre-rg",
			icon: UserPlus,
			description: "Devenez membre",
			ariaLabel: "Rejoindre l'association Rose Griffon",
			badge: {
				text: "RECRUTEMENT",
				variant: "hot",
			},
		},
		{
			title: "Charte et engagement",
			url: "/charte-engagements",
			icon: ScrollText,
			description: "Nos valeurs et principes",
			ariaLabel: "Consulter notre charte d'engagement",
		},
		{
			title: "Nous contacter",
			url: "/a-propos/contact",
			icon: PencilLine,
			description: "Une question ? Écrivez-nous",
			ariaLabel: "Contacter Rose Griffon",
		},
		{
			title: "Cellule de médiation",
			url: "/cellule-de-mediation",
			icon: Mail,
			description: "Aide et assistance",
			ariaLabel: "Accéder à la cellule de médiation",
		},
		{
			title: "Nous soutenir",
			url: "/nous-soutenir",
			icon: Heart,
			className: "rainbow font-extrabold",
			description: "Soutenez notre mission",
			ariaLabel: "Soutenir financièrement Rose Griffon",
			badge: {
				text: "❤️",
				variant: "hot",
			},
		},
	],
	label: "Nous concernant",
};

/**
 * Validation utilitaire pour les items avec support des nouvelles propriétés
 */
export function isValidMenuItem(item: unknown): item is MenuItem {
	if (!item || typeof item !== "object") {return false;}
	const m = item as Record<string, unknown>;
	return (
		typeof m.title === "string" &&
		typeof m.icon === "function" &&
		(m.url === undefined || typeof m.url === "string") &&
		(m.collapsible === undefined || typeof m.collapsible === "boolean") &&
		(m.description === undefined || typeof m.description === "string") &&
		(m.isExternal === undefined || typeof m.isExternal === "boolean") &&
		(m.ariaLabel === undefined || typeof m.ariaLabel === "string")
	);
}

export function isValidSubMenuItem(item: unknown): item is SubMenuItem {
	if (!item || typeof item !== "object") {return false;}
	const m = item as Record<string, unknown>;
	return (
		typeof m.title === "string" &&
		typeof m.url === "string" &&
		typeof m.icon === "function" &&
		(m.description === undefined || typeof m.description === "string") &&
		(m.shortcut === undefined || typeof m.shortcut === "string")
	);
}
