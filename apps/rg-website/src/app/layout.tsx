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
											{ not: { selector_matches: "[rel~=nofollow]" } }
										]
									},
									eagerness: "moderate"
								}
							]
						})
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
