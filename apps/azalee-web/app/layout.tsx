import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
				{/* Material Symbols: self-hosted in globals.css, no external CSS needed */}
				<link rel="preconnect" href="https://www.googletagmanager.com" />
			</head>
			<Script
				id="gtm"
				strategy="lazyOnload"
				dangerouslySetInnerHTML={{
					// eslint-disable-next-line quotes
					__html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WLLFJZF8');`,
				}}
			/>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<LanguageProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="dark"
						themes={["light", "dark"]}
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
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}
