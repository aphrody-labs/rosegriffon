import "./globals.css";

import type { Metadata, Viewport } from "next";

import { lato, notoSans, poppins, roboto } from "@/lib/fonts";

import ClientLayout from "./client-layout";

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
        {/* Theme Initialization Script - Prevents FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storageKey = 'rg-theme';
                  var defaultTheme = 'roy';
                  var supportedThemes = ['roy', 'gaelle'];
                  var theme = localStorage.getItem(storageKey);
                  
                  if (!theme || !supportedThemes.includes(theme)) {
                    theme = defaultTheme;
                  }
                  
                  document.documentElement.classList.add(theme);
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Anti-FOUC: Détection et correction des styles non chargés */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var checkStyles = function() {
                  var body = document.body;
                  if (body) {
                    var style = window.getComputedStyle(body);
                    var bg = style.backgroundColor;
                    // Si fond transparent après chargement, les styles ne sont pas chargés
                    if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
                      setTimeout(function() {
                        var newStyle = window.getComputedStyle(document.body);
                        if (newStyle.backgroundColor === 'rgba(0, 0, 0, 0)' || newStyle.backgroundColor === 'transparent') {
                          // Force reload sans cache
                          window.location.reload();
                        }
                      }, 2000);
                    }
                  }
                };
                if (document.readyState === 'complete') {
                  setTimeout(checkStyles, 100);
                } else {
                  window.addEventListener('load', function() { setTimeout(checkStyles, 100); });
                }
              })();
            `,
          }}
        />
        {/* Preconnect pour Supabase local */}
        <link rel="preconnect" href="https://rosegriffon.fr" />
        <link rel="dns-prefetch" href="https://rosegriffon.fr" />

        {/* Preconnect pour Discord CDN - économie estimée: 160ms */}
        <link rel="preconnect" href="https://cdn.discordapp.com" />
        <link rel="dns-prefetch" href="https://cdn.discordapp.com" />
      </head>
      <body
        className={`${roboto.className} ${roboto.variable} ${poppins.variable} ${notoSans.variable} ${lato.variable}`}
        suppressHydrationWarning
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
