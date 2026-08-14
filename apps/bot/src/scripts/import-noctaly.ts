/**
 * Import COMPLET des données Noctaly, par l'API officielle.
 *
 * ── CE QUE CE SCRIPT FAIT, ET POURQUOI IL A FALLU ATTENDRE ────────────────
 * `import-xp-tiers.ts` a récupéré 65 membres SANS clé, en dépouillant
 * l'historique des salons (cartes `/leaderboard`, embeds « Niveau supérieur »).
 * C'était 3,4 % des membres, et c'était tout ce qui était atteignable.
 *
 * Ce script-ci fait le reste : muni de la clé API générée depuis le tableau de
 * bord Noctaly, il interroge pour CHAQUE membre de `discord_members` :
 *   - `GET …/level-profile`  → XP, niveau, messages, minutes vocales, réactions
 *   - `GET …/eco-profile`    → monnaie, inventaire, coffres, série quotidienne
 * plus, une seule fois pour toute la guilde, `GET …/items` et `GET …/chests`.
 * C'est l'intégralité de ce que l'API expose en lecture.
 *
 * ── L'API N'A AUCUNE ROUTE DE LISTE DE MEMBRES ────────────────────────────
 * Vérifié sur la documentation intégrale (llms.txt → 11 pages) : les modules
 * « Leveling » et « Economy » n'exposent que des routes par membre. Pas de
 * classement, pas d'export, pas de pagination. L'import est donc forcément une
 * boucle — d'où le soin apporté à la cadence dans `lib/noctaly.ts`.
 *
 * ── TOUT EST ARCHIVÉ BRUT AVANT D'ÊTRE INTERPRÉTÉ ─────────────────────────
 * `bot_import_noctaly` garde les deux réponses JSON telles quelles. L'import
 * ne se rejouera pas : le jour où Noctaly quitte le serveur, l'API cesse de
 * répondre. Ce qu'on n'aura pas gardé sera perdu pour de bon — y compris ce
 * qu'on a décidé de ne PAS mapper aujourd'hui (inventaire, coffres), qui
 * pourra ainsi être repris plus tard sans rien redemander à personne.
 *
 * ── LA COURBE : ON REPORTE L'XP BRUTE, PAS LE NIVEAU ───────────────────────
 * `totalXp` est écrite telle quelle dans `bot_profils.xp`, et `niveauPour()`
 * la relit sur la courbe DU JEU. C'est la convention déjà retenue par les deux
 * passes précédentes, et elle se vérifie : le coût Noctaly pour passer de n à
 * n+1 vaut `5n² + 20n + 100`, ce qui place ses paliers très près des nôtres
 * une fois cumulés (Noctaly 10 → jeu 12, 25 → 29, 50 → 53, 60 → 61, 100 → 89).
 * Les deux courbes étant monotones, l'ORDRE du classement est préservé à
 * l'identique — personne ne double personne à cause de la conversion.
 *
 * Reporter le NIVEAU plutôt que l'XP aurait été le choix inverse : il aurait
 * collé les membres au bas de leur palier et effacé l'écart entre celui qui
 * vient de monter et celui qui est sur le point de monter.
 *
 * ── LA MONNAIE NE S'IMPORTE PAS SANS AVOIR REGARDÉ ────────────────────────
 * Un jeton Kizuna se gagne à 25/jour et un recrutement en coûte 150. La
 * monnaie Noctaly suit une configuration de serveur inconnue avant lecture.
 * Le taux de conversion est donc explicite (`--taux=`), il vaut 0 par défaut
 * — c'est-à-dire **aucune monnaie importée** — et l'`--essai` affiche la
 * distribution réelle (médiane, maximum, total) pour choisir en connaissance
 * de cause. Un import monétaire mal calibré ne se rattrape pas : les jetons
 * auront déjà été dépensés.
 *
 * ── AUCUNE VALEUR N'EST JAMAIS RÉTROGRADÉE ─────────────────────────────────
 * `GREATEST` sur `xp`, `niveau`, `messages_comptes` et `serie_quotidienne`. Le
 * nouveau bot tourne depuis le 14/8/2026 et crédite déjà de l'XP : un import
 * lancé après coup ne doit pas ramener un membre actif à sa valeur Noctaly,
 * plus ancienne. Et relancer le script ne change rien la seconde fois.
 *
 * Les jetons font exception et s'ADDITIONNENT une seule fois, gardés par
 * `bot_import_noctaly.importe_le` : un crédit est un mouvement, pas un état.
 * Relancer l'import ne recrédite donc personne.
 *
 * ── LES MEMBRES SANS RIEN NE CRÉENT PAS DE LIGNE ──────────────────────────
 * Noctaly n'a été activé que le 11/3/2026 : la majorité des ~1 834 membres n'a
 * aucun profil chez lui (404) ou un profil à zéro. Leur créer une ligne vide
 * gonflerait le classement de comptes inactifs. La ligne se créera d'elle-même
 * à leur premier message (`ajouterExperience`).
 *
 * ── UTILISATION ───────────────────────────────────────────────────────────
 *   bun apps/bot/src/scripts/import-noctaly.ts --essai       # rien n'est écrit
 *   bun apps/bot/src/scripts/import-noctaly.ts               # XP + archive
 *   bun apps/bot/src/scripts/import-noctaly.ts --taux=0.1    # + monnaie ÷10
 *   bun apps/bot/src/scripts/import-noctaly.ts --cadence=5   # plus prudent
 *   bun apps/bot/src/scripts/import-noctaly.ts --tous        # + membres partis
 *   bun apps/bot/src/scripts/import-noctaly.ts --sans-eco    # niveaux seuls
 *
 * La clé se pose dans `apps/bot/.env` :  NOCTALY_API_KEY=…
 */
