/**
 * GameSession — orchestrateur d'une exécution live IEVR headless, sûr et nettoyable.
 *
 * Chaîne montée (puis démontée dans l'ordre inverse, idempotent) :
 *   1. détection hôte (cgroup v2, lavapipe, wine, ptrace_scope, cœurs) ;
 *   2. plan CPU 6/4/2 (render/game/io) ;
 *   3. Xvfb headless → DISPLAY ;
 *   4. env Vulkan logiciel (VK_DRIVER_FILES + LP_NUM_THREADS = cœurs render) ;
 *   5. lancement du jeu DANS un cgroup délégué (scope transitoire), préfixé taskset
 *      pour épingler les cœurs game (cpuset non délégué sur ce VPS) ;
 *   6. nettoyage ATOMIQUE via cgroup.kill (tue tout l'arbre Wine, forks compris).
 *
 * ARCHITECTURE AT_SECURE (corrigée) : c'est CE process (worker, lanceur) qui SPAWN
 * le jeu. Étant ancêtre, un worker C# peut faire process_vm_readv sur le jeu SANS
 * aucune capability (ptrace_scope=1 autorise l'ancêtre) → on n'a pas besoin de
 * setcap cap_sys_ptrace sur le binaire de rendu, ce qui CASSERAIT VK_DRIVER_FILES
 * (le loader Vulkan l'ignore sous AT_SECURE). Le binaire qui rend ne porte donc
 * jamais de capability ; la lecture mémoire vit dans le lanceur ancêtre (ou un
 * lecteur séparé sans Vulkan).
 *
 * Idempotence : dispose() est sûr à appeler plusieurs fois et est branché sur
 * SIGINT/SIGTERM + exitHandler pour ne jamais laisser d'Xvfb ou de processus Wine
 * orphelins, même si le harness est tué.
 */

import type { Subprocess } from "bun";
import { type ConfinedCgroup, spawnConfined } from "./cgroup.ts";
import { type CpuPlan, planCpu, tasksetPrefix } from "./cpu.ts";
import { type HostCapabilities, detectHost } from "./host.ts";
import { vulkanEnv } from "./vulkan.ts";
import { type XvfbHandle, startXvfb } from "./xvfb.ts";

export interface GameSessionOptions {
	/** argv du jeu, ex. ["wine", "/path/IEVR.exe"]. command[0] doit exister. */
	readonly command: readonly string[];
	readonly cwd?: string;
	/** Env additionnel (fusionné après l'env Vulkan/DISPLAY). */
	readonly env?: Record<string, string>;
	/** memory.max du cgroup, octets. Défaut : illimité. */
	readonly memoryMaxBytes?: number;
	/** pids.max. */
	readonly pidsMax?: number;
	/** Display Xvfb. Défaut 99. */
	readonly display?: number;
	readonly width?: number;
	readonly height?: number;
	/** Désactive le pinning taskset (laisse l'OS scheduler). */
	readonly noPin?: boolean;
	/** Brancher les handlers SIGINT/SIGTERM/exit pour cleanup auto. Défaut true. */
	readonly installSignalHandlers?: boolean;
	readonly stdout?: "inherit" | "pipe" | "ignore";
	readonly stderr?: "inherit" | "pipe" | "ignore";
}

export interface SessionInfo {
	readonly host: HostCapabilities;
	readonly cpu: CpuPlan;
	readonly display: string;
	readonly pid: number;
	readonly cgroupPath: string;
	readonly scopeUnit?: string;
}

export class GameSession {
	#opts: GameSessionOptions;
	#xvfb?: XvfbHandle;
	#proc?: Subprocess;
	#cgroup?: ConfinedCgroup;
	#host?: HostCapabilities;
	#cpu?: CpuPlan;
	#disposed = false;
	#started = false;
	#signalCleanup?: () => void;

	constructor(opts: GameSessionOptions) {
		this.#opts = opts;
	}

	/** Capacités hôte détectées (après start()). */
	get host(): HostCapabilities | undefined {
		return this.#host;
	}

	/** Sous-process du jeu (après start()). */
	get process(): Subprocess | undefined {
		return this.#proc;
	}

	/**
	 * Vérifie que l'hôte peut faire tourner le harness. Lève avec un message clair
	 * sinon. N'a PAS besoin du jeu.
	 */
	async preflight(): Promise<HostCapabilities> {
		const host = await detectHost();
		this.#host = host;
		const problems: string[] = [];
		if (!host.cgroupV2) problems.push("cgroup v2 absent (/sys/fs/cgroup unifié requis)");
		if (!host.hasSystemdRun) problems.push("systemd-run absent (scope délégué impossible)");
		if (!host.hasXvfb) problems.push("Xvfb absent");
		if (!host.hasLavapipe) problems.push("ICD LavaPipe absent");
		if (problems.length > 0) {
			throw new Error(`Préflight harness échoué :\n - ${problems.join("\n - ")}`);
		}
		return host;
	}

