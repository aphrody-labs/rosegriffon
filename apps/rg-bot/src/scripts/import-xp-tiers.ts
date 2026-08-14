/**
 * Import de l'XP/niveau du bot de niveaux TIERS vers `bot_profils`, et de ses
 * récompenses de rôle par palier vers `bot_recompenses_niveau`.
 *
 * ── LE BOT IDENTIFIÉ : NOCTALY (application Discord 875811233616519219) ────
 * Identification croisée, aucune supposition :
 *   - `GET /guilds/1072991720268111892/integrations` (jeton DISCORD_BOT_TOKEN)
 *     liste Noctaly avec pour description officielle Discord : « Text, Voice
 *     & Reaction XP • Reaction Roles • Ban Appeal • Auto Leaderboard • Custom
 *     Bot • Moderation • Logs • Support 26 Languages ».
 *   - Le salon #🎀〡rôles (1349589953721401355) contient un message du staff
 *     (inazo__, 7/4/2026) qui décrit en détail le « Système d'XP » du
 *     serveur : XP textuel + XP vocal **séparés** (deux niveaux distincts par
 *     membre), salons exclus (mudae/mudae-2 en textuel ; AFK + salons de
 *     Modération en vocal), et 4 paliers de rôles (10/25/40/60) — exactement
 *     les fonctionnalités « Text & Voice XP » + « Level Roles » de Noctaly.
 *   - Le salon #🤖〡bots (1135698156835852369) contient les interactions
 *     RÉELLES `/rank` et `/leaderboard` de Noctaly (champ
 *     `interaction_metadata.name` des messages), et des embeds
 *     « 🎉 Niveau supérieur ! Félicitations … Vous avez atteint le niveau… »
 *     — le message de montée de niveau exact de Noctaly.
 *   - Le salon #💬📖〡logs (1073752409387573339) montre Noctaly logger aussi
 *     arrivées/départs, messages édités/supprimés, entrées/sorties vocal — le
 *     module « Logs » listé dans sa description.
 *
 * ── FORMULE D'XP RÉELLE DE NOCTALY (valeurs par défaut du bot ; RG a pu les
 *    modifier depuis son dashboard, invérifiable sans y accéder) ───────────
 *   Sourcé sur noctaly.com/tutorials/how-to-setup-discord-leveling-system et
 *   noctaly.com/table (table statique des 100 paliers, servie côté serveur) :
 *     - XP message  : 20 XP/message, cooldown 60 s
 *     - XP vocal    : 6 XP/minute (membre non muet et non sourd)
 *     - XP réaction : 15 XP/réaction, cooldown 300 s
 *     - XP commande : 10 XP/commande utilisée, cooldown 60 s
 *     - XP cumulée pour ATTEINDRE le niveau n : régression sur les 3
 *       premières lignes de noctaly.com/table (125, 160, 205 XP pour passer
 *       1→2, 2→3, 3→4) puis vérifiée sur les 100 lignes de la table : le coût
 *       pour passer du niveau n à n+1 vaut `5·n² + 20·n + 100`.
 *   Salon d'annonce de montée de niveau : PAS un salon fixe. Les deux embeds
 *   « Niveau supérieur » retrouvés dans l'historique apparaissent dans le
 *   salon où le membre venait d'être actif (#🤖〡bots pour l'un,
 *   #💬🏫〡général-modérateurs pour l'autre) : c'est le mode par défaut de
 *   Noctaly, « Current Channel » (annonce dans le salon courant), pas un
 *   « Custom Channel » unique configuré par RG.
 *
 * ── CE QUI EST IMPORTÉ, ET SURTOUT CE QUI NE L'EST PAS ──────────────────────
 *   Noctaly n'expose AUCUNE route publique de classement complet :
 *     - Son API publique (base `https://noctaly.com/api/v1`, cf. le SDK
 *       officiel github.com/Noctalycom/node-sdk) exige une clé API
 *       (`GET /guilds/{id}/users/{id}/level-profile`, un membre à la fois —
 *       aucune route de liste/export en bulk) générée depuis
 *       noctaly.com/dashboard par un membre du staff RG ayant la permission
 *       Discord « Gérer le serveur » — connexion OAuth humaine, hors de
 *       portée de cet agent. Sans clé : 401 `unauthenticated`. Aucune clé
 *       Noctaly n'existe dans ce dépôt (`.env`, `.secrets/`) : vérifié.
 *     - La page publique noctaly.com/leaderboard/<guild> est une SPA Next.js
 *       dont les données de classement sont chargées côté client après
 *       hydratation JS ; le HTML livré au premier chargement ne contient
 *       AUCUN identifiant Discord de membre (vérifié par recherche sur la
 *       réponse brute) et se limite de toute façon au top 100.
 *     - Le classement auto-posté par la commande `/leaderboard` dans
 *       #🤖〡bots est une IMAGE PNG (carte générée par Noctaly), donc ni
 *       paginable ni exhaustive — seulement le TOP 10, et l'XP y est déjà
 *       arrondie à l'affichage (« 44.4k » = quelque part entre 44 350 et
 *       44 449 XP réelle).
 *   → Résultat : seul le TOP 10 du dernier classement public retrouvé (posté
 *     le 9/8/2026 dans #🤖〡bots, message 1536045686259323010, généré par la
 *     commande `/leaderboard` de yoyo__goat) a pu être récupéré : lu
 *     visuellement sur l'image, puis chaque pseudo résolu en ID Discord réel
 *     via `GET /guilds/1072991720268111892/members/search?query=<pseudo>`.
 *     C'est 10 comptes sur ~1 902 membres (`approximate_member_count` de la
 *     guilde au 14/8/2026) : moins de 1 %.
 *   LES ~1 892 AUTRES MEMBRES NE SONT PAS RÉCUPÉRABLES PAR CE SCRIPT. Pour
 *   les obtenir, deux voies, toutes deux humaines :
 *     1. Un membre du staff RG génère une clé API sur noctaly.com/dashboard,
 *        puis on itère `GET /guilds/{id}/users/{id}/level-profile` sur les
 *        `discord_id` de `discord_members` (limite documentée : 50 req/s).
 *     2. Si le dashboard propose un export (CSV/JSON) — non documenté
 *        publiquement, à vérifier de visu — un humain le télécharge et on
 *        écrit un second script qui le lit.
 *   Aucun chiffre au-delà de ce TOP 10 n'a été inventé.
 *
 * ── CORRESPONDANCE DE COURBE ─────────────────────────────────────────────
 *   L'XP est importée BRUTE, telle qu'affichée par Noctaly (imprécise à la
 *   centaine près pour ce lot, cf. ci-dessus). Le niveau est RECALCULÉ avec
 *   `niveauPour()` de la courbe du JEU (`../lib/experience.ts`, 100 paliers,
 *   `inagle_exp_table`) — jamais le niveau Noctaly écrit tel quel : les deux
 *   courbes ne se correspondent pas (ex. niveau 26 Noctaly ≈ 44 400 XP ≈
 *   niveau 30 sur la courbe du jeu, bien plus dure en haut de classement).
 *   Si l'XP dépasse le plafond de notre courbe (2 878 742), `niveauPour` la
 *   borne déjà à 100 — aucun cas dans ce lot (max = 44 400).
 *
 * ── RÉCOMPENSES DE RÔLE PAR PALIER ──────────────────────────────────────────
 *   Sourcées du même message #🎀〡rôles. Noctaly a DEUX pistes de niveau par
 *   membre (textuelle et vocale) avec, à chaque palier, un rôle DISTINCT par
 *   piste mais les mêmes avantages, plus un rôle spécial exigeant le palier
 *   60 sur les deux pistes à la fois.
 *   ⚠ La table réelle `bot_recompenses_niveau` a pour clé primaire
 *   `(guild_id, niveau)` — vérifié via `pg_get_constraintdef` — et non
 *   `(guild_id, niveau, role_id)` : UN SEUL rôle par niveau et par guilde est
 *   représentable, pas un rôle par piste. Notre bot (`experience.ts`,
 *   `GAIN_DEFAUT`) ne track d'ailleurs QUE de l'XP de message, aucune XP
 *   vocale — il n'a donc de toute façon pas de second axe où loger une piste
 *   vocale. Choix fait ici : importer la piste TEXTUELLE de Noctaly (la plus
 *   proche de notre propre système), et **abandonner** la piste vocale ainsi
 *   que le rôle spécial « textuel ET vocal niveau 60 » (aucune des deux
 *   n'entre dans un schéma à un seul rôle par niveau). Le rôle de base donné
 *   à l'arrivée (1073013308623429782, tout le monde l'a dès le join) et le
 *   rôle de boost Nitro (1089171148287250463, indexé sur le statut de boost
 *   et pas sur un palier) sont eux aussi volontairement EXCLUS : ce ne sont
 *   pas des récompenses de palier.
 *   Conversion palier Noctaly → XP Noctaly (colonne « Total XP » de
 *   noctaly.com/table) → niveau jeu via `niveauPour()` :
 *     - palier 10 → 4 025 XP   → niveau 13 → rôle textuel 1086256838137352242
 *     - palier 25 → 36 625 XP  → niveau 30 → rôle textuel 1086257086591160340
 *     - palier 40 → 131 100 XP → niveau 45 → rôle textuel 1086618597578776708
 *     - palier 60 → 411 650 XP → niveau 62 → rôle textuel 1086619301714329720
 *   `cumulable` : Noctaly RETIRE par défaut le rôle du palier précédent à
 *   chaque montée (`Stack Roles` est une option qu'il faut activer à la main
 *   dans son dashboard) ; nous n'avons pas accès à ce réglage pour RG, donc
 *   on importe `cumulable = false` (le défaut de fabrique de Noctaly) plutôt
 *   que de deviner. Si un humain confirme que RG a activé « Stack Roles »,
 *   corriger avec `UPDATE bot_recompenses_niveau SET cumulable = true WHERE
 *   guild_id = '1072991720268111892'`.
 *
 * ── UTILISATION ──────────────────────────────────────────────────────────
 *   bun apps/bot/src/scripts/import-xp-tiers.ts --essai   # rien n'est écrit
 *   bun apps/bot/src/scripts/import-xp-tiers.ts            # écrit réellement
 *   Idempotent : `ON CONFLICT (guild_id, discord_id) DO UPDATE` pour les
 *   profils, `ON CONFLICT (guild_id, niveau, role_id) DO UPDATE` pour les
 *   récompenses — relancer ce script ne duplique rien.
 */