import { RG_GUILD_ID } from "@rosegriffon/types/discord";

import { sql } from "../lib/db";
import { niveauPour } from "../lib/experience";
import {
	AIDE_CLE_MANQUANTE,
	attenteAvantSuivante,
	bilanVide,
	CADENCE_DEFAUT,
	classerReponse,
	convertirMonnaie,
	distribution,
	lireProfil,
	lireProfilEconomie,
	lireQuota,
	meriteEcriture,
	meriteEcritureEconomie,
	PLAFOND_DOCUMENTE,
	resumerBilan,
	urlCoffresGuilde,
	urlObjetsGuilde,
	urlProfilEconomie,
	urlProfilNiveau,
	type Issue,
	type Quota,
} from "../lib/noctaly";

const GUILD_ID = RG_GUILD_ID;

const essai = Bun.argv.includes("--essai");
const tous = Bun.argv.includes("--tous");
const sansEco = Bun.argv.includes("--sans-eco");

/** Lit une option `--nom=valeur` numérique, ou rend le défaut. */
function optionNombre(nom: string, defaut: number): number {
	const argument = Bun.argv.find((valeur) => valeur.startsWith(`--${nom}=`));
	if (!argument) {
		return defaut;
	}
	const valeur = Number(argument.slice(nom.length + 3));
	if (!Number.isFinite(valeur) || valeur < 0) {
		console.error(`Option illisible : ${argument}`);
		process.exit(1);
	}
	return valeur;
}

const cadence = Math.min(PLAFOND_DOCUMENTE, Math.max(1, optionNombre("cadence", CADENCE_DEFAUT)));
/** 0 = on lit la monnaie et on la rapporte, mais on n'en crédite aucune. */
const taux = optionNombre("taux", 0);

const cle = (Bun.env.NOCTALY_API_KEY ?? "").trim();
if (cle === "") {
	console.error(AIDE_CLE_MANQUANTE);
	process.exit(1);
}

const dormir = (ms: number) => new Promise((resoudre) => setTimeout(resoudre, ms));

const bilan = bilanVide();
let quota: Quota = { dansSecondes: null, limite: null, restant: null };
let interrompu: string | null = null;

/**
 * Une requête, cadencée et classée. Rend le corps JSON quand tout va bien.
 *
 * Centralisée ici parce que c'est le seul endroit du script qui touche au
 * réseau : la cadence, la lecture du quota et l'arrêt sur 429 s'appliquent
 * donc à TOUTES les routes, y compris les deux catalogues de guilde, sans
 * qu'on ait à y penser à chaque appel.
 */
