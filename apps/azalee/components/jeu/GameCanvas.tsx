"use client";

/**
 * Îlot client : monte le **moteur de jeu niers** (wasm pur Rust) sur un `<canvas>`.
 *
 * Deux modes : `playthrough` (boucle scriptée Title→Menu→Match→Story rendue à 30 fps via
 * `requestAnimationFrame`) et `menu` (navigation interactive du menu principal aux flèches/clic).
 * Tout le rendu vient de `WasmGame` (framebuffer RGBA8) — ce composant ne fait que piloter + peindre.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameHandle } from "@/lib/nie-game";

const MENU_OPTIONS = ["MATCH", "STORY MODE", "MY TEAM", "KIZUNA TOWN"];

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };
type Mode = "playthrough" | "menu";

export function GameCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const handleRef = useRef<GameHandle | null>(null);
	const [status, setStatus] = useState<Status>({ kind: "loading" });
	const [mode, setMode] = useState<Mode>("playthrough");
	const [sel, setSel] = useState(0);

	// Chargement unique du moteur + police (réel, 100 % Rust/wasm).
	useEffect(() => {
		let cancelled = false;
		// Import dynamique : le glue wasm ne se charge QUE côté client (jamais au SSR).
		void (async () => {
			try {
				const { loadGame } = await import("@/lib/nie-game");
				const h = await loadGame();
				if (cancelled) return;
				handleRef.current = h;
				const cv = canvasRef.current;
				if (cv) {
					cv.width = h.width;
					cv.height = h.height;
				}
				setStatus({ kind: "ready" });
			} catch (e: unknown) {
				if (!cancelled) setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Peint un ImageData sur le canvas.
	const paint = useCallback((img: ImageData) => {
		const ctx = canvasRef.current?.getContext("2d");
		if (ctx) ctx.putImageData(img, 0, 0);
	}, []);

	// Boucle de rendu selon le mode actif.
	useEffect(() => {
		if (status.kind !== "ready") return;
		const handle = handleRef.current;
		if (!handle) return;

		if (mode === "menu") {
			paint(handle.renderMenu(sel));
			return;
		}

		// Playthrough : ~30 fps via rAF avec accumulateur de temps.
		let raf = 0;
		let frame = 0;
		let last = performance.now();
		let acc = 0;
		const STEP_MS = 1000 / 30;
		const tick = (now: number) => {
			acc += now - last;
			last = now;
			while (acc >= STEP_MS) {
				frame = (frame + 1) % handle.totalFrames;
				acc -= STEP_MS;
			}
			paint(handle.renderFrame(frame));
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [status.kind, mode, sel, paint]);

	// Navigation clavier en mode menu.
	useEffect(() => {
		if (mode !== "menu") return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowDown") setSel((s) => (s + 1) % MENU_OPTIONS.length);
			else if (e.key === "ArrowUp") setSel((s) => (s + MENU_OPTIONS.length - 1) % MENU_OPTIONS.length);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [mode]);

	return (
		<div className="flex flex-col items-center gap-4">
			<div className="relative w-full max-w-5xl overflow-hidden rounded-lg border border-neutral-700 bg-black shadow-xl">
				<canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: "16 / 9", imageRendering: "auto" }} />
				{status.kind === "loading" && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-neutral-300">
						Chargement du moteur (wasm) et de la police réelle du jeu…
					</div>
				)}
				{status.kind === "error" && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-red-400">
						Échec du chargement : {status.message}
					</div>
				)}
			</div>

			<div className="flex flex-wrap items-center justify-center gap-3 text-sm">
				<button
					type="button"
					onClick={() => setMode("playthrough")}
					className={`rounded px-3 py-1.5 ${mode === "playthrough" ? "bg-sky-600 text-white" : "bg-neutral-800 text-neutral-300"}`}
				>
					Playthrough
				</button>
				<button
					type="button"
					onClick={() => setMode("menu")}
					className={`rounded px-3 py-1.5 ${mode === "menu" ? "bg-sky-600 text-white" : "bg-neutral-800 text-neutral-300"}`}
				>
					Menu interactif
				</button>
				{mode === "menu" && (
					<span className="text-neutral-400">
						↑/↓ pour naviguer — <span className="text-sky-400">{MENU_OPTIONS[sel]}</span>
					</span>
				)}
			</div>
		</div>
	);
}
