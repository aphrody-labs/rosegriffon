import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import { ThemeProvider as RawNextThemesProvider } from "next-themes";

// next-themes < v1 + React 19 typings drift on `children` prop: cast once to
// a permissive FC. Runtime behavior is unchanged.
const NextThemesProvider = RawNextThemesProvider as unknown as React.FC<{
  children: React.ReactNode;
  [k: string]: unknown;
}>;
import { LanguageProvider } from "@/components/providers/language-provider";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Shell } from "@/components/Shell";
import { Toaster } from "@rosegriffon/ui";
import { auth, ensureUserProfile } from "@/lib/auth";
import { mintSupabaseJwt } from "@/lib/supabase/jwt";
import "./globals.css";

const googleSans = localFont({
  src: "../public/fonts/Google_Sans_Flex/GoogleSansFlex-Variable.woff2",
  variable: "--font-google-sans",
  display: "swap",
});

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://azalee.rosegriffon.fr"),
  title: {
    default: "Azalée - Inazuma Eleven Victory Road Wiki",
    template: "%s",
  },
  description:
    "Base de données complète Inazuma Eleven: Victory Road. Personnages, techniques, objets et actualités en français.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.webp",
    shortcut: "/icon.webp",
    apple: "/icon.webp",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Azalée",
    startupImage: ["/icon.webp"],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Azalée - Inazuma Eleven Victory Road",
  },
  twitter: {
    card: "summary",
    site: "@Azalee_IE",
    creator: "@Azalee_IE",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": "/news/feed.xml",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#FFB700",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get("sidebar:state")?.value;
  const defaultOpen = cookieVal ? cookieVal === "true" : true;

  // Get Better Auth session
  const reqHeaders = await headers();
  let user = null;
  let profile = null;
  let supabaseToken: string | null = null;

  try {
    const session = await auth.api.getSession({ headers: reqHeaders });

    if (session?.user) {
      user = session.user;
      supabaseToken = mintSupabaseJwt(session.user.id);

      // Fetch profile using service-role-like access via minted JWT
      const supabaseUrl =
        process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
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
  } catch {
    // No session
  }

  return (
    <html lang="fr" suppressHydrationWarning>
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LanguageProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="azalee-dark"
            enableSystem
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
guageProvider>
      </body>
    </html>
  );
}