import { niveauPour } from "../lib/experience";
import { sql } from "../lib/db";

const GUILD_ID = "1072991720268111892";

interface EntreeClassement {
	/** Pseudo affiché sur la carte de classement Noctaly (source visuelle). */
	pseudo: string;
	/** Résolu réellement via GET /guilds/{id}/members/search?query=<pseudo>. */
	discordId: string;
	/** Niveau Noctaly affiché — non importé tel quel, gardé pour traçabilité. */
	niveauNoctaly: number;
	/** XP brute affichée par Noctaly, arrondie à la centaine ("44.4k" → 44400). */
	xp: number;
}

/**
 * TOP 10 du classement Noctaly du 9/8/2026 (message Discord
 * 1536045686259323010, salon #🤖〡bots, image
 * cdn.discordapp.com/attachments/1135698156835852369/1536045708740796489).
 * Lu visuellement sur l'image, chaque pseudo résolu en ID réel via l'API.
 */
const TOP10_NOCTALY: readonly EntreeClassement[] = [
	{ pseudo: "Mioleen_", discordId: "435479810731409408", niveauNoctaly: 26, xp: 44_400 },
	{ pseudo: "Ichigo Kurosaki", discordId: "593493079911170068", niveauNoctaly: 22, xp: 28_800 },
	{ pseudo: "Inazo", discordId: "531549483067244566", niveauNoctaly: 18, xp: 15_900 },
	{ pseudo: "IceCream", discordId: "831595693986021388", niveauNoctaly: 15, xp: 10_500 },
	{ pseudo: "Rishar", discordId: "254337557272330241", niveauNoctaly: 14, xp: 9_200 },
	{ pseudo: "Yoyo", discordId: "281114294152724491", niveauNoctaly: 14, xp: 8_700 },
	{ pseudo: "Dash", discordId: "563787814483918858", niveauNoctaly: 13, xp: 7_800 },
	{ pseudo: "ploufy !!", discordId: "987039164988030976", niveauNoctaly: 12, xp: 6_900 },
	{ pseudo: "yuan yuan", discordId: "779044049374019594", niveauNoctaly: 12, xp: 6_000 },
	{ pseudo: "Pegeto", discordId: "768526829279510529", niveauNoctaly: 11, xp: 5_500 },
] as const;

