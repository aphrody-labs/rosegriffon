/**
 * Découpage CPU pour l'exécution live du jeu sous LavaPipe (rasterizer logiciel,
 * donc CPU-bound). Sur ce VPS : 12 vCPU mono-thread (pas de SMT), Haswell AVX2.
 *
 * Plan de partition linéaire (pas de SMT → un cœur = un thread, le split est trivial) :
 *   - render  : cœurs 6..11  (6)  → LavaPipe / LP_NUM_THREADS = 6
 *   - game    : cœurs 0..3   (4)  → logique du jeu Wine
 *   - io/host : cœurs 4..5   (2)  → I/O, audio, le worker C# lecteur, le système
 *
 * IMPORTANT (validé) : le contrôleur `cpuset` n'est PAS délégué au manager
 * utilisateur sur ce VPS (`user@.service` n'a que cpu/memory/pids), et créer un
 * scope système (`systemd-run` sans `--user`) exige une auth polkit (refusée).
 * Donc le pinning se fait via **taskset** (sched_setaffinity, aucun privilège),
 * pas via cgroup cpuset. Si un opérateur active la délégation cpuset, on pourrait
 * basculer — mais le défaut robuste ici est taskset.
 */

export interface CpuPlan {
	readonly totalCores: number;
	/** Plage cœurs LavaPipe, format taskset "a-b". */
	readonly renderCpus: string;
	/** Nombre de threads render = doit correspondre à LP_NUM_THREADS. */
	readonly renderThreads: number;
	/** Plage cœurs logique de jeu. */
	readonly gameCpus: string;
	/** Plage cœurs I/O / hôte / worker lecteur. */
	readonly ioCpus: string;
	/**
	 * Pour le Server GC .NET du worker C# : plage d'affinité au format
	 * DOTNET_GCHeapAffinitizeRanges (ex. "6-9"), et nombre de heaps (hex).
	 */
	readonly gcHeapCount: number;
	readonly gcHeapAffinitizeRanges: string;
}

function range(lo: number, hi: number): string {
	return lo === hi ? `${lo}` : `${lo}-${hi}`;
}

/**
 * Calcule le plan pour `cores` cœurs. Logique pure (testable).
 * Split par défaut render/game/io = 6/4/2 quand cores >= 12 ; sinon proportionnel
 * (render = moitié, game = ~1/3, io = le reste, chacun >= 1).
 */
export function planCpu(cores: number): CpuPlan {
	const total = Math.max(1, Math.floor(cores));

	let render: number;
	let game: number;
	if (total >= 12) {
		render = 6;
		game = 4;
	} else if (total >= 4) {
		render = Math.max(1, Math.floor(total / 2));
		game = Math.max(1, Math.floor(total / 3));
		if (render + game >= total) {
			game = Math.max(1, total - render - 1);
		}
	} else {
		// Très peu de cœurs : tout le monde partage, on ne sur-segmente pas.
		render = total;
		game = total;
		return {
			totalCores: total,
			renderCpus: range(0, total - 1),
			renderThreads: total,
			gameCpus: range(0, total - 1),
			ioCpus: range(0, total - 1),
			gcHeapCount: total,
			gcHeapAffinitizeRanges: range(0, total - 1),
		};
	}

	const io = Math.max(1, total - render - game);
	// Disposition : game [0..game-1], io [game..game+io-1], render [game+io..total-1].
	const gameLo = 0;
	const gameHi = game - 1;
	const ioLo = game;
	const ioHi = game + io - 1;
	const renderLo = game + io;
	const renderHi = total - 1;

	return {
		totalCores: total,
		renderCpus: range(renderLo, renderHi),
		renderThreads: renderHi - renderLo + 1,
		gameCpus: range(gameLo, gameHi),
		ioCpus: range(ioLo, ioHi),
		gcHeapCount: renderHi - renderLo + 1,
		gcHeapAffinitizeRanges: range(renderLo, renderHi),
	};
}

/**
 * Préfixe argv `taskset -c <cpus>` à appliquer devant la commande pour épingler
 * l'affinité CPU sans privilège. Renvoie [] si taskset absent (l'OS schedule librement).
 *
 * NB (corrigé empiriquement) : `taskset` ne prend PAS de séparateur `--` avant la
 * commande — `taskset -c 0-3 -- bash` échoue ("failed to execute --"). La forme
 * correcte est `taskset -c 0-3 bash …`.
 */
export function tasksetPrefix(cpus: string, hasTaskset: boolean): readonly string[] {
	return hasTaskset ? ["taskset", "-c", cpus] : [];
}
