import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site-url";
import { withDefaultOgImage } from "@/lib/seo";
import { IevrGameCanvasClient } from "@/components/ievr/IevrGameCanvasClient";

export const metadata: Metadata = {
  title: "Jouer à Inazuma Eleven: Victory Road | Navigateur Web",
  description:
    "Expérimentez Inazuma Eleven: Victory Road directement dans votre navigateur. Moteur WebAssembly 100% Rust, physique de match nie-runtime, simulation déterministe.",
  alternates: { canonical: absoluteUrl("/play") },
  openGraph: withDefaultOgImage({
    title: "Jouer à Inazuma Eleven: Victory Road dans le Navigateur",
    description: "Moteur IEVR WebAssembly 100% Rust compilé pour le navigateur.",
    url: absoluteUrl("/play"),
    siteName: "Rose Griffon",
    locale: "fr_FR",
    type: "website",
  }),
};

export default function PlayPage() {
  return (
    <main className="fixed inset-0 h-dvh w-screen overflow-hidden bg-black">
      <IevrGameCanvasClient />
    </main>
  );
}
