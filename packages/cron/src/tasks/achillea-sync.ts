/**
 * Réaligne le miroir `rg.achillea` sur la base Achilléa.
 *
 * CE QUI EST SYNCHRONISÉ : LE SCHÉMA, PAS LES DONNÉES
 * Les deux bases vivent dans le même cluster Postgres, et `rg.achillea` est un
 * ensemble de tables étrangères (`postgres_fdw`) qui lisent `achillea.public`
 * en direct. Les **données** n'ont donc rien à synchroniser : une écriture du
 * bot Achilléa est visible depuis `rg` à la milliseconde suivante.
 *
 * Ce qui dérive, c'est la **forme**. `apps/achillea-bot/database/migrations`
 * ajoute des tables et des colonnes ; une table étrangère créée avant la
 * migration ne les connaît pas, et une colonne supprimée côté source fait
 * échouer le `SELECT` au moment où une page d'administration la demande —
 * jamais au moment de la migration. Cette tâche referme cet écart chaque nuit,
 * et signale la dérive au lieu de la laisser surgir en production.
 *
 * Planifiée à 4 h 20, après la fenêtre de maintenance nocturne d'Achilléa.
 */

import { $ } from "bun";

/** Binaire Bun courant : cf. `tasks/db.ts`, le `PATH` du service ne suffit pas. */
const BUN = process.execPath;

const SCRIPT = "scripts/ops/achillea-fdw.ts";

export interface ResultatSyncAchillea {
	success: boolean;
	/** Nombre de tables exposées dans `rg.achillea` après recâblage. */
	tables?: number;
	error?: string;
}

/**
 * Rend la racine du dépôt.
 *
 * `rg-cron.service` tourne avec `WorkingDirectory=/home/ubuntu/rg`, mais la
 * tâche est aussi lancée à la main depuis un sous-dossier : on ne suppose pas
 * le répertoire courant.
 */
function racineDepot(): string {
	return process.env["RG_ROOT"] ?? "/home/ubuntu/rg";
}

export async function runAchilleaSync(): Promise<ResultatSyncAchillea> {
	console.log("[Cron Achilléa] Réimport du schéma `achillea` dans la base `rg`…");
	try {
		const sortie = await $`${BUN} ${SCRIPT}`.cwd(racineDepot()).text();
		console.log(sortie.trim());

		// Le script rend le compte sur sa dernière ligne utile. On l'extrait pour
		// que le tableau de bord affiche un chiffre plutôt qu'un « ok » muet : un
		// miroir tombé de 75 à 3 tables est un incident, et un « ok » le cache.
		const trouve = /✓ (\d+) tables/.exec(sortie);
		const tables = trouve?.[1] ? Number(trouve[1]) : undefined;

		if (tables !== undefined && tables < 10) {
			return {
				success: false,
				tables,
				error: `miroir suspect : seulement ${tables} tables exposées`,
			};
		}

		console.log(`[Cron Achilléa] ✓ miroir aligné (${tables ?? "?"} tables)`);
		return { success: true, tables };
	} catch (erreur) {
		const message = erreur instanceof Error ? erreur.message : String(erreur);
		console.error("[Cron Achilléa] ✗ échec du recâblage :", message);
		return { success: false, error: message };
	}
}
