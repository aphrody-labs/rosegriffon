/** `azalee glossary-rebuild` — reconstruction du glossaire consolidé. */

import { createRequire } from "node:module";

import type { Command } from "commander";

import { colors, errorMessage, reportError, restoreLogs, suppressLogs } from "../context";
import type { GlossaryRebuildOptions } from "../types";

/**
 * Le script de reconstruction est un **script du package**, pas un module du
 * CLI : on le résout donc depuis le point d'entrée `src/cli.ts` plutôt que
 * depuis ce fichier. Le chemin reste valide quelle que soit la profondeur à
 * laquelle la commande est déclarée.
 */
const requireFromEntrypoint = createRequire(new URL("../../cli.ts", import.meta.url));

/** Signature attendue du script `scripts/build-glossary.ts`. */
interface GlossaryRebuildModule {
	main: () => Promise<Record<string, number>>;
}

export function registerGlossaryRebuildCommand(program: Command): void {
	program
		.command("glossary-rebuild")
		.description("Regroupe et renforce le glossaire (inagle, text binaries, fr.json)")
		.option("-j, --json", "Format de sortie en JSON brute")
		.action(async (options: GlossaryRebuildOptions) => {
			suppressLogs(!!options.json);
			if (!options.json) {
				console.log(`${colors.cyan}Lancement de la reconstruction complète du glossaire...${colors.reset}`);
			}

			try {
				const { main: rebuildGlossary } = requireFromEntrypoint(
					"../scripts/build-glossary.ts",
				) as GlossaryRebuildModule;
				const counts = await rebuildGlossary();

				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ success: true, counts }));
				}
			} catch (e) {
				reportError(
					options.json,
					errorMessage(e),
					`${colors.red}Erreur de reconstruction : ${errorMessage(e)}${colors.reset}`,
				);
			}
		});
}
