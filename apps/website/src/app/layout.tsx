import "./globals.css";

import type { Metadata, Viewport } from "next";

import { lato, notoSans, poppins, roboto } from "@/lib/fonts";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import ClientLayout from "./client-layout";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
	display: "swap",
});

export const viewport: Viewport = {
	themeColor: "#a14b3f",
	width: "device-width",
	initialScale: 1,
	// maximumScale et userScalable supprimés pour accessibilité WCAG
};

export const metadata: Metadata = {
	title: "Rose Griffon | Association Inazuma Eleven France",
	description:
		"Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France. Découvrez nos événements, projets et rejoignez-nous !",
	keywords:
		"Rose Griffon, Inazuma Eleven, association, communauté, gaming, France, Azalée, Achilléa, Roy, Gaëlle, Inazuma Eleven France, Inazuma Eleven France Association, Inazuma Eleven France Association Rose Griffon",
	authors: [{ name: "Rose Griffon" }],
	creator: "Association Rose Griffon",
	publisher: "Association Rose Griffon",
	icons: {
		icon: "/RG_Logo_V2.5.webp",
		shortcut: "/RG_Logo_V2.5.webp",
		apple: "/RG_Logo_V2.5.webp",
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Rose Griffon",
	},
	formatDetection: {
		telephone: false,
	},
	metadataBase: new URL("https://rosegriffon.fr"),
	alternates: {
		canonical: "/",
		types: {
			"text/markdown": "/llm.txt",
		},
	},
	openGraph: {
		title: "Rose Griffon | Association Inazuma Eleven France",
		description:
			"Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France. Découvrez nos événements, projets et rejoignez-nous !",
		url: "https://rosegriffon.fr",
		siteName: "Rose Griffon",
		locale: "fr_FR",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Rose Griffon | Association Inazuma Eleven France",
		description:
			"Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France",
		creator: "@rose_griffon",
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
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