async function interroger(url: string): Promise<{ issue: Issue; corps: unknown }> {
	await dormir(attenteAvantSuivante(quota, cadence));
	let reponse: Response;
	try {
		reponse = await fetch(url, {
			headers: { Authorization: cle },
			signal: AbortSignal.timeout(15_000),
		});
	} catch (err) {
		return { corps: err instanceof Error ? err.message : String(err), issue: "panne" };
	}
	quota = lireQuota(reponse.headers);
	const issue = classerReponse(reponse.status);
	if (issue === "refuse") {
		interrompu =
			`clé refusée (HTTP ${reponse.status}) — vérifier NOCTALY_API_KEY et qu'elle appartient ` +
			`bien au serveur ${GUILD_ID}`;
		return { corps: null, issue };
	}
	if (issue === "quota") {
		// On ne réessaie PAS : la documentation annonce un retryAfter d'une heure
		// et une mise en liste noire pour les applications qui insistent. L'import
		// étant idempotent, reprendre plus tard ne coûte rien.
		interrompu =
			`quota dépassé (HTTP 429) — reprendre plus tard avec une cadence plus basse ` +
			`(--cadence=${Math.max(1, Math.floor(cadence / 2))}). Aucune requête de plus n'est ` +
			`envoyée : insister fait blacklister.`;
		return { corps: null, issue };
	}
	if (issue !== "ok") {
		return { corps: null, issue };
	}
	return { corps: await reponse.json().catch(() => null), issue };
}

// ─── Les membres à interroger ───────────────────────────────────────────────
// Par défaut, les humains encore présents : interroger un bot est une requête
// gaspillée (Noctaly ne leur donne pas d'XP), et un membre parti répond
// `404 Unknown Member` — sauf s'il revient un jour, d'où `--tous`.
const membres = tous
	? await sql<Array<{ discord_id: string; username: string }>>`
		SELECT discord_id, username FROM discord_members
		 WHERE NOT is_bot
		 ORDER BY joined_at NULLS LAST
	`
	: await sql<Array<{ discord_id: string; username: string }>>`
		SELECT discord_id, username FROM discord_members
		 WHERE NOT is_bot AND left_at IS NULL
		 ORDER BY joined_at NULLS LAST
	`;

/** Les membres déjà crédités en jetons — un crédit ne se rejoue pas. */
const dejaCredites = new Set(
	(
		await sql<Array<{ discord_id: string }>>`
			SELECT discord_id FROM bot_import_noctaly WHERE guild_id = ${GUILD_ID}
		`
	).map((ligne) => ligne.discord_id)
);

const requetesParMembre = sansEco ? 1 : 2;
console.log(
	`=== Import Noctaly ${essai ? "[--essai, rien n'est écrit] " : ""}===\n` +
		`${membres.length} membre(s) × ${requetesParMembre} requête(s) · cadence ${cadence} req/s ` +
		`(plafond documenté ${PLAFOND_DOCUMENTE})\n` +
		`durée estimée ${Math.ceil((membres.length * requetesParMembre) / cadence)} s · ` +
		`taux monnaie → jetons : ${taux === 0 ? "0 (aucune monnaie importée)" : taux}\n`
);

// ─── Les deux catalogues de guilde, une fois pour toutes ────────────────────
if (!sansEco) {
	for (const [genre, url] of [
		["items", urlObjetsGuilde(GUILD_ID)],
		["chests", urlCoffresGuilde(GUILD_ID)],
	] as const) {
		const { corps, issue } = await interroger(url);
		if (issue !== "ok" || corps === null) {
			console.log(`  catalogue ${genre} : ${issue}`);
			continue;
		}
		const compte = Array.isArray((corps as Record<string, unknown>)[genre])
			? ((corps as Record<string, unknown>)[genre] as unknown[]).length
			: 0;
		console.log(`  catalogue ${genre} : ${compte} entrée(s)`);
		if (!essai) {
			await sql`
				INSERT INTO bot_import_noctaly_catalogue (guild_id, genre, contenu)
				VALUES (${GUILD_ID}, ${genre}, ${JSON.stringify(corps)}::jsonb)
				ON CONFLICT (guild_id, genre) DO UPDATE SET
					contenu = EXCLUDED.contenu, importe_le = now()
			`;
		}
	}
	console.log("");
}

