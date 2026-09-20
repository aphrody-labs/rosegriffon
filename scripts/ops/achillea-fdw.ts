#!/usr/bin/env bun
/**
 * Unification des bases `rg` et `achillea` — câblage et réparation.
 *
 * POURQUOI PAS UNE FUSION DE TABLES
 * Les deux bases vivent dans le **même cluster Postgres 18** (port 5432) :
 * `rg` (301 tables dans `public`) et `achillea` (~70 tables). Copier les tables
 * d'Achilléa dans `rg` imposerait une synchronisation permanente, une fenêtre
 * de divergence, et un second propriétaire de la vérité pour des données dont
 * `achillea-bot` reste l'unique écrivain. On expose donc la base distante en
 * lecture via `postgres_fdw`, dans un schéma dédié `achillea` de la base `rg`.
 *
 * Résultat : les pages d'administration unifiées de `apps/website` joignent
 * `public.profiles` et `achillea.clan` dans **une seule requête SQL**, sans
 * décalage de synchronisation et sans octet dupliqué. Réversible en une
 * commande (`DROP SCHEMA achillea CASCADE`), sans toucher aux données.
 *
 * POURQUOI `BYPASSRLS`
 * Presque toutes les tables d'Achilléa portent une RLS taillée pour ses propres
 * rôles applicatifs. Un rôle lecteur ordinaire n'a aucune politique qui le
 * vise : il se connecte, et lit **zéro ligne** sur les 3 850 utilisateurs et
 * 69 clans. Le miroir a donc besoin de `BYPASSRLS` — la même sémantique que le
 * `service_role` déjà utilisé côté RG. C'est pour cela que le schéma n'est
 * jamais accordé à `anon` ni `authenticated` : côté `rg`, la seule barrière est
 * le GRANT de schéma, et les lectures doivent passer par `createAdminClient()`
 * derrière une garde de session, comme toute lecture de données personnelles.
 *
 * POURQUOI UN RÔLE DÉDIÉ
 * `pg_hba.conf` impose `scram-sha-256` sur 127.0.0.1 : une correspondance
 * d'utilisateur FDW a besoin d'un mot de passe. Plutôt que de réutiliser le
 * compte d'écriture du bot, on crée `achillea_reader`, en lecture seule, dont
 * le secret est généré ici et rangé hors du dépôt, dans
 * `/etc/rose-griffon/achillea-fdw.env` (0600, `root`).
 *
 * POURQUOI RELANCER CE SCRIPT
 * `IMPORT FOREIGN SCHEMA` fige la liste des tables au moment de l'import. Les
 * migrations d'Achilléa (`apps/achillea-bot/database/migrations`, 56 à ce jour)
 * en ajoutent et en modifient. Ce script est **idempotent** : le relancer
 * réimporte le schéma et réaligne les droits. C'est ce que fait la tâche
 * `sync:achillea` de `rg-cron`, chaque nuit.
 *
 * SÉCURITÉ
 * Le schéma `achillea` n'est accordé qu'à `service_role` et `rg`. Il n'est
 * **jamais** donné à `anon` ni `authenticated`, et n'est pas ajouté aux schémas
 * exposés par `rg-postgrest.service` : sans quoi l'intégralité des données
 * Achilléa (utilisateurs, sanctions, portefeuilles) deviendrait lisible par la
 * clé publique du navigateur.
 *
 * Usage :
 *   bun scripts/ops/achillea-fdw.ts            # câble ou répare
 *   bun scripts/ops/achillea-fdw.ts --verifier # ne modifie rien, rend 1 si dérive
 *   bun scripts/ops/achillea-fdw.ts --retirer  # débranche tout, sans perte
 */

import { randomBytes } from "node:crypto";
import { $ } from "bun";

const FICHIER_SECRET = "/etc/rose-griffon/achillea-fdw.env";
const BASE_SOURCE = "achillea";
const BASE_CIBLE = "rg";
const SCHEMA = "achillea";
const ROLE = "achillea_reader";
const SERVEUR = "achillea_srv";

/** Rôles de la base `rg` autorisés à lire le schéma importé. Jamais `anon`. */
const ROLES_LECTEURS = ["service_role", "rg"] as const;

/**
 * Exécute du SQL en tant que `postgres` via la socket locale (`peer`), donc
 * sans mot de passe. `--single-transaction` garantit qu'une étape ratée ne
 * laisse pas un câblage à moitié fait.
 */
async function sql(base: string, requete: string): Promise<string> {
	const sortie = await $`sudo -n -u postgres psql -d ${base} -v ON_ERROR_STOP=1 -Atc ${requete}`
		.quiet()
		.text();
	return sortie.trim();
}

