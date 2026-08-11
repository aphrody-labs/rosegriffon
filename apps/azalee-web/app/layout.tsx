import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";

import { LanguageProvider } from "@/components/providers/language-provider";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Shell } from "@/components/Shell";
import { Toaster } from "@rose-griffon/ui";
import "./globals.css";

const geistSans = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
});

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
	alternates: {
		canonical: "/",
		types: {
			"application/rss+xml": "/news/feed.xml",
		},
	},
	appleWebApp: {
		capable: true,
		startupImage: ["/icon.webp"],
		statusBarStyle: "default",
		title: "Azalée",
	},
	description:
		"Base de données complète Inazuma Eleven: Victory Road. Personnages, techniques, objets et actualités en français.",
	formatDetection: {
		telephone: false,
	},
	icons: {
		apple: "/icon.webp",
		icon: "/icon.webp",
		shortcut: "/icon.webp",
	},
	manifest: "/manifest.webmanifest",
	metadataBase: new URL("https://azalee.rosegriffon.fr"),
	openGraph: {
		locale: "fr_FR",
		siteName: "Azalée - Inazuma Eleven Victory Road",
		type: "website",
	},
	robots: {
		follow: true,
		googleBot: {
			follow: true,
			index: true,
			"max-image-preview": "large",
			"max-snippet": -1,
			"max-video-preview": -1,
		},
		index: true,
	},
	title: {
		default: "Azalée - Inazuma Eleven Victory Road Wiki",
		template: "%s",
	},
	twitter: {
		card: "summary",
		creator: "@Azalee_IE",
		site: "@Azalee_IE",
	},
};

export const viewport: Viewport = {
	initialScale: 1,
	themeColor: "#FFB700",
	viewportFit: "cover",
	width: "device-width",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const defaultOpen = true;
	const user = null;
	const profile = null;
	const supabaseToken: string | null = null;

	return (
		<html lang="fr" className="dark" suppressHydrationWarning>
			<head>
				{/* Pré-application du thème avant hydratation (évite le FOUC).
				    Le <html> est rendu en `dark` côté serveur (thème par défaut) ; sans
				    ce script, un visiteur en Roy/Gaëlle/clair verrait d'abord la palette
				    sombre. next-themes prend le relais une fois monté. */}
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var k='azalee-theme',d='dark',s=['light','dark','roy','gaelle'];var t=localStorage.getItem(k);if(!t||s.indexOf(t)===-1)t=d;var e=document.documentElement;s.forEach(function(c){e.classList.remove(c)});e.classList.add(t);}catch(e){}})();`,
					}}
				/>
				{/* Material Symbols: self-hosted in globals.css, no external CSS needed */}
				<link rel="preconnect" href="https://www.googletagmanager.com" />
				<link rel="author" href="/humans.txt" />
				<link rel="author" href="https://x.com/yoyo__goat" />
				{/* Données structurées site-wide : Organization + WebSite + Person (rich results Google). */}
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
									// Réseau Rose Griffon : 3 domaines siblings + tous les réseaux sociaux.
									// sameAs identique sur website / azalee / achillea (entité cohérente).
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
										{ "@id": "https://achillea.rosegriffon.fr/#website" },
									],
								},
								{
									"@type": "WebSite",
									"@id": "https://azalee.rosegriffon.fr/#website",
									url: "https://azalee.rosegriffon.fr",
									name: "Azalée",
									inLanguage: "fr-FR",
									publisher: { "@id": "https://rosegriffon.fr/#organization" },
									creator: { "@id": "https://rosegriffon.fr/#yoyo" },
									isPartOf: { "@id": "https://rosegriffon.fr/#organization" },
								},
							],
						}),
					}}
				/>
			</head>
			<Script
				id="gtm"
				strategy="lazyOnload"
				dangerouslySetInnerHTML={{
					// eslint-disable-next-line quotes
					__html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WLLFJZF8');`,
				}}
			/>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<LanguageProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="dark"
						themes={["light", "dark", "roy", "gaelle"]}
						storageKey="azalee-theme"
						enableSystem={false}
						disableTransitionOnChange
					>
						<SupabaseProvider initialToken={supabaseToken}>
							<Shell user={user} profile={profile} defaultOpen={defaultOpen}>
								{children}
							</Shell>
						</SupabaseProvider>
						<Toaster />
					</ThemeProvider>
				</LanguageProvider>
			</body>
		</html>
	);
}