	/** Démarre Xvfb + lance le jeu confiné. Idempotent (no-op si déjà démarré). */
	async start(): Promise<SessionInfo> {
		if (this.#started) return this.info();
		this.#started = true;

		const host = this.#host ?? (await this.preflight());
		const cpu = planCpu(host.logicalCores);
		this.#cpu = cpu;

		// 3) Xvfb
		this.#xvfb = await startXvfb({
			display: this.#opts.display,
			width: this.#opts.width,
			height: this.#opts.height,
		});

		// 4) env Vulkan logiciel + DISPLAY
		const env: Record<string, string> = {
			DISPLAY: this.#xvfb.display,
			...vulkanEnv({ renderThreads: cpu.renderThreads }),
			...(this.#opts.env ?? {}),
		};

		// 5) préfixe taskset (cpuset non délégué → pinning userspace)
		const pin = this.#opts.noPin ? [] : tasksetPrefix(cpu.gameCpus, host.hasTaskset);
		const command = [...pin, ...this.#opts.command];

		const { proc, cgroup } = await spawnConfined(command, {
			env,
			cwd: this.#opts.cwd,
			limits: {
				memoryMaxBytes: this.#opts.memoryMaxBytes,
				pidsMax: this.#opts.pidsMax,
			},
			stdout: this.#opts.stdout,
			stderr: this.#opts.stderr,
		});
		this.#proc = proc;
		this.#cgroup = cgroup;

		if (this.#opts.installSignalHandlers ?? true) {
			this.#installSignalHandlers();
		}

		return this.info();
	}

	info(): SessionInfo {
		if (!this.#host || !this.#cpu || !this.#xvfb || !this.#proc || !this.#cgroup) {
			throw new Error("GameSession.info() avant start()");
		}
		return {
			host: this.#host,
			cpu: this.#cpu,
			display: this.#xvfb.display,
			pid: this.#proc.pid,
			cgroupPath: this.#cgroup.path,
			scopeUnit: this.#cgroup.scopeUnit,
		};
	}

	/** PIDs vivants dans le cgroup (toute la descendance Wine). */
	async procs(): Promise<number[]> {
		return this.#cgroup ? this.#cgroup.procs() : [];
	}

	/** Attend la fin du process racine du jeu. */
	async waitExit(): Promise<number> {
		if (!this.#proc) throw new Error("waitExit() avant start()");
		return this.#proc.exited;
	}

	/**
	 * Démontage ATOMIQUE et idempotent : tue tout l'arbre via cgroup.kill, arrête
	 * Xvfb, retire les handlers. Sûr à appeler plusieurs fois / depuis un signal.
	 */
	async dispose(): Promise<void> {
		if (this.#disposed) return;
		this.#disposed = true;

		this.#signalCleanup?.();
		this.#signalCleanup = undefined;

		// 1) nuke l'arbre du jeu (forks Wine compris) — atomique.
		try {
			await this.#cgroup?.killAll();
		} catch {
			/* best-effort */
		}

		// 2) Xvfb
		try {
			this.#xvfb?.stop();
		} catch {
			/* best-effort */
		}
	}

	#installSignalHandlers(): void {
		// Cleanup synchrone-déclenché ; dispose() est idempotent donc rejouable.
		const onSignal = (signal: NodeJS.Signals) => {
			void this.dispose().finally(() => {
				// Re-propage le signal après nettoyage pour un code de sortie correct.
				process.removeAllListeners(signal);
				process.kill(process.pid, signal);
			});
		};
		const onSigint = () => onSignal("SIGINT");
		const onSigterm = () => onSignal("SIGTERM");
		const onExit = () => {
			// dispose() asynchrone ne finira pas dans 'exit' ; on tente au moins le kill
			// atomique synchrone via le scope systemd si dispo (best-effort).
			void this.dispose();
		};

		process.on("SIGINT", onSigint);
		process.on("SIGTERM", onSigterm);
		process.on("beforeExit", onExit);

		this.#signalCleanup = () => {
			process.off("SIGINT", onSigint);
			process.off("SIGTERM", onSigterm);
			process.off("beforeExit", onExit);
		};
	}
}

/**
 * Helper one-shot : monte la session, exécute `body`, garantit le démontage même
 * en cas d'exception. Pattern using-like sans dépendre de `await using`.
 */
export async function withGameSession<T>(
	opts: GameSessionOptions,
	body: (session: GameSession, info: SessionInfo) => Promise<T>,
): Promise<T> {
	const session = new GameSession(opts);
	const info = await session.start();
	try {
		return await body(session, info);
	} finally {
		await session.dispose();
	}
}
