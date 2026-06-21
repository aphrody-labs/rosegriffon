/**
 * Page `/jeu` — le **moteur de jeu niers jouable dans le navigateur**, 100 % Rust → WebAssembly.
 *
 * Server Component pur : métadonnées + délégation à l'îlot client `<GameCanvas>` (`"use client"`),
 * qui charge le binaire wasm `nie-wasm` (`WasmGame` : FSM GameState + rendu CPU framebuffer) et le
 * peint sur un `<canvas>`. Aucune logique de jeu en JS : tout vient de nie-app/nie-core compilés.
 */
import type { Metadata } from "next";
import { GameCanvas } from "@/components/jeu/GameCanvas";

export const metadata: Metadata = {
	alternates: { canonical: "/jeu" },
	title: "Jeu — moteur niers en WebAssembly",
	description:
		"Le moteur de jeu d'Inazuma Eleven: Victory Road réécrit en Rust pur, jouable directement dans le navigateur via WebAssembly : machine à états (écran-titre, menu principal, match, mode histoire) et rendu CPU des écrans avec la police réelle du jeu.",
};

export default function JeuPage() {
	return (
		<main className="mx-auto max-w-6xl px-4 py-10">
			<header className="mb-8 text-center">
				<h1 className="text-3xl font-bold tracking-tight">Moteur de jeu — WebAssembly</h1>
				<p className="mx-auto mt-3 max-w-3xl text-sm text-neutral-400">
					Le cœur d'<em>Inazuma Eleven: Victory Road</em> réécrit en Rust pur (nie-app / nie-core) et compilé
					en WebAssembly. La machine à états et le rendu des écrans tournent intégralement dans le navigateur
					— aucune logique de jeu en JavaScript.
				</p>
			</header>
			<GameCanvas />
		</main>
	);
}
