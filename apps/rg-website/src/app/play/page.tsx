import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles, Trophy, Cpu, ShieldCheck } from "lucide-react";
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
    <main className="min-h-screen bg-linear-to-b from-neutral-950 via-neutral-900 to-black text-white pt-6 pb-20 px-4 md:px-8">
      <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/wiki"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white transition px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10"
            >
              <ArrowLeft className="size-3.5" /> Retour au Wiki
            </Link>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Wasm 60 FPS
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider flex items-center gap-2.5">
            <Sparkles className="size-6 text-[#F4D03F]" />
            Inazuma Eleven: Victory Road <span className="text-[#F4D03F]">Web</span>
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Moteur de jeu complet exécuté en local dans votre navigateur via WebAssembly & Rust 2024.
          </p>
        </div>

        {/* Feature badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80">
            <Cpu className="size-4 text-[#F07D7D]" />
            <span>Moteur nie-runtime</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>Zéro émulation</span>
          </div>
        </div>
      </div>

      {/* Main Game Screen */}
      <section className="max-w-6xl mx-auto mb-10">
        <IevrGameCanvasClient />
      </section>

      {/* Information & Architecture grid */}
      <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <Trophy className="size-4 text-[#F4D03F]" /> Machine d&apos;États Officielle
          </h2>
          <p className="text-xs text-white/60 leading-relaxed">
            Parcourez l&apos;écran-titre, le menu principal à 9 onglets, la sélection des 5 modes de jeu et lancez une
            simulation de match interactive pilotable au clavier.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <Cpu className="size-4 text-cyan-400" /> Physique & Déterminisme Rust
          </h2>
          <p className="text-xs text-white/60 leading-relaxed">
            22 joueurs sur le terrain, détection de collision, ballon et système de passes calculés par le crate natif
            <code>aphrody-nie-app</code> et <code>aphrody-nie-runtime</code>.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-400" /> Police & Assets Réels
          </h2>
          <p className="text-xs text-white/60 leading-relaxed">
            Les textes et métriques typographiques sont directement décodés depuis le conteneur <code>font.cfg.bin</code> et
            la planche de texture <code>font.g4tx</code> originale.
          </p>
        </div>
      </section>
    </main>
  );
}
