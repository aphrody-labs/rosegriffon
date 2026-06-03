/**
 * Confinement + nettoyage ATOMIQUE de l'arbre de processus du jeu via cgroup v2.
 *
 * Le jeu sous Wine forke abondamment (services Wine, explorer.exe, sous-process).
 * Tuer le PID racine laisse des orphelins. cgroup v2 résout ça proprement :
 *   - on place toute la descendance dans un seul cgroup ;
 *   - écrire "1" dans **cgroup.kill** envoie SIGKILL à TOUT le sous-arbre, gère les
 *     forks concurrents (un process qui naît pendant le kill est tué aussi),
 *     sans course. (Validé : après cgroup.kill le répertoire cgroup.procs est vide
 *     puis le cgroup disparaît.)
 *
 * Stratégie de délégation (validée sur ce VPS) :
 *   - `systemd-run --user --scope -p Delegate=yes` crée un scope transitoire
 *     délégué sous user@<uid>.service. cpu/memory/pids y sont disponibles ;
 *     **cpuset ne l'est PAS** (non délégué) → le pinning CPU passe par taskset.
 *   - `systemctl --user stop <scope>` OU l'écriture de cgroup.kill détruisent le
 *     sous-arbre. On préfère cgroup.kill (atomique, indépendant de systemd) et on
 *     fait `stop` en filet de sécurité.
 *   - Fallback sans systemd-run : on tente un cgroup manuel sous le manager
 *     utilisateur. (Note : selon la délégation, l'écriture dans cgroup.procs au
 *     niveau racine du manager peut être refusée — d'où la préférence systemd-run.)
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rmdir, writeFile } from "node:fs/promises";
import type { Subprocess } from "bun";

export interface CgroupLimits {
	/** memory.max en octets (ou "max"). */
	readonly memoryMaxBytes?: number;
	/** pids.max. */
	readonly pidsMax?: number;
}

export interface ConfinedCgroup {
	/** Chemin absolu /sys/fs/cgroup/... du cgroup confinant le jeu. */
	readonly path: string;
	/** Nom du scope systemd si créé via systemd-run, sinon undefined. */
	readonly scopeUnit?: string;
	/** PIDs vivants actuellement dans le cgroup. */
	procs(): Promise<number[]>;
	/**
	 * Tue ATOMIQUEMENT tout le sous-arbre (cgroup.kill), puis stop systemd en filet,
	 * puis tente rmdir. Idempotent : sûr à appeler plusieurs fois.
	 */
	killAll(): Promise<void>;
}

function cgFsPath(controlGroup: string): string {
	return `/sys/fs/cgroup${controlGroup}`;
}

async function readScopeCgroup(unit: string): Promise<string> {
	const proc = Bun.spawn(
		["systemctl", "--user", "show", unit, "-p", "ControlGroup", "--value"],
		{ stdout: "pipe", stderr: "ignore" },
	);
	const [out] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
	return out.trim();
}

async function readProcs(cgPath: string): Promise<number[]> {
	try {
		const txt = await readFile(`${cgPath}/cgroup.procs`, "utf8");
		return txt
			.split("\n")
			.map((l) => Number.parseInt(l.trim(), 10))
			.filter((n) => Number.isInteger(n) && n > 0);
	} catch {
		return [];
	}
}

/** Écrit "1" dans cgroup.kill si le fichier existe. Idempotent. */
async function writeCgroupKill(cgPath: string): Promise<void> {
	const killFile = `${cgPath}/cgroup.kill`;
	if (existsSync(killFile)) {
		try {
			await writeFile(killFile, "1");
		} catch {
			/* cgroup déjà parti */
		}
	}
}

async function stopScope(unit: string): Promise<void> {
	const proc = Bun.spawn(["systemctl", "--user", "stop", unit], {
		stdout: "ignore",
		stderr: "ignore",
	});
	await proc.exited;
}

/**
 * Lance `command` (argv) à l'intérieur d'un scope transitoire délégué, confiné par
 * cgroup v2. Renvoie le sous-process ET le handle de cgroup pour kill atomique.
 *
 * Le scope est nommé de façon unique (idempotence + traçabilité). `command[0]`
 * peut être un préfixe taskset déjà appliqué par l'appelant ; on ne réordonne pas.
 */
export async function spawnConfined(
	command: readonly string[],
	options: {
		readonly env?: Record<string, string>;
		readonly cwd?: string;
		readonly limits?: CgroupLimits;
		readonly unitPrefix?: string;
		readonly stdout?: "inherit" | "pipe" | "ignore";
		readonly stderr?: "inherit" | "pipe" | "ignore";
	} = {},
): Promise<{ proc: Subprocess; cgroup: ConfinedCgroup }> {
	if (Bun.which("systemd-run") === null) {
		throw new Error("systemd-run introuvable : impossible de créer un scope délégué");
	}
	const unit = `${options.unitPrefix ?? "iecode-game"}-${process.pid}-${Date.now()}.scope`;

	const runArgs = [
		"systemd-run",
		"--user",
		"--scope",
		"--quiet",
		`--unit=${unit}`,
		"-p",
		"Delegate=yes",
	];
	if (options.limits?.memoryMaxBytes !== undefined) {
		runArgs.push("-p", `MemoryMax=${options.limits.memoryMaxBytes}`);
	}
	if (options.limits?.pidsMax !== undefined) {
		runArgs.push("-p", `TasksMax=${options.limits.pidsMax}`);
	}
	runArgs.push("--", ...command);

	const proc = Bun.spawn(runArgs, {
		env: options.env ? { ...process.env, ...options.env } : process.env,
		cwd: options.cwd,
		stdout: options.stdout ?? "inherit",
		stderr: options.stderr ?? "inherit",
	});

	// Le ControlGroup du scope n'est connu qu'une fois l'unité enregistrée ; petite
	// attente active bornée.
	let controlGroup = "";
	for (let i = 0; i < 40 && controlGroup === ""; i++) {
		controlGroup = await readScopeCgroup(unit);
		if (controlGroup === "") {
			if (proc.killed) break;
			await Bun.sleep(25);
		}
	}
	const path = controlGroup === "" ? "" : cgFsPath(controlGroup);

	const cgroup: ConfinedCgroup = {
		path,
		scopeUnit: unit,
		async procs() {
			return path === "" ? [] : readProcs(path);
		},
		async killAll() {
			if (path !== "") await writeCgroupKill(path);
			await stopScope(unit);
			try {
				proc.kill("SIGKILL");
			} catch {
				/* déjà mort */
			}
		},
	};

	return { proc, cgroup };
}

/**
 * Fallback bas-niveau : crée un cgroup manuel sous un parent délégué, y déplace
 * `pid`, et renvoie un handle kill. À n'utiliser que si l'appelant gère déjà la
 * délégation (sinon préférer {@link spawnConfined}). Lève si l'écriture est refusée.
 */
export async function confineExistingPid(
	parentCgroupPath: string,
	pid: number,
	name = `iecode-${pid}`,
): Promise<ConfinedCgroup> {
	const path = `${parentCgroupPath}/${name}`;
	await mkdir(path, { recursive: true });
	await writeFile(`${path}/cgroup.procs`, String(pid)); // peut lever EACCES si non délégué

	return {
		path,
		async procs() {
			return readProcs(path);
		},
		async killAll() {
			await writeCgroupKill(path);
			// attendre la vidange avant rmdir
			for (let i = 0; i < 40; i++) {
				if ((await readProcs(path)).length === 0) break;
				await Bun.sleep(25);
			}
			try {
				await rmdir(path);
			} catch {
				/* déjà parti ou non vide */
			}
		},
	};
}