interface PalierRoleNoctaly {
	palierNoctaly: number;
	/** Colonne « Total XP » de noctaly.com/table pour ce palier. */
	xpNoctaly: number;
	/**
	 * Rôle de la piste TEXTUELLE uniquement. La piste vocale (ex.
	 * 1165331596170248192 pour ce palier) et le rôle « textuel ET vocal
	 * niveau 60 » (1165335240403849337) sont abandonnés : la table
	 * `bot_recompenses_niveau` a pour clé `(guild_id, niveau)`, un seul rôle
	 * par niveau — voir le commentaire d'en-tête.
	 */
	roleTextuel: string;
}

/** Les 4 paliers de rôles décrits dans #🎀〡rôles, piste textuelle seulement. */
const PALIERS_ROLES_NOCTALY: readonly PalierRoleNoctaly[] = [
	{ palierNoctaly: 10, xpNoctaly: 4_025, roleTextuel: "1086256838137352242" },
	{ palierNoctaly: 25, xpNoctaly: 36_625, roleTextuel: "1086257086591160340" },
	{ palierNoctaly: 40, xpNoctaly: 131_100, roleTextuel: "1086618597578776708" },
	{ palierNoctaly: 60, xpNoctaly: 411_650, roleTextuel: "1086619301714329720" },
] as const;

