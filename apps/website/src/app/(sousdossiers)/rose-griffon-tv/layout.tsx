import type { Metadata, Viewport } from "next";

import { MobileBottomNavigationWrapper } from "@/components/layout/MobileBottomNavigationWrapper";

export const metadata: Metadata = {
  title: "Rose Griffon TV | 100% Inazuma Eleven",
  description:
    "Votre rendez-vous quotidien 100% Inazuma Eleven sur Twitch et YouTube avec Rose Griffon TV.",
  openGraph: {
    title: "Rose Griffon TV | 100% Inazuma Eleven",
    description:
      "Votre rendez-vous quotidien 100% Inazuma Eleven sur Twitch et YouTube avec Rose Griffon TV.",
    type: "website",
    images: [
      {
        url: "/rgtv/rgtv.webp",
        width: 1200,
        height: 630,
        alt: "Rose Griffon TV - WebTV Inazuma Eleven",
      },
    ],
    url: "https://rosegriffon.fr/rose-griffon-tv",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rose Griffon TV | 100% Inazuma Eleven",
    description: "Votre rendez-vous quotidien 100% Inazuma Eleven sur Twitch et YouTube.",
    images: ["/rgtv/rgtv.webp"],
    creator: "@rose_griffon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#a14b3f",
};

export default function RoseGriffonTvLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MobileBottomNavigationWrapper />
    </>
  );
}
