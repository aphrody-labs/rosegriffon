/**
 * Page `/jeu` — le JEU Inazuma Eleven: Victory Road, jouable PLEIN ÉCRAN dans le navigateur,
 * 100 % Rust → WebAssembly. Server Component : métadonnées + l'îlot client `<GameCanvas>` (fixed
 * inset-0) qui remplit la fenêtre. Aucun chrome de démo : juste le jeu.
 */
import type { Metadata } from "next";
import { GameCanvas } from "@/components/jeu/GameCanvas";

export const metadata: Metadata = {
	alternates: { canonical: "/jeu" },
	title: "Jeu — Inazuma Eleven: Victory Road (WebAssembly)",
	description:
		"Inazuma Eleven: Victory Road réécrit en Rust pur et jouable plein écran dans le navigateur via WebAssembly : menu principal réel, modes de jeu (Histoire, Chronique, Compétition, Victory Road, Stade BB) et matchs simulés par le moteur niers.",
};

export default function JeuPage() {
	return <GameCanvas />;
}