const essai = Bun.argv.includes("--essai");

function ligne(discordId: string, xp: number): { discordId: string; xp: number; niveau: number } {
	return { discordId, xp, niveau: niveauPour(xp) };
}

async function importerProfils(): Promise<number> {
	let ecrites = 0;
	for (const entree of TOP10_NOCTALY) {
		const { discordId, xp, niveau } = ligne(entree.discordId, entree.xp);
		console.log(
			`  ${entree.pseudo.padEnd(20)} niveau Noctaly ${String(entree.niveauNoctaly).padStart(3)} · ` +
				`xp ${String(xp).padStart(6)} → niveau jeu ${niveau}`
		);
		if (!essai) {
			await sql`
				INSERT INTO bot_profils (guild_id, discord_id, xp, niveau, maj_le)
				VALUES (${GUILD_ID}, ${discordId}, ${xp}, ${niveau}, now())
				ON CONFLICT (guild_id, discord_id) DO UPDATE SET
					xp = EXCLUDED.xp,
					niveau = EXCLUDED.niveau,
					maj_le = now()
			`;
		}
		ecrites++;
	}
	return ecrites;
}

async function importerRecompenses(): Promise<number> {
	let ecrites = 0;
	for (const palier of PALIERS_ROLES_NOCTALY) {
		const niveau = niveauPour(palier.xpNoctaly);
		console.log(
			`  palier Noctaly ${String(palier.palierNoctaly).padStart(2)} (${palier.xpNoctaly} xp) → niveau jeu ${niveau} ` +
				`· rôle textuel ${palier.roleTextuel}`
		);
		if (!essai) {
			await sql`
				INSERT INTO bot_recompenses_niveau (guild_id, niveau, role_id, cumulable)
				VALUES (${GUILD_ID}, ${niveau}, ${palier.roleTextuel}, false)
				ON CONFLICT (guild_id, niveau) DO UPDATE SET
					role_id = EXCLUDED.role_id,
					cumulable = EXCLUDED.cumulable
			`;
		}
		ecrites++;
	}
	return ecrites;
}

console.log(`=== Import XP tiers (Noctaly → bot_profils) ${essai ? "[--essai, rien n'est écrit]" : ""} ===\n`);

console.log("Profils (top 10 du 9/8/2026) :");
const profilsEcrits = await importerProfils();

console.log("\nRécompenses de rôle par palier :");
const recompensesEcrites = await importerRecompenses();

console.log(`\n${essai ? "Simulerait" : "A écrit"} ${profilsEcrits} profil(s) et ${recompensesEcrites} récompense(s).`);

if (!essai) {
	const [stats] = await sql<Array<{ total: number; xp_max: number; niveau_max: number }>>`
		SELECT count(*)::int AS total, max(xp)::int AS xp_max, max(niveau)::int AS niveau_max
		FROM bot_profils WHERE guild_id = ${GUILD_ID}
	`;
	console.log(
		`Vérification bot_profils(guild_id=${GUILD_ID}) : total=${stats?.total} max(xp)=${stats?.xp_max} max(niveau)=${stats?.niveau_max}`
	);
}

process.exit(0);
