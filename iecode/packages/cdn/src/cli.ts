#!/usr/bin/env bun
/**
 * iecode-cdn — CLI du CDN menu azalee (résolution, rendu PNG, export batch, serve HTTP).
 *
 *   iecode-cdn resolve <azaleePath>        affiche conteneur G4TX + texture
 *   iecode-cdn render  <azaleePath> -o f   décode 1 icône PNG lossless vers f
 *   iecode-cdn export  <outDir> [--filter s] [--overwrite]   matérialise l'arbre dx11/menu/**.png
 *   iecode-cdn serve   [--port 8788]       sert HTTP (?format=png lossless, défaut raw)
 *   iecode-cdn ls      [filter]            liste les conteneurs G4TX menu
 *
 * Options communes : --game <dir> (défaut : install Steam détecté).
 */
import { parseArgs } from "node:util";
import { openMenuCdn } from "./index.ts";
import { serveMenuCdn } from "./serve.ts";

const { values, positionals } = parseArgs({
	args: Bun.argv.slice(2),
	allowPositionals: true,
	options: {
		game: { type: "string" },
		output: { type: "string", short: "o" },
		filter: { type: "string" },
		overwrite: { type: "boolean", default: false },
		port: { type: "string" },
		concurrency: { type: "string" },
	},
});

const cmd = positionals[0];
const game = values.game;

switch (cmd) {
	case "resolve": {
		const cdn = openMenuCdn(game);
		try {
			const r = cdn.resolve(positionals[1]!);
			if (!r) {
				console.error(`UNRESOLVED ${positionals[1]}`);
				process.exit(1);
			}
			console.log(JSON.stringify(r, null, 2));
		} finally {
			cdn.dispose();
		}
		break;
	}
	case "render": {
		const cdn = openMenuCdn(game);
		try {
			const m = await cdn.render(positionals[1]!);
			if (!m) {
				console.error(`404 ${positionals[1]}`);
				process.exit(1);
			}
			const out = values.output ?? `${m.azaleePath.split("/").pop()}`;
			await Bun.write(out, m.bytes);
			console.log(`${m.width}x${m.height}  ${m.bytes.length} bytes  -> ${out}`);
		} finally {
			cdn.dispose();
		}
		break;
	}
	case "export": {
		const cdn = openMenuCdn(game);
		try {
			const report = await cdn.exportTree(positionals[1]!, {
				filter: values.filter,
				overwrite: values.overwrite,
				concurrency: values.concurrency ? Number(values.concurrency) : undefined,
			});
			console.log(JSON.stringify(report, null, 2));
		} finally {
			cdn.dispose();
		}
		break;
	}
	case "ls": {
		const cdn = openMenuCdn(game);
		try {
			const list = cdn.listContainers(positionals[1]);
			for (const p of list) console.log(p);
			console.error(`${list.length} conteneur(s) G4TX menu`);
		} finally {
			cdn.dispose();
		}
		break;
	}
	case "serve": {
		const srv = serveMenuCdn({ gamePath: game, port: values.port ? Number(values.port) : undefined });
		console.log(`CDN menu azalee : ${srv.url}  (?format=png pour PNG lossless)`);
		process.on("SIGINT", () => {
			srv.stop();
			process.exit(0);
		});
		break;
	}
	default:
		console.error(
			"usage: iecode-cdn <resolve|render|export|ls|serve> [...] [--game dir]\n" +
				"  resolve <azaleePath>\n" +
				"  render  <azaleePath> -o file.png\n" +
				"  export  <outDir> [--filter s] [--overwrite] [--concurrency N]\n" +
				"  ls      [filter]\n" +
				"  serve   [--port 8788]"
		);
		process.exit(cmd ? 1 : 0);
}
