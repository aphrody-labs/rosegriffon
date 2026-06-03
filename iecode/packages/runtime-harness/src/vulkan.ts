/**
 * Environnement Vulkan logiciel (LavaPipe / llvmpipe) pour l'exécution headless.
 *
 * Faits vérifiés (Khronos loader + sortie vulkaninfo sur ce VPS) :
 *   - Utiliser **VK_DRIVER_FILES** (pas VK_ICD_FILENAMES, déprécié) pointant l'ICD lvp.
 *     Pointé sur un ICD unique, il sélectionne DÉJÀ lavapipe à lui seul.
 *   - **VK_LOADER_DRIVERS_SELECT** matche le NOM DE MANIFEST (avec glob), PAS le nom
 *     du driver. CORRECTION empirique : la valeur "lvp" est REJETÉE par le loader
 *     ("Driver lvp_icd.json ignored because not selected") → il faut le glob du
 *     fichier : `*lvp*` (ou `lvp_icd.json`). Posée en ceinture+bretelles ; comme
 *     VK_DRIVER_FILES restreint déjà à un seul ICD, une mauvaise valeur de SELECT
 *     casserait tout — donc on pose le glob filename correct.
 *   - `vulkaninfo` confirme : deviceType=PHYSICAL_DEVICE_TYPE_CPU,
 *     driverID=DRIVER_ID_MESA_LLVMPIPE, deviceName="llvmpipe (LLVM 21.1.8, 256 bits)".
 *   - **LP_NUM_THREADS** doit correspondre au nombre de cœurs alloués au render
 *     (cf. plan CPU) pour ne pas sur-souscrire.
 *   - Piège AT_SECURE : le loader IGNORE VK_DRIVER_FILES si le binaire tourne en
 *     privilège élevé (setuid / setcap → AT_SECURE). Donc le binaire qui fait du
 *     Vulkan NE DOIT PAS porter de capability (ex. cap_sys_ptrace). C'est pourquoi
 *     l'architecture est « le worker C# LANCE le jeu » (ancêtre ⇒ process_vm_readv
 *     autorisé sans capability) plutôt que setcap sur le process de rendu.
 */

import { basename } from "node:path";
import { LVP_ICD_PATH } from "./host.ts";

/**
 * Valeur correcte de VK_LOADER_DRIVERS_SELECT pour un ICD donné : le loader matche
 * le NOM DE MANIFEST (glob). Pour lvp_icd.json → "lvp_icd.json". On renvoie le
 * basename exact (match sûr ; le glob `*lvp*` marche aussi mais on évite la
 * sur-sélection si plusieurs ICD partagent un fragment).
 */
export function driverSelectFor(icdPath: string): string {
	return basename(icdPath);
}

export interface VulkanEnvOptions {
	/** Chemin de l'ICD LavaPipe (défaut : LVP_ICD_PATH). */
	readonly icdPath?: string;
	/** Threads du rasterizer logiciel = cœurs render alloués. */
	readonly renderThreads: number;
	/**
	 * Forcer un fallback purement software côté Mesa/GL aussi (utile si du code
	 * GL traîne via wined3d). Défaut true.
	 */
	readonly softwareGl?: boolean;
}

/**
 * Construit le bloc d'env Vulkan logiciel. À fusionner dans l'env du process JEU
 * (celui qui rend), pas dans le worker à capability.
 */
export function vulkanEnv(opts: VulkanEnvOptions): Record<string, string> {
	const icd = opts.icdPath ?? LVP_ICD_PATH;
	const env: Record<string, string> = {
		// Sélection ICD moderne (remplace VK_ICD_FILENAMES déprécié).
		VK_DRIVER_FILES: icd,
		// Glob sur le NOM DE MANIFEST, pas le nom du driver (cf. correction empirique).
		VK_LOADER_DRIVERS_SELECT: driverSelectFor(icd),
		// Threads du rasterizer = cœurs render.
		LP_NUM_THREADS: String(Math.max(1, opts.renderThreads)),
		// Galllium : force lavapipe si quelque chose passe par l'API GL.
		GALLIUM_DRIVER: "llvmpipe",
	};

	if (opts.softwareGl ?? true) {
		// Mesa software rasterizer pour OpenGL (wined3d GL backend).
		env["LIBGL_ALWAYS_SOFTWARE"] = "1";
		env["MESA_LOADER_DRIVER_OVERRIDE"] = "llvmpipe";
	}

	return env;
}

export interface ProbeResult {
	readonly ok: boolean;
	readonly deviceName?: string | undefined;
	readonly driverId?: string | undefined;
	readonly deviceType?: string | undefined;
	readonly raw: string;
}

/**
 * Sonde le device Vulkan via `vulkaninfo` avec l'env logiciel. Confirme qu'un
 * device CPU/llvmpipe est exposé. Ne lance PAS le jeu.
 *
 * NB : on utilise `vulkaninfo` (pas `--summary`) car SANS DISPLAY le mode
 * `--summary` saute la section Devices ("skipping surface info") ; le mode complet
 * énumère les GPU indépendamment d'une surface. Les champs ont un espacement
 * variable (ex. `driverID    = ...`), géré par les regex tolérantes.
 */
export async function probeVulkan(icdPath = LVP_ICD_PATH): Promise<ProbeResult> {
	const proc = Bun.spawn(["vulkaninfo"], {
		env: {
			...process.env,
			VK_DRIVER_FILES: icdPath,
			VK_LOADER_DRIVERS_SELECT: driverSelectFor(icdPath),
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	const [raw] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);

	const deviceName = raw.match(/deviceName\s*=\s*(.+)/)?.[1]?.trim();
	const driverId = raw.match(/driverID\s*=\s*(\S+)/)?.[1]?.trim();
	const deviceType = raw.match(/deviceType\s*=\s*(\S+)/)?.[1]?.trim();

	const ok =
		driverId === "DRIVER_ID_MESA_LLVMPIPE" ||
		deviceType === "PHYSICAL_DEVICE_TYPE_CPU" ||
		(deviceName?.includes("llvmpipe") ?? false);

	return { ok, deviceName, driverId, deviceType, raw };
}