async function sqlScript(base: string, script: string): Promise<void> {
	const tampon = Buffer.from(script, "utf8");
	await $`sudo -n -u postgres psql -d ${base} -v ON_ERROR_STOP=1 --single-transaction < ${tampon}`.quiet();
}

/**
 * Lit le secret existant, ou en génère un et le persiste.
 *
 * Le mot de passe n'est jamais réécrit s'il existe déjà : le réécrire
 * invaliderait la correspondance d'utilisateur en place le temps d'un
 * `ALTER ROLE`, et une page d'administration ouverte à cet instant afficherait
 * une erreur de connexion.
 */
async function secret(): Promise<string> {
	const existant = await $`sudo -n cat ${FICHIER_SECRET}`
		.quiet()
		.nothrow()
		.text()
		.catch(() => "");
	const trouve = /^ACHILLEA_FDW_PASSWORD=(.+)$/m.exec(existant ?? "");
	if (trouve?.[1]) return trouve[1].trim();

	const genere = randomBytes(32).toString("base64url");
	const contenu = `# Généré par scripts/ops/achillea-fdw.ts — ne pas committer.\nACHILLEA_FDW_PASSWORD=${genere}\n`;
	// `install` refuse un tube non repositionnable : on passe par un fichier
	// temporaire, créé en 0600 avant d'y écrire le secret.
	const provisoire = `/tmp/achillea-fdw.${randomBytes(6).toString("hex")}`;
	await Bun.write(provisoire, contenu, { mode: 0o600 });
	try {
		await $`sudo -n install -m 600 -o root -g root ${provisoire} ${FICHIER_SECRET}`.quiet();
	} finally {
		await $`rm -f ${provisoire}`.quiet().nothrow();
	}
	console.log(`  · secret généré et rangé dans ${FICHIER_SECRET}`);
	return genere;
}

/** Échappe une chaîne pour un littéral SQL. */
function litteral(valeur: string): string {
	return `'${valeur.replaceAll("'", "''")}'`;
}

