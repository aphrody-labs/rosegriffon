import "./globals.css";

import type { Metadata, Viewport } from "next";

import { lato, notoSans, poppins, roboto } from "@/lib/fonts";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import ClientLayout from "./client-layout";

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
		canonical: "/",
		types: {
			"text/markdown": "/llm.txt",
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
				{/* Pré-application du thème avant hydration (évite le FOUC).
            next-themes prend le relais une fois monté. */}
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var k='rg-theme',d='roy',s=['roy','gaelle','azalee-light','azalee-dark'];var t=localStorage.getItem(k);if(!t||s.indexOf(t)===-1)t=d;document.documentElement.classList.add(t);}catch(e){}})();`,
					}}
				/>
				<link rel="preconnect" href="https://cdn.discordapp.com" />
				<link rel="dns-prefetch" href="https://cdn.discordapp.com" />
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
				<ClientLayout>{children}</ClientLayout>
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}
