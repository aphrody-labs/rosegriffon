/**
 * Serveur X virtuel headless (Xvfb) pour donner un DISPLAY au jeu Wine.
 *
 * Validé sur le VPS : `Xvfb :99 -screen 0 1280x720x24` démarre, crée le socket
 * /tmp/.X11-unix/X99, et `DISPLAY=:99 vulkaninfo` expose VK_KHR_xlib_surface +
 * VK_EXT_headless_surface sur le device llvmpipe. (LavaPipe peut aussi rendre
 * sans surface via VK_EXT_headless_surface, mais Wine veut un DISPLAY X.)
 */

import { existsSync } from "node:fs";
import type { Subprocess } from "bun";

export interface XvfbOptions {
	/** Numéro de display (sans le ':'). Défaut 99. */
	readonly display?: number;
	readonly width?: number;
	readonly height?: number;
	readonly depth?: number;
	/** Timeout d'attente du socket, ms. Défaut 5000. */
	readonly readyTimeoutMs?: number;
}

export interface XvfbHandle {
	/** ":99" — à mettre dans DISPLAY. */
	readonly display: string;
	readonly displayNum: number;
	readonly proc: Subprocess;
	/** Arrête Xvfb (idempotent). */
	stop(): void;
}

function socketPath(displayNum: number): string {
	return `/tmp/.X11-unix/X${displayNum}`;
}

/**
 * Démarre Xvfb et attend l'apparition du socket. Lève si le binaire est absent
 * ou si le socket n'apparaît pas dans le délai.
 */
export async function startXvfb(opts: XvfbOptions = {}): Promise<XvfbHandle> {
	if (Bun.which("Xvfb") === null) {
		throw new Error("Xvfb introuvable sur le PATH (paquet xvfb requis)");
	}
	const displayNum = opts.display ?? 99;
	const w = opts.width ?? 1280;
	const h = opts.height ?? 720;
	const depth = opts.depth ?? 24;
	const timeout = opts.readyTimeoutMs ?? 5000;

	const proc = Bun.spawn(
		["Xvfb", `:${displayNum}`, "-screen", "0", `${w}x${h}x${depth}`, "-nolisten", "tcp"],
		{ stdout: "ignore", stderr: "pipe" },
	);

	const sock = socketPath(displayNum);
	const start = Date.now();
	while (Date.now() - start < timeout) {
		if (existsSync(sock)) {
			return {
				display: `:${displayNum}`,
				displayNum,
				proc,
				stop() {
					try {
						proc.kill("SIGTERM");
					} catch {
						/* déjà mort */
					}
				},
			};
		}
		if (proc.killed) {
			const err = await new Response(proc.stderr).text();
			throw new Error(`Xvfb a quitté avant d'être prêt: ${err.slice(0, 500)}`);
		}
		await Bun.sleep(50);
	}

	try {
		proc.kill("SIGKILL");
	} catch {
		/* ignore */
	}
	throw new Error(`Xvfb :${displayNum} pas prêt après ${timeout}ms (socket ${sock} absent)`);
}