async function cabler(): Promise<void> {
	const motDePasse = await secret();

	console.log(`→ base ${BASE_SOURCE} : rôle ${ROLE} en lecture seule`);
	await sqlScript(
		BASE_SOURCE,
		`
		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}') THEN
				CREATE ROLE ${ROLE} LOGIN BYPASSRLS PASSWORD ${litteral(motDePasse)};
			ELSE
				ALTER ROLE ${ROLE} LOGIN BYPASSRLS PASSWORD ${litteral(motDePasse)};
			END IF;
		END $$;

		GRANT CONNECT ON DATABASE ${BASE_SOURCE} TO ${ROLE};
		GRANT USAGE ON SCHEMA public TO ${ROLE};
		GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ROLE};
		-- Les migrations d'Achilléa créent des tables après coup : sans droit par
		-- défaut, chaque nouvelle table serait invisible jusqu'au prochain GRANT.
		ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${ROLE};
		`
	);

	console.log(`→ base ${BASE_CIBLE} : serveur distant et schéma ${SCHEMA}`);
	await sqlScript(
		BASE_CIBLE,
		`
		CREATE EXTENSION IF NOT EXISTS postgres_fdw;

		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = '${SERVEUR}') THEN
				CREATE SERVER ${SERVEUR}
					FOREIGN DATA WRAPPER postgres_fdw
					OPTIONS (host '127.0.0.1', port '5432', dbname '${BASE_SOURCE}');
			END IF;
		END $$;

		-- Une correspondance par rôle appelant : Postgres ne retombe pas sur
		-- PUBLIC, donc un rôle sans correspondance verrait « user mapping not
		-- found » au premier SELECT.
		DO $$
		DECLARE r text;
		BEGIN
			FOREACH r IN ARRAY ARRAY['postgres', ${ROLES_LECTEURS.map(litteral).join(", ")}] LOOP
				IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN CONTINUE; END IF;
				IF EXISTS (
					SELECT 1 FROM pg_user_mappings
					WHERE srvname = '${SERVEUR}' AND usename = r
				) THEN
					EXECUTE format(
						'ALTER USER MAPPING FOR %I SERVER ${SERVEUR} OPTIONS (SET user %L, SET password %L)',
						r, '${ROLE}', ${litteral(motDePasse)}
					);
				ELSE
					EXECUTE format(
						'CREATE USER MAPPING FOR %I SERVER ${SERVEUR} OPTIONS (user %L, password %L)',
						r, '${ROLE}', ${litteral(motDePasse)}
					);
				END IF;
			END LOOP;
		END $$;

		`
	);

	// POURQUOI PAS `IMPORT FOREIGN SCHEMA`
	// Achilléa déclare des types ENUM dans son propre `public` (`license_status`,
	// statuts de tournoi, rôles de clan…). L'import génère un DDL qui les
	// référence en clair (`public.license_status`), types qui n'existent pas
	// dans `rg` — l'import échoue en bloc. Les recréer dans `rg.public`
	// polluerait un schéma qui porte déjà 301 tables, pour des valeurs dont
	// Achilléa reste seul maître.
	//
	// On génère donc le DDL depuis le catalogue distant, en ramenant tout type
	// non standard (énuméré, domaine, composite) à `text`. postgres_fdw
	// transporte de toute façon les valeurs en représentation textuelle : la
	// lecture est identique, et le miroir ne dépend plus des types d'Achilléa.
	console.log(`→ génération du miroir dans ${BASE_CIBLE}.${SCHEMA}`);
	const colonnes = await sql(
		BASE_SOURCE,
		`
		SELECT c.relname || E'\t' || a.attname || E'\t' ||
			CASE
				WHEN t.typtype IN ('e', 'd', 'c') THEN 'text'
				WHEN t.typtype = 'b' AND te.typtype IN ('e', 'd', 'c') THEN 'text[]'
				ELSE format_type(a.atttypid, a.atttypmod)
			END
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
		JOIN pg_type t ON t.oid = a.atttypid
		LEFT JOIN pg_type te ON te.oid = t.typelem
		WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
		ORDER BY c.relname, a.attnum
		`
	);

	const tables = new Map<string, string[]>();
	for (const ligne of colonnes.split("\n").filter(Boolean)) {
		const [table, colonne, type] = ligne.split("\t");
		if (!table || !colonne || !type) continue;
		const liste = tables.get(table) ?? [];
		liste.push(`\t"${colonne}" ${type} OPTIONS (column_name '${colonne}')`);
		tables.set(table, liste);
	}
	if (tables.size === 0) throw new Error("catalogue distant vide : câblage interrompu");

	const ddl = [...tables]
		.map(
			([table, cols]) =>
				`CREATE FOREIGN TABLE ${SCHEMA}."${table}" (\n${cols.join(",\n")}\n) SERVER ${SERVEUR} OPTIONS (schema_name 'public', table_name '${table}');`
		)
		.join("\n\n");

	// Le schéma est reconstruit d'un bloc, dans une transaction : soit le miroir
	// complet remplace l'ancien, soit rien ne bouge. Aucune donnée n'est touchée
	// — elles vivent dans la base `achillea`.
	await sqlScript(
		BASE_CIBLE,
		`
		DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;
		CREATE SCHEMA ${SCHEMA};
		COMMENT ON SCHEMA ${SCHEMA} IS
			'Miroir en lecture de la base achillea via postgres_fdw. Écrivain unique : achillea-bot. Recâblé par scripts/ops/achillea-fdw.ts.';

		${ddl}

		GRANT USAGE ON SCHEMA ${SCHEMA} TO ${ROLES_LECTEURS.join(", ")};
		GRANT SELECT ON ALL TABLES IN SCHEMA ${SCHEMA} TO ${ROLES_LECTEURS.join(", ")};
		-- Garde-fou explicite : ce schéma ne doit jamais fuir par PostgREST.
		REVOKE ALL ON SCHEMA ${SCHEMA} FROM anon, authenticated;
		`
	);

	const nb = await sql(
		BASE_CIBLE,
		`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='${SCHEMA}' and c.relkind='f'`
	);
	console.log(`✓ ${nb} tables Achilléa lisibles depuis ${BASE_CIBLE}.${SCHEMA}`);
}

/** Rend le nombre de tables manquantes côté `rg` par rapport à `achillea`. */
async function derive(): Promise<number> {
	const source = new Set(
		(
			await sql(
				BASE_SOURCE,
				"select tablename from pg_tables where schemaname='public' order by 1"
			)
		)
			.split("\n")
			.filter(Boolean)
	);
	const cible = new Set(
		(
			await sql(
				BASE_CIBLE,
				`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='${SCHEMA}' and c.relkind='f' order by 1`
			)
		)
			.split("\n")
			.filter(Boolean)
	);
	const manquantes = [...source].filter((t) => !cible.has(t));
	if (manquantes.length > 0) {
		console.error(`⚠ ${manquantes.length} tables absentes du miroir : ${manquantes.join(", ")}`);
	}
	return manquantes.length;
}

async function retirer(): Promise<void> {
	console.log(`→ retrait du câblage (aucune donnée supprimée)`);
	await sqlScript(
		BASE_CIBLE,
		`
		DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;
		DROP SERVER IF EXISTS ${SERVEUR} CASCADE;
		`
	);
	console.log("✓ débranché. Les données Achilléa sont intactes dans leur base.");
}

const mode = process.argv[2];
if (mode === "--retirer") {
	await retirer();
} else if (mode === "--verifier") {
	const manquantes = await derive();
	if (manquantes > 0) process.exit(1);
	console.log("✓ miroir aligné");
} else {
	await cabler();
	await derive();
}
