/**
 * Orchestrateur de synchro IEVR : scrape store (bxc) + download/extraction natifs.
 *
 * Le download et le dump passent par le CLI natif `iecode` (construit depuis la
 * même solution que @rose-griffon/iecode-core, SteamKit2 — **sans steamcmd**). Le chemin du
 * binaire est dérivé de l'assembly exporté par @rose-griffon/iecode-core, gage d'un build cohérent.
 *
 * @example
 *   import { syncApp } from "@rose-griffon/iecode-steam-sync";
 *   await syncApp({ dumpOut: "~/iecode-dump" }); // STEAM_USER/PASSWORD/GUARD via env
 */
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { $ } from "bun";
import { IECODE_CORE_DLL } from "@rose-griffon/iecode-core";
import { SteamStoreScraper } from "./scraper.ts";
import type { SteamSyncOptions, SteamSyncResult } from "./types.ts";

/** App ID Steam d'INAZUMA ELEVEN: Victory Road (cf. IECODE.Core IEVRConstants). */
export const IEVR_APP_ID = 2_799_860;

/** Cache des jetons Steam par défaut (session non-interactive après le 1er login). */
export const DEFAULT_TOKEN_STORE = join(
	homedir(),
	".local",
	"share",
	"iecode",
	"steam-tokens.json"
);

/** Chemin du CLI `iecode` (dll), dérivé de l'assembly @rose-griffon/iecode-core (même build). */
export function resolveIecodeCli(): string {
	// .../src/IECODE.Core/bin/Release/net10.0/IECODE.Core.dll → .../src/IECODE.CLI/.../iecode.dll
	const coreDir = dirname(IECODE_CORE_DLL);
	return join(
		coreDir.replace(`${join("/", "IECODE.Core", "/")}`, join("/", "IECODE.CLI", "/")),
		"iecode.dll"
	);
}

/** Projet CLI .csproj (pour build à la volée si le dll manque). */
function resolveCliProject(cliDll: string): string {
	// .../src/IECODE.CLI/bin/Release/net10.0/iecode.dll → .../src/IECODE.CLI/IECODE.CLI.csproj
	let dir = dirname(cliDll);
	for (let i = 0; i < 3; i++) {
		dir = dirname(dir);
	} // Net10.0 → Release → bin → IECODE.CLI
	return join(dir, "IECODE.CLI.csproj");
}

/**
 * Pipeline complet : (1) scrape métadonnées store via bxc, (2) download Steam natif,
 * (3) dump CPK sélectif. Renvoie les métadonnées + l'état d'avancement.
 */
export async function syncApp(options: SteamSyncOptions): Promise<SteamSyncResult> {
	const log = options.onLog ?? ((m: string) => console.info(m));
	const appId = options.appId ?? IEVR_APP_ID;
	const installDir = options.installDir ?? join(options.dumpOut, ".steam");
	const preset = options.preset ?? "inagle-azalee";
	const tokenStore = options.tokenStore ?? DEFAULT_TOKEN_STORE;
	const cli = options.cliDllPath ?? resolveIecodeCli();

	const result: SteamSyncResult = {
		appId,
		downloaded: false,
		dumpOut: options.dumpOut,
		dumped: false,
		installDir,
		metadata: null,
	};

	// 1. Métadonnées store (bxc) — informatif, n'interrompt pas la synchro.
	if (options.scrapeMetadata !== false) {
		try {
			log(`▸ scrape store (bxc) app ${appId}…`);
			result.metadata = await new SteamStoreScraper({ onLog: log }).scrapeApp(appId);
			const m = result.metadata;
			log(
				`  ${m.name} — ${m.price?.formatted ?? (m.isFree ? "gratuit" : "n/a")} — ${m.releaseDate ?? "?"}`
			);
		} catch (error) {
			log(`  scrape échoué (${(error as Error).message}) — on continue.`);
		}
	}

	// CLI natif requis pour download/dump : build si absent.
	if ((!options.skipDownload || !options.skipDump) && !existsSync(cli)) {
		const proj = resolveCliProject(cli);
		log("▸ build CLI iecode (Release)…");
		await $`dotnet build ${proj} -c Release`.quiet();
	}

	// 2. Download Steam natif (SteamKit2, sans steamcmd).
	if (!options.skipDownload) {
		const user = options.user ?? process.env["STEAM_USER"];
		if (!user) {
			throw new Error("STEAM_USER requis pour le download (ou skipDownload: true).");
		}
		const env = {
			...process.env,
			STEAM_USER: user,
			...((options.password ?? process.env["STEAM_PASSWORD"])
				? { STEAM_PASSWORD: options.password ?? process.env["STEAM_PASSWORD"]! }
				: {}),
			...(options.guardCode ? { STEAM_GUARD_CODE: options.guardCode } : {}),
		};
		const args = [
			"download",
			String(appId),
			"-o",
			installDir,
			"--branch",
			options.branch ?? "public",
			"--os",
			options.os ?? "windows",
			"--token-store",
			tokenStore,
		];
		log(`▸ download natif app ${appId} → ${installDir}`);
		await $`dotnet ${cli} ${args}`.env(env);
		result.downloaded = true;
	}

	// 3. Dump CPK sélectif (extraction native).
	if (!options.skipDump) {
		log(`▸ dump (preset ${preset}) ${installDir} → ${options.dumpOut}`);
		await $`dotnet ${cli} dump -g ${installDir} -o ${options.dumpOut} --preset ${preset} --smart`;
		result.dumped = true;
	}

	log(`✓ sync terminé — ${options.dumpOut}`);
	return result;
}

/**
 * Inspecte les depots d'une app (login + manifests, sans téléchargement) et affiche
 * le tableau ID / manifest / fichiers / taille. Identifiants via env STEAM_USER… ou args.
 */
export async function listDepots(
	appId = IEVR_APP_ID,
	opts: {
		user?: string;
		password?: string;
		guardCode?: string;
		tokenStore?: string;
		cliDllPath?: string;
	} = {}
): Promise<void> {
	const cli = opts.cliDllPath ?? resolveIecodeCli();
	if (!existsSync(cli)) {
		await $`dotnet build ${resolveCliProject(cli)} -c Release`.quiet();
	}
	const env = {
		...process.env,
		...((opts.user ?? process.env["STEAM_USER"])
			? { STEAM_USER: opts.user ?? process.env["STEAM_USER"]! }
			: {}),
		...((opts.password ?? process.env["STEAM_PASSWORD"])
			? { STEAM_PASSWORD: opts.password ?? process.env["STEAM_PASSWORD"]! }
			: {}),
		...(opts.guardCode ? { STEAM_GUARD_CODE: opts.guardCode } : {}),
	};
	await $`dotnet ${cli} download ${appId} --list --token-store ${opts.tokenStore ?? DEFAULT_TOKEN_STORE}`.env(
		env
	);
}
