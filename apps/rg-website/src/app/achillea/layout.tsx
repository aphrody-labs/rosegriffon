import type { Metadata } from "next";
import "./achillea.css";
import "./primeicons.css";
import { AchilleaNav } from "@/components/achillea/AchilleaNav";

export const metadata: Metadata = {
	title: {
		default: "Achilléa — E-Sport & Compétition Inazuma Eleven | Rose Griffon",
		template: "%s | Achilléa — Rose Griffon",
	},
	description:
		"La scène compétitive officielle Inazuma Eleven: Victory Road. Clans, classements classés ELO (1v1, 2v2), Astral League, tournois communautaires et bot Discord officiel.",
	/*
	 * PAS de `alternates.canonical` ici.
	 *
	 * `alternates` est hérité par tous les segments enfants : le canonical
	 * `/achillea` qui vivait dans ce layout déclarait les 40 pages du domaine
	 * comme de simples variantes de l'accueil, et demandait donc leur
	 * désindexation. Chaque page porte désormais le sien via
	 * `metadonneesAchillea()` (`./metadonnees.ts`).
	 */
	icons: {
		icon: "/achillea/achillea_ico.png",
		shortcut: "/achillea/achillea_ico.png",
		apple: "/achillea/achillea_ico.png",
	},
	openGraph: {
		title: "Achilléa — E-Sport & Compétition Inazuma Eleven",
		description:
			"La scène compétitive officielle Inazuma Eleven: Victory Road. Tournois, clans, ranked et championnats.",
		url: "https://rosegriffon.fr/achillea",
		siteName: "Achilléa Rose Griffon",
		locale: "fr_FR",
		type: "website",
		images: [
			{
				url: "/achillea/achillea-banner.png",
				width: 1200,
				height: 630,
				alt: "Bannière Achilléa",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Achilléa — E-Sport Inazuma Eleven",
		description:
			"La scène compétitive Inazuma Eleven: Victory Road. Tournois, clans, ranked et championnats.",
		images: ["/achillea/achillea-banner.png"],
	},
};

export default function AchilleaLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="achillea-scope min-h-full">
			{/*
			 * Sous-navigation Achilléa, À L'INTÉRIEUR du shell Rose Griffon.
			 *
			 * `AchilleaNav` existait — 193 lignes — mais n'était importée nulle
			 * part : le portage ne rendait qu'un `<div>` nu. Achilléa n'avait donc
			 * AUCUNE navigation propre, alors que le front Angular monte
			 * `shared/components/header/` globalement. Le menu latéral de RG mène
			 * aux sections, celui-ci porte l'identité et les accès rapides du
			 * domaine compétitif — les deux sont complémentaires, pas redondants.
			 */}
			<AchilleaNav />
			{children}
		</div>
	);
}
