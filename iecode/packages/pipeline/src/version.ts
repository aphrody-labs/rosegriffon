/**
 * Détection de mise à jour du jeu via le buildid Steam (auto-update du corpus).
 */
import { $ } from "bun";
import { resolveIecodeCli } from "@rose-griffon/iecode-steam-sync";
import type { BuildSnapshot } from "./types.ts";

/** Lit l'instantané de build précédent (ou null). */
export async function readSnapshot(path: string): Promise<BuildSnapshot | null> {
	try {
		return (await Bun.file(path).json()) as BuildSnapshot;
	} catch {
		return null;
	}
}

/** Écrit l'instantané de build. */
export async function writeSnapshot(path: string, snap: BuildSnapshot): Promise<void> {
	await Bun.write(path, `${JSON.stringify(snap, null, 2)}\n`);
}

/**
 * buildid Steam courant d'une app (via `iecode steam-build`, login + app info seulement).
 * Identifiants par env STEAM_USER/PASSWORD/GUARD_CODE ou args. Lève si indisponible.
 */
export async function getRemoteBuildId(
	appId: number,
	opts: {
		user?: string;
		password?: string;
		guardCode?: string;
		tokenStore?: string;
		branch?: string;
		cliDllPath?: string;
	} = {}
): Promise<number> {
	const cli = opts.cliDllPath ?? resolveIecodeCli();
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
	const args = ["steam-build", String(appId), "--json", "--branch", opts.branch ?? "public"];
	if (opts.tokenStore) args.push("--token-store", opts.tokenStore);
	const out = await $`dotnet ${cli} ${args}`.env(env).text();
	const parsed = JSON.parse(out.trim()) as { buildId: number };
	return Number(parsed.buildId);
}