// ─── La boucle des membres ──────────────────────────────────────────────────
const notables: Array<{ pseudo: string; xp: number; niveau: number; messages: number }> = [];
const soldes: number[] = [];

for (const membre of membres) {
	if (interrompu) {
		break;
	}

	const niveauRep = await interroger(urlProfilNiveau(GUILD_ID, membre.discord_id));
	bilan.interroges++;
	if (interrompu) {
		break;
	}

	let profil = null;
	switch (niveauRep.issue) {
		case "ok":
			profil = lireProfil(niveauRep.corps);
			if (!profil) {
				bilan.illisibles++;
				console.warn(`  ⚠ ${membre.username} — profil de niveau illisible`);
			}
			break;
		case "absent":
			bilan.absents++;
			break;
		default:
			bilan.pannes++;
			console.warn(`  ⚠ ${membre.username} — niveau : ${niveauRep.issue}`);
			break;
	}

	// L'économie s'interroge même quand le niveau est absent : les deux modules
	// de Noctaly sont indépendants, un membre peut avoir de la monnaie sans XP.
	let eco = null;
	/**
	 * La réponse d'économie TELLE QUELLE, gardée pour l'archive.
	 *
	 * `lireProfilEconomie` réduit `items[]` et `chests[]` à leur nombre — c'est
	 * tout ce dont l'import a besoin. Mais archiver cette réduction viderait
	 * l'archive de sa raison d'être : le détail de l'inventaire (noms, prix,
	 * durabilité, quantités) ne se retrouvera nulle part une fois Noctaly
	 * retiré du serveur. C'est le corps brut qu'on garde.
	 */
	let ecoBrut: unknown = null;
	if (!sansEco) {
		const ecoRep = await interroger(urlProfilEconomie(GUILD_ID, membre.discord_id));
		if (interrompu) {
			break;
		}
		if (ecoRep.issue === "ok") {
			ecoBrut = ecoRep.corps;
			eco = lireProfilEconomie(ecoRep.corps);
		} else if (ecoRep.issue !== "absent") {
			bilan.pannes++;
		}
		if (eco) {
			soldes.push(eco.monnaie);
		}
	}

	if (!profil && !eco) {
		continue;
	}

	// L'archive d'abord : elle est la seule trace intégrale, et elle sert de
	// garde contre un double crédit de jetons.
	const premierPassage = !dejaCredites.has(membre.discord_id);
	if (!essai) {
		await sql`
			INSERT INTO bot_import_noctaly (guild_id, discord_id, profil_niveau, profil_eco)
			VALUES (
				${GUILD_ID}, ${membre.discord_id},
				${niveauRep.issue === "ok" ? JSON.stringify(niveauRep.corps) : null}::jsonb,
				${ecoBrut === null ? null : JSON.stringify(ecoBrut)}::jsonb
			)
			ON CONFLICT (guild_id, discord_id) DO UPDATE SET
				profil_niveau = COALESCE(EXCLUDED.profil_niveau, bot_import_noctaly.profil_niveau),
				profil_eco = COALESCE(EXCLUDED.profil_eco, bot_import_noctaly.profil_eco),
				importe_le = now()
		`;
	}
	bilan.archives++;

	const aDuNiveau = profil !== null && meriteEcriture(profil);
	const aDeLEco = eco !== null && meriteEcritureEconomie(eco);
	if (profil !== null && !aDuNiveau) {
		bilan.vides++;
	}
	if (aDeLEco) {
		bilan.economies++;
	}
	if (!aDuNiveau && !aDeLEco) {
		continue;
	}

	const xp = aDuNiveau && profil ? profil.xpTotale : 0;
	const niveau = niveauPour(xp);
	const messages = aDuNiveau && profil ? profil.messages : 0;
	const serie = aDeLEco && eco ? (eco.serieQuotidienne ?? 0) : 0;
	// Les jetons ne se recréditent pas : `premierPassage` garde le mouvement.
	const jetons = premierPassage && eco ? convertirMonnaie(eco.monnaie, taux) : 0;

	if (aDuNiveau && profil) {
		bilan.ecrits++;
		notables.push({ messages, niveau, pseudo: membre.username, xp });
	}

	if (!essai) {
		await sql`
			INSERT INTO bot_profils (
				guild_id, discord_id, xp, niveau, messages_comptes,
				jetons, jetons_gagnes, serie_quotidienne, maj_le
			)
			VALUES (
				${GUILD_ID}, ${membre.discord_id}, ${xp}, ${niveau}, ${messages},
				${jetons}, ${jetons}, ${serie}, now()
			)
			ON CONFLICT (guild_id, discord_id) DO UPDATE SET
				xp = GREATEST(bot_profils.xp, EXCLUDED.xp),
				niveau = GREATEST(bot_profils.niveau, EXCLUDED.niveau),
				messages_comptes = GREATEST(bot_profils.messages_comptes, EXCLUDED.messages_comptes),
				serie_quotidienne = GREATEST(bot_profils.serie_quotidienne, EXCLUDED.serie_quotidienne),
				jetons = bot_profils.jetons + EXCLUDED.jetons,
				jetons_gagnes = bot_profils.jetons_gagnes + EXCLUDED.jetons_gagnes,
				maj_le = now()
		`;
	}

	if (bilan.interroges % 100 === 0) {
		const reste = quota.restant === null ? "" : ` · quota ${quota.restant}/${quota.limite ?? "?"}`;
		console.log(`  … ${bilan.interroges}/${membres.length} · ${bilan.ecrits} importé(s)${reste}`);
	}
}

