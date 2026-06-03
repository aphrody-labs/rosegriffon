/**
 * @rose-griffon/iecode-runtime-harness — harness d'exécution live IEVR headless.
 *
 * UNIQUEMENT pour le reverse-engineering en direct (lecture mémoire d'un jeu qui
 * tourne). Le pipeline DATA n'en a PAS besoin : l'extraction statique SteamKit2
 * (download depots + dump CPK) couvre toutes les données de jeu sans lancer le
 * binaire. Voir le README pour la recommandation.
 *
 * Briques :
 *   - {@link GameSession} / {@link withGameSession} : orchestrateur complet.
 *   - {@link detectHost} : capacités hôte (cgroup, lavapipe, wine, ptrace_scope).
 *   - {@link planCpu} : partition CPU render/game/io.
 *   - {@link vulkanEnv} / {@link probeVulkan} : env LavaPipe logiciel.
 *   - {@link startXvfb} : DISPLAY headless.
 *   - {@link spawnConfined} : lancement confiné + kill atomique cgroup.kill.
 */

export {
	confineExistingPid,
	type CgroupLimits,
	type ConfinedCgroup,
	spawnConfined,
} from "./cgroup.ts";
export { type CpuPlan, planCpu, tasksetPrefix } from "./cpu.ts";
export {
	cpusetDelegated,
	detectHost,
	type HostCapabilities,
	LVP_ICD_PATH,
	userManagerCgroup,
} from "./host.ts";
export {
	GameSession,
	type GameSessionOptions,
	type SessionInfo,
	withGameSession,
} from "./session.ts";
export {
	driverSelectFor,
	type ProbeResult,
	probeVulkan,
	vulkanEnv,
	type VulkanEnvOptions,
} from "./vulkan.ts";
export { startXvfb, type XvfbHandle, type XvfbOptions } from "./xvfb.ts";
