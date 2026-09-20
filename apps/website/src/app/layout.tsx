import "./globals.css";

import type { Metadata, Viewport } from "next";

import { lato, notoSans, poppins, roboto } from "@/lib/fonts";
import { Geist } from "next/font/google";

import { GoogleTagManager } from "@next/third-parties/google";
import { ADSENSE_CLIENT, AdSenseScript, THEMES } from "@rosegriffon/ui";

import ClientLayout from "./client-layout";

/** Conteneur Google Tag Manager. Absent = aucune balise injectée. */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

const geistSans = Geist({
	display: "swap",
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export const viewport: Viewport = {
	themeColor: "#a14b3f",
	width: "device-width",
	initialScale: 1,
	// MaximumScale et userScalable supprimés pour accessibilité WCAG
};

export const metadata: Metadata = {
	alternates: {
		// PAS de `canonical` ici. Les métadonnées Next sont héritées : un canonical
		// posé sur le layout racine s'applique à toute page qui n'en déclare pas un,
		// et /projets, /evenements, /notre-equipe, /legal/*, /shop, /shop/<produit>
		// et les chroniques annonçaient donc toutes « la page canonique, c'est
		// l'accueil » — soit l'instruction explicite de ne pas les indexer. L'accueil
		// pose le sien dans `app/page.tsx` ; chaque page publique pose le sien.
		types: {
		},
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Rose Griffon",
	},
	authors: [{ name: "Rose Griffon" }],
	creator: "Association Rose Griffon",
	description:
		"Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France. Découvrez nos événements, projets et rejoignez-nous !",
	formatDetection: {
		telephone: false,
	},
	icons: {
		apple: "/RG_Logo_V2.5.webp",
		icon: "/RG_Logo_V2.5.webp",
		shortcut: "/RG_Logo_V2.5.webp",
	},
	keywords:
		"Rose Griffon, Inazuma Eleven, association, communauté, gaming, France, Azalée, Achilléa, Roy, Gaëlle, Inazuma Eleven France, Inazuma Eleven France Association, Inazuma Eleven France Association Rose Griffon",
	metadataBase: new URL("https://rosegriffon.fr"),
	// Balise de propriété AdSense. C'est ce que la vérification du tableau de bord
	// cherche dans le HTML servi ; le script seul ne suffit pas à valider le site.
	other: {
		"google-adsense-account": ADSENSE_CLIENT,
	},
	openGraph: {
		description:
			"Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France. Découvrez nos événements, projets et rejoignez-nous !",
		locale: "fr_FR",
		siteName: "Rose Griffon",
		title: "Rose Griffon | Association Inazuma Eleven France",
		type: "website",
		url: "https://rosegriffon.fr",
	},
	publisher: "Association Rose Griffon",
	robots: {
		follow: true,
		googleBot: {
			follow: true,
			index: true,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
		index: true,
	},
	title: "Rose Griffon | Association Inazuma Eleven France",
	twitter: {
		card: "summary_large_image",
		creator: "@rose_griffon",
		description:
			"Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France",
		title: "Rose Griffon | Association Inazuma Eleven France",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="fr" suppressHydrationWarning>
			<head>
				{/*
				 * Pré-application du thème avant hydratation (évite le FOUC) ;
				 * `next-themes` prend le relais une fois monté.
				 *
				 * La liste est DÉRIVÉE du catalogue `THEMES`, elle n'est plus recopiée.
				 * Elle l'était, et elle avait divergé : le script n'acceptait que
				 * `roy`, `gaelle`, `azalee-light` et `azalee-dark`. Un visiteur ayant
				 * choisi le thème Achilléa voyait donc son choix REFUSÉ au chargement
				 * — `indexOf(t) === -1` — et la page repeinte en `roy`, y compris sur
				 * `/achillea`. Le thème existait dans `styles.css` et dans le
				 * sélecteur, mais ne survivait pas à un rechargement.
				 */}
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var k='rg-theme',d='roy',s=${JSON.stringify(Object.keys(THEMES))};var t=localStorage.getItem(k);if(!t||s.indexOf(t)===-1)t=d;document.documentElement.classList.add(t);}catch(e){}})();`,
					}}
				/>
				<link rel="preconnect" href="https://cdn.discordapp.com" />
				<link rel="dns-prefetch" href="https://cdn.discordapp.com" />
				<link rel="preconnect" href="https://pagead2.googlesyndication.com" />
				<link rel="author" href="/humans.txt" />
				{/* Données structurées site-wide : Organization + WebSite (rich results Google). */}
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@graph": [
								{
									"@type": "Person",
									"@id": "https://rosegriffon.fr/#yoyo",
									name: "yoyo",
									alternateName: "yoyo",
									jobTitle: "Développeur & fondateur",
									url: "https://x.com/yoyo__goat",
									sameAs: ["https://x.com/yoyo__goat"],
									worksFor: { "@id": "https://rosegriffon.fr/#organization" },
								},
								{
									"@type": "Organization",
									"@id": "https://rosegriffon.fr/#organization",
									name: "Rose Griffon",
									alternateName: "Association Rose Griffon",
									url: "https://rosegriffon.fr",
									logo: "https://rosegriffon.fr/RG_Logo_V2.5.webp",
									description:
										"Association rassemblant la communauté Inazuma Eleven en France.",
									founder: { "@id": "https://rosegriffon.fr/#yoyo" },
									// Réseau Rose Griffon : 3 domaines siblings + tous les réseaux sociaux
									// (X/YouTube/Twitch/Instagram/Discord). sameAs partagé à l'identique
									// sur website / azalee / achillea pour une entité Organization cohérente.
									sameAs: [
										"https://rosegriffon.fr",
										"https://azalee.rosegriffon.fr",
										"https://achillea.rosegriffon.fr",
										"https://x.com/rose_griffon",
										"https://x.com/Azalee_IE",
										"https://x.com/Achillea_IE",
										"https://www.youtube.com/@RoseGriffon",
										"https://twitch.tv/rose_griffontv",
										"https://www.instagram.com/rose_griffonfr",
										"https://www.instagram.com/azaleefr",
										"https://discord.gg/TYzQvbByv4",
										"https://disboard.org/server/1072991720268111892",
										"https://discord.do/fr/inazuma-eleven-fr-%E2%9A%BD-rose-griffon/",
									],
									subOrganization: [
										{ "@id": "https://azalee.rosegriffon.fr/#website" },
										{ "@id": "https://achillea.rosegriffon.fr/#website" },
									],
								},
								{
									"@type": "WebSite",
									"@id": "https://rosegriffon.fr/#website",
									url: "https://rosegriffon.fr",
									name: "Rose Griffon",
									inLanguage: "fr-FR",
									publisher: { "@id": "https://rosegriffon.fr/#organization" },
									creator: { "@id": "https://rosegriffon.fr/#yoyo" },
								},
							],
						}),
					}}
				/>
				<script
					type="speculationrules"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							prefetch: [
								{
									where: {
										and: [
											{ href_matches: "/*" },
											{ not: { href_matches: "/admin/*" } },
											{ not: { href_matches: "/api/*" } },
											{ not: { selector_matches: "[rel~=nofollow]" } },
										],
									},
									eagerness: "moderate",
								},
							],
						}),
					}}
				/>
			</head>
			<body
				className={`${geistSans.variable} ${roboto.className} ${roboto.variable} ${poppins.variable} ${notoSans.variable} ${lato.variable}`}
				suppressHydrationWarning
			>
			{/* Google Tag Manager — composant officiel de `@next/third-parties`.
			    Il injecte le script du conteneur ET l'`<iframe>` de repli `noscript`,
			    en respectant la stratégie de chargement de Next : pas de balise collée
			    à la main dans le `<head>`, qui bloquerait le rendu.
			    L'identifiant vient de l'environnement : sans lui, rien n'est chargé,
			    ce qui laisse les environnements de développement propres. */}
				{GTM_ID && <GoogleTagManager gtmId={GTM_ID} />}
				{/* Google AdSense — chargeur unique du site. Les annonces automatiques
				    sont pilotées depuis le tableau de bord, donc aucune page n'a
				    d'emplacement à déclarer. La CSP de rosegriffon.fr est posée par
				    nginx (`infra/nginx/rg-csp-website.inc`) : y ajouter les hôtes
				    publicitaires avant toute bascule en mode bloquant. */}
				<AdSenseScript />
				<ClientLayout>{children}</ClientLayout>
			</body>
		</html>
	);
}
