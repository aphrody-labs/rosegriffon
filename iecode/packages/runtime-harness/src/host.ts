/**
 * Détection des capacités de l'hôte pour le harness d'exécution live.
 *
 * Tout est validé empiriquement sur le VPS (Ubuntu 26.04, systemd 259, cgroup v2,
 * Mesa 26.0.3 lavapipe, wine/wine64, ptrace_scope=1, 12 vCPU mono-thread Haswell AVX2).
 * Les valeurs ne sont JAMAIS supposées : on lit `/proc`, `/sys`, et le PATH.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

/** Chemin canonique de l'ICD LavaPipe (Mesa) sur ce VPS. */
export const LVP_ICD_PATH = "/usr/share/vulkan/icd.d/lvp_icd.json";

export interface HostCapabilities {
	/** cgroup v2 monté en mode unifié sur /sys/fs/cgroup. */
	readonly cgroupV2: boolean;
	/** Contrôleurs disponibles à la racine cgroup. */
	readonly rootControllers: readonly string[];
	/**
	 * Contrôleurs réellement délégués au manager utilisateur
	 * (`user@<uid>.service`). Sur ce VPS : cpu, memory, pids — PAS cpuset.
	 */
	readonly userControllers: readonly string[];
	/** systemd-run présent (pour les scopes transitoires). */
	readonly hasSystemdRun: boolean;
	/** Xvfb présent (serveur X headless). */
	readonly hasXvfb: boolean;
	/** wine + wine64 présents. */
	readonly hasWine: boolean;
	/** taskset présent (pinning CPU sans privilège, fallback du cpuset non-délégué). */
	readonly hasTaskset: boolean;
	/** ICD LavaPipe présent. */
	readonly hasLavapipe: boolean;
	/** Valeur de kernel.yama.ptrace_scope (0..3, -1 si illisible). */
	readonly ptraceScope: number;
	/** Cœurs logiques (Environment.ProcessorCount équivalent). */
	readonly logicalCores: number;
}

async function readControllers(path: string): Promise<readonly string[]> {
	try {
		const txt = await readFile(path, "utf8");
		return txt.trim().split(/\s+/).filter(Boolean);
	} catch {
		return [];
	}
}

async function readPtraceScope(): Promise<number> {
	try {
		const txt = await readFile("/proc/sys/kernel/yama/ptrace_scope", "utf8");
		const v = Number.parseInt(txt.trim(), 10);
		return Number.isNaN(v) ? -1 : v;
	} catch {
		return -1;
	}
}

/** Le binaire `name` est-il sur le PATH ? Utilise `Bun.which`. */
function hasBin(name: string): boolean {
	return Bun.which(name) !== null;
}

/**
 * Devine le chemin du cgroup du manager utilisateur courant
 * (`/sys/fs/cgroup/user.slice/user-<uid>.slice/user@<uid>.service`).
 */
export function userManagerCgroup(uid = process.getuid?.() ?? 1000): string {
	return `/sys/fs/cgroup/user.slice/user-${uid}.slice/user@${uid}.service`;
}

/** Sonde l'hôte. Asynchrone (lectures /proc, /sys). */
export async function detectHost(): Promise<HostCapabilities> {
	const cgroupV2 = existsSync("/sys/fs/cgroup/cgroup.controllers");
	const [rootControllers, userControllers, ptraceScope] = await Promise.all([
		readControllers("/sys/fs/cgroup/cgroup.controllers"),
		readControllers(`${userManagerCgroup()}/cgroup.controllers`),
		readPtraceScope(),
	]);

	return {
		cgroupV2,
		rootControllers,
		userControllers,
		hasSystemdRun: hasBin("systemd-run"),
		hasXvfb: hasBin("Xvfb"),
		hasWine: hasBin("wine") && hasBin("wine64"),
		hasTaskset: hasBin("taskset"),
		hasLavapipe: existsSync(LVP_ICD_PATH),
		ptraceScope,
		logicalCores: navigator.hardwareConcurrency,
	};
}

/**
 * cpuset est-il délégué au manager utilisateur ? Sur ce VPS : NON
 * (`user@.service` n'expose que cpu/memory/pids). Conséquence : le pinning CPU
 * passe par taskset, pas par cgroup cpuset (cf. {@link import("./cpu.ts")}).
 */
export function cpusetDelegated(caps: HostCapabilities): boolean {
	return caps.userControllers.includes("cpuset");
}
