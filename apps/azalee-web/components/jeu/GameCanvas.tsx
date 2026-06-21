"use client";

/**
 * Le JEU niers en PLEIN ÉCRAN (`WasmGame`, wasm pur Rust). Couche d'input complète :
 * **clavier + souris + manette** → commandes de menu IEVR réelles (CMD_ENTER / CMD_BACK /
 * CMD_FCS_MTX_*). Boucle 60 Hz, tout le rendu vient du wasm. Aucun chrome de démo.
 */
import { useEffect, useRef, useState } from "react";

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

/** Clavier (`event.code`, indépendant de la disposition) → commande IEVR. */
const KEY_CMD: Record<string, string> = {
	ArrowUp: "CMD_FCS_MTX_UP",
	KeyW: "CMD_FCS_MTX_UP",
	ArrowDown: "CMD_FCS_MTX_DOWN",
	KeyS: "CMD_FCS_MTX_DOWN",
	ArrowLeft: "CMD_FCS_MTX_LEFT",
	KeyA: "CMD_FCS_MTX_LEFT",
	ArrowRight: "CMD_FCS_MTX_RIGHT",
	KeyD: "CMD_FCS_MTX_RIGHT",
	Enter: "CMD_ENTER",
	Space: "CMD_ENTER",
	Escape: "CMD_BACK",
	Backspace: "CMD_BACK",
};

/** Manette (index bouton standard) → commande. 0=A/✕, 1=B/◯, 12-15=croix directionnelle. */
const PAD_BTN_CMD: Record<number, string> = {
	0: "CMD_ENTER",
	1: "CMD_BACK",
	12: "CMD_FCS_MTX_UP",
	13: "CMD_FCS_MTX_DOWN",
	14: "CMD_FCS_MTX_LEFT",
	15: "CMD_FCS_MTX_RIGHT",
};

export function GameCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [status, setStatus] = useState<Status>({ kind: "loading" });

	useEffect(() => {
		let cancelled = false;
		let raf = 0;
		const cleanups: Array<() => void> = [];
		void (async () => {
			try {
				const { loadGame } = await import("@/lib/nie-game");
				const game = await loadGame();
				if (cancelled) return;
				const cv = canvasRef.current;
				if (!cv) return;
				cv.width = game.width;
				cv.height = game.height;
				const ctx = cv.getContext("2d");
				setStatus({ kind: "ready" });

				// Clavier (global).
				const onKey = (e: KeyboardEvent) => {
					const cmd = KEY_CMD[e.code];
					if (cmd) {
						e.preventDefault();
						game.input(cmd);
					}
				};
				window.addEventListener("keydown", onKey);
				cleanups.push(() => window.removeEventListener("keydown", onKey));

				// Souris : clic = valider, clic droit = retour.
				const onClick = () => game.input("CMD_ENTER");
				const onCtx = (e: MouseEvent) => {
					e.preventDefault();
					game.input("CMD_BACK");
				};
				cv.addEventListener("click", onClick);
				cv.addEventListener("contextmenu", onCtx);
				cleanups.push(() => {
					cv.removeEventListener("click", onClick);
					cv.removeEventListener("contextmenu", onCtx);
				});

				// Manette : edge-detection (déclenche à l'appui, pas en maintien).
				const padActive = new Set<string>();
				const pollPad = () => {
					const pads = navigator.getGamepads?.() ?? [];
					const gp = Array.from(pads).find((p) => p) ?? null;
					if (!gp) {
						padActive.clear();
						return;
					}
					const now = new Map<string, string>();
					gp.buttons.forEach((b, i) => {
						if (b.pressed && PAD_BTN_CMD[i]) now.set(`b${i}`, PAD_BTN_CMD[i]);
					});
					const [ax, ay] = [gp.axes[0] ?? 0, gp.axes[1] ?? 0];
					if (ay < -0.5) now.set("ay-", "CMD_FCS_MTX_UP");
					if (ay > 0.5) now.set("ay+", "CMD_FCS_MTX_DOWN");
					if (ax < -0.5) now.set("ax-", "CMD_FCS_MTX_LEFT");
					if (ax > 0.5) now.set("ax+", "CMD_FCS_MTX_RIGHT");
					for (const [sig, cmd] of now) {
						if (!padActive.has(sig)) game.input(cmd);
					}
					padActive.clear();
					for (const sig of now.keys()) padActive.add(sig);
				};

				let last = performance.now();
				let acc = 0;
				const STEP = 1000 / 60;
				const tick = (t: number) => {
					acc += t - last;
					last = t;
					let steps = 0;
					while (acc >= STEP && steps < 8) {
						game.update(1 / 60);
						acc -= STEP;
						steps++;
					}
					pollPad();
					if (ctx) ctx.putImageData(game.frame(), 0, 0);
					raf = requestAnimationFrame(tick);
				};
				raf = requestAnimationFrame(tick);
			} catch (e: unknown) {
				if (!cancelled) setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
			}
		})();
		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			cleanups.forEach((c) => c());
		};
	}, []);

	return (
		<div className="fixed inset-0 flex items-center justify-center bg-black">
			<canvas ref={canvasRef} className="max-h-full max-w-full" style={{ objectFit: "contain" }} />
			{status.kind === "loading" && (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
					Chargement du jeu…
				</div>
			)}
			{status.kind === "error" && (
				<div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-400">
					Échec : {status.message}
				</div>
			)}
		</div>
	);
}