// ─── Le rapport ─────────────────────────────────────────────────────────────
notables.sort((a, b) => b.xp - a.xp);
if (notables.length > 0) {
	console.log(`\nLes 20 plus hauts profils :`);
	for (const entree of notables.slice(0, 20)) {
		console.log(
			`  ${entree.pseudo.padEnd(28).slice(0, 28)} ${String(entree.xp).padStart(8)} xp ` +
				`→ niveau ${String(entree.niveau).padStart(3)} · ${entree.messages} message(s)`
		);
	}
}

const monnaie = distribution(soldes);
if (monnaie.compte > 0) {
	console.log(
		`\nMonnaie Noctaly : ${monnaie.compte} membre(s) en ont · médiane ${monnaie.median} · ` +
			`maximum ${monnaie.maximum} · total ${monnaie.total}`
	);
	if (taux === 0) {
		console.log(
			`  Aucune n'a été convertie (--taux=0). Un jeton Kizuna vaut 25/jour et un recrutement ` +
				`en coûte 150 :\n  relancer avec --taux=<valeur> une fois le rapport ci-dessus lu.`
		);
	} else {
		console.log(`  Convertie au taux ${taux} → ${convertirMonnaie(monnaie.total, taux)} jeton(s) au total.`);
	}
}

console.log(`\n${resumerBilan(bilan)}`);
if (essai) {
	console.log("(--essai : aucune écriture)");
}

if (interrompu) {
	console.error(`\nImport INTERROMPU : ${interrompu}`);
	process.exit(1);
}

if (!essai) {
	const [stats] = await sql<
		Array<{ total: number; avec_xp: number; xp_max: string; niveau_max: number }>
	>`
		SELECT count(*)::int AS total,
		       count(*) FILTER (WHERE xp > 0)::int AS avec_xp,
		       max(xp) AS xp_max,
		       max(niveau)::int AS niveau_max
		  FROM bot_profils WHERE guild_id = ${GUILD_ID}
	`;
	console.log(
		`bot_profils(guild_id=${GUILD_ID}) : ${stats?.total} ligne(s) · ${stats?.avec_xp} avec XP · ` +
			`max(xp)=${stats?.xp_max} · max(niveau)=${stats?.niveau_max}`
	);
}

process.exit(0);
