import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { LanguageProvider } from "@/components/providers/language-provider";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Shell } from "@/components/Shell";
import { Toaster } from "@rose-griffon/ui";
import { auth, ensureUserProfile } from "@/lib/auth";
import { mintSupabaseJwt } from "@/lib/supabase/jwt";
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

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const cookieStore = await cookies();
	const cookieVal = cookieStore.get("sidebar_state")?.value;
	const defaultOpen = cookieVal ? cookieVal === "true" : true;

	// Get Better Auth session
	const reqHeaders = await headers();
	let user = null;
	let profile = null;
	let supabaseToken: string | null = null;

	try {
		const session = await auth.api.getSession({ headers: reqHeaders });

		if (session?.user) {
			({ user } = session);
			supabaseToken = mintSupabaseJwt(session.user.id);

			// Fetch profile using service-role-like access via minted JWT
			const supabaseUrl =
				process.env.SUPABASE_INTERNAL_URL ||
				process.env.NEXT_PUBLIC_SUPABASE_URL!;
			const supabase = createSupabaseClient(
				supabaseUrl,
				process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
				{
					global: { headers: { Authorization: `Bearer ${supabaseToken}` } },
				},
			);

			const { data } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", session.user.id)
				.maybeSingle();
			profile = data;

			// Self-healing: If profile is missing but user exists, create it now
			if (!profile) {
				console.warn(
					`[Self-Healing] Profile missing for user ${session.user.id}, attempting repair...`,
				);
				profile = await ensureUserProfile(session.user);
			}
		}
	} catch (error) {
		// No session — log explicite pour debug runtime Vercel (msg complet)
		if (process.env.NODE_ENV === "production") {
			console.error(
				"[layout] auth.api.getSession throw:",
				error instanceof Error ? error.message : String(error),
				error instanceof Error && error.stack
					? error.stack.split("\n").slice(0, 3)
					: null,
			);
		}
	}

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
