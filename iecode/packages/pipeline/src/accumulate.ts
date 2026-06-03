/**
 * Accumulation IEVR gardée par build : détecte une mise à jour Steam, (re)télécharge
 * + extrait si nécessaire, puis exporte le corpus complet via inagle. Idempotent —
 * ne refait rien si le buildid n'a pas changé. C'est l'« automatise l'update de data ».
 */
import { join } from "node:path";
import { IEVR_APP_ID, syncApp } from "@rose-griffon/iecode-steam-sync";
import { exportCorpus } from "./corpus.ts";
import type { AccumulateOptions, AccumulateResult } from "./types.ts";
import { getRemoteBuildId, readSnapshot, writeSnapshot } from "./version.ts";

export async function accumulate(opts: AccumulateOptions): Promise<AccumulateResult> {
	const log = opts.onLog ?? ((m: string) => console.info(m));
	const appId = opts.appId ?? IEVR_APP_ID;
	const branch = opts.branch ?? "public";
	const dumpOut = opts.dumpOut ?? join(opts.corpusOut, ".steam");
	const dataPath = opts.dataPath ?? dumpOut;
	const snapshotPath = opts.snapshotPath ?? join(opts.corpusOut, ".build-snapshot.json");

	const prev = await readSnapshot(snapshotPath);
	const previousBuildId = prev?.buildId ?? null;

	// 1. buildid distant (check rapide). Tolérant : si indisponible (pas de creds),
	//    on retombe sur "0" → on force l'accumulation seulement si demandé.
	let remoteBuildId = 0;
	try {
		remoteBuildId = await getRemoteBuildId(appId, { ...opts, branch });
		log(
			`▸ build distant: ${remoteBuildId}${previousBuildId ? ` (local: ${previousBuildId})` : ""}`
		);
	} catch (error) {
		log(`▸ build distant indisponible (${(error as Error).message})`);
	}

	const buildChanged = remoteBuildId !== 0 && remoteBuildId !== previousBuildId;
	const shouldRun = opts.force || buildChanged || (remoteBuildId === 0 && opts.skipAcquire);

	if (!shouldRun) {
		log(`✓ corpus à jour (build ${previousBuildId ?? "?"}) — rien à faire.`);
		return {
			updated: false,
			appId,
			buildId: remoteBuildId || (previousBuildId ?? 0),
			previousBuildId,
			corpus: null,
			corpusOut: opts.corpusOut,
		};
	}

	// 2. Acquisition (download + dump) si demandée et build changé.
	if (!opts.skipAcquire) {
		log(`▸ acquisition app ${appId} → ${dumpOut} (download + dump)…`);
		await syncApp({
			appId,
			dumpOut,
			installDir: join(dumpOut, ".install"),
			branch,
			preset: opts.preset,
			user: opts.user,
			password: opts.password,
			guardCode: opts.guardCode,
			tokenStore: opts.tokenStore,
			scrapeMetadata: false,
			onLog: log,
		});
	}

	// 3. Export du corpus complet via inagle.
	log(`▸ export corpus depuis ${dataPath}…`);
	const corpus = await exportCorpus({
		dataPath,
		outDir: opts.corpusOut,
		buildId: remoteBuildId || undefined,
		onLog: log,
	});

	// 4. Instantané pour la prochaine détection de mise à jour.
	await writeSnapshot(snapshotPath, {
		appId,
		branch,
		buildId: remoteBuildId,
		dataPath,
		corpusOut: opts.corpusOut,
		accumulatedAt: new Date().toISOString(),
	});

	log(`✓ accumulation terminée — build ${remoteBuildId}, ${corpus.total} entrées.`);
	return {
		updated: true,
		appId,
		buildId: remoteBuildId,
		previousBuildId,
		corpus,
		corpusOut: opts.corpusOut,
	};
}
