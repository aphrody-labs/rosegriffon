#!/usr/bin/env bun
// oxlint-disable no-console -- point d'entrée CLI : stdout est la sortie attendue
/**
 * CLI `iecode-data` — flow IEVR headless unifié.
 *
 * Usage :
 *   iecode-data accumulate --out <corpusDir>     check build → download+dump → export corpus
 *   iecode-data export --data <dir> --out <dir>  export le corpus depuis des données existantes
 *   iecode-data serve --data <dir> [--port 3000] sert l'API HTTP inagle headless
 *   iecode-data version <appId>                  affiche le buildid Steam courant
 *
 * Options accumulate : --app, --data, --steam <dir>, --preset, --force, --skip-acquire,
 *   --user, --password, --guard, --token-store. Identifiants aussi via env STEAM_*.
 */
import { parseArgs } from "node:util";
import { accumulate } from "./accumulate.ts";
import { exportCorpus } from "./corpus.ts";
import { serve } from "./serve.ts";
import { getRemoteBuildId } from "./version.ts";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	args: Bun.argv.slice(2),
	options: {
		app: { type: "string" },
		data: { type: "string" },
		out: { short: "o", type: "string" },
		steam: { type: "string" },
		preset: { short: "p", type: "string" },
		port: { type: "string" },
		user: { short: "u", type: "string" },
		password: { type: "string" },
		guard: { type: "string" },
		"token-store": { type: "string" },
		force: { type: "boolean" },
		"skip-acquire": { type: "boolean" },
		pretty: { type: "boolean" },
	},
});

const cmd = positionals[0] ?? "help";
const appId = values.app ? Number(values.app) : undefined;
const creds = {
	user: values.user,
	password: values.password,
	guardCode: values.guard,
	tokenStore: values["token-store"],
};

switch (cmd) {
	case "accumulate": {
		if (!values.out) throw new Error("--out <corpusDir> requis");
		const res = await accumulate({
			appId,
			corpusOut: values.out,
			dumpOut: values.steam,
			dataPath: values.data,
			preset: values.preset,
			force: values.force,
			skipAcquire: values["skip-acquire"],
			...creds,
		});
		console.log(
			JSON.stringify(
				{ updated: res.updated, buildId: res.buildId, total: res.corpus?.total ?? 0 },
				null,
				2
			)
		);
		break;
	}
	case "export": {
		if (!values.out) throw new Error("--out <dir> requis");
		const manifest = await exportCorpus({
			dataPath: values.data,
			outDir: values.out,
			pretty: values.pretty,
			onLog: (m) => console.error(m),
		});
		console.log(
			JSON.stringify(
				{ total: manifest.total, domains: Object.keys(manifest.counts).length },
				null,
				2
			)
		);
		break;
	}
	case "serve": {
		const s = await serve({
			dataPath: values.data,
			port: values.port ? Number(values.port) : undefined,
		});
		console.log(`API inagle: ${s.url}`);
		// Garde le process vivant.
		await new Promise(() => {});
		break;
	}
	case "version": {
		const id = appId ?? (positionals[1] ? Number(positionals[1]) : 2799860);
		console.log(await getRemoteBuildId(id, creds));
		break;
	}
	default:
		console.log(
			"iecode-data <accumulate|export|serve|version>\n" +
				"  accumulate --out <dir>        check build → download+dump → corpus\n" +
				"  export --data <dir> --out <dir>  corpus depuis données existantes\n" +
				"  serve --data <dir> [--port N]    API HTTP inagle headless\n" +
				"  version [appId]                  buildid Steam courant"
		);
}
