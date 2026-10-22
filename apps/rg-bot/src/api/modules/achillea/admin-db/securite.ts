/**
 * Règles de sécurité de la console base de données du back-office.
 *
 * Tout ce qui décide « autorisé ou non » vit ici, en fonctions pures, pour être
 * testé sans base. Le contrôleur n'interpole JAMAIS un identifiant reçu du
 * client : il passe par `tableAutorisee` / `colonnesConnues` puis `citerIdent`.
 *
 * Écarts volontaires avec le legacy (`legacy/achillea-bot/src/api/controllers/admin-db.ts`),
 * tous dans le sens d'une restriction :
 * - le legacy exposait toutes les tables du schéma `public` ; ici, liste blanche
 *   explicite des tables Achilléa, dans le seul schéma `achillea` ;
 * - `user_connection` et `oauth_csrf` (jetons OAuth) ne sont plus lisibles du tout ;
 * - les colonnes secrètes (`license.qr_secret`, jetons) sont masquées en lecture et
 *   refusées en écriture ;
 * - `user.role` n'est plus modifiable ici : la route dédiée applique ses garde-fous ;
 * - la console SQL tourne dans une transaction READ ONLY avec `statement_timeout`,
 *   un plafond de lignes, et son plan est vérifié (relations en liste blanche).
 */

/** Seul schéma visible depuis la console. */
export const SCHEMA_ACHILLEA = "achillea" as const;

/**
 * Tables lisibles. Reflète `AchilleaTables` (`@rosegriffon/db/schema`) moins les
 * tables de jetons, plus `audit_log` (lecture seule).
 */
export const TABLES_LISIBLES: ReadonlySet<string> = new Set([
  "clan",
  "clan_member",
  "clan_member_history",
  "clan_invite",
  "clan_application",
  "clan_experience",
  "clan_experience_log",
  "event",
  "tournament_participant",
  "event_managers",
  "event_announcement",
  "tournament_event",
  "lobby",
  "lobby_user",
  "lobby_match",
  "tournament_phase",
  "ruleset",
  "license",
  "interclan_lineup",
  "wallet",
  "transaction",
  "user_elo",
  "season",
  "rank",
  "stat",
  "user",
  "notification",
  "user_notification",
  "blacklist",
  "sanction",
  "player_note",
  "organization",
  "organization_manager",
  "guild",
  "audit_log",
]);

/**
 * Lisibles mais jamais éditables : casserait la chaîne de hachage d'audit, ou
 * contourne la comptabilité (portefeuilles et transactions passent par
 * `/admin/ops/wallets/:id/adjust`, qui journalise).
 */
export const TABLES_PROTEGEES: ReadonlySet<string> = new Set(["audit_log", "wallet", "transaction"]);

/** Colonnes dont la valeur ne sort jamais de l'API et ne s'écrit jamais ici. */
export const COLONNES_SECRETES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["license", new Set(["qr_secret"])],
]);

/** Colonnes lisibles mais non modifiables par l'éditeur générique. */
export const COLONNES_FIGEES: ReadonlyMap<string, ReadonlySet<string>> = new Map([["user", new Set(["role"])]]);

export const VALEUR_MASQUEE = "[masqué]" as const;

/** Plafonds. */
export const LIGNES_PAR_PAGE_MAX = 200;
export const LIGNES_REQUETE_MAX = 500;
export const DELAI_REQUETE_MS = 5_000;
export const LONGUEUR_REQUETE_MAX = 10_000;

export function tableAutorisee(table: string): boolean {
  return TABLES_LISIBLES.has(table);
}

export function tableEditable(table: string): boolean {
  return TABLES_LISIBLES.has(table) && !TABLES_PROTEGEES.has(table);
}

/** Identifiant SQL entre guillemets doubles, guillemets internes doublés. */
export function citerIdent(nom: string): string {
  if (nom.includes("\u0000")) throw new Error("Identifiant SQL invalide");
  return `"${nom.replaceAll('"', '""')}"`;
}

/** `"achillea"."table"` — la table DOIT avoir passé `tableAutorisee`. */
export function citerTable(table: string): string {
  return `${citerIdent(SCHEMA_ACHILLEA)}.${citerIdent(table)}`;
}

export function colonneSecrete(table: string, colonne: string): boolean {
  return COLONNES_SECRETES.get(table)?.has(colonne) ?? false;
}

/** Remplace les valeurs secrètes d'une ligne lue. */
export function masquerLigne(table: string, ligne: Record<string, unknown>): Record<string, unknown> {
  const secretes = COLONNES_SECRETES.get(table);
  if (!secretes) return ligne;
  const copie = { ...ligne };
  for (const colonne of secretes) if (colonne in copie) copie[colonne] = VALEUR_MASQUEE;
  return copie;
}

/**
 * Ne garde que les clés qui sont de vraies colonnes de la table, modifiables
 * par cet outil (ni secrètes, ni figées).
 */
export function valeursEcrivables(
  table: string,
  valeurs: Record<string, unknown> | null | undefined,
  colonnes: readonly string[],
): Record<string, unknown> {
  const connues = new Set(colonnes);
  const figees = COLONNES_FIGEES.get(table);
  const sortie: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(valeurs ?? {})) {
    if (!connues.has(cle) || colonneSecrete(table, cle) || figees?.has(cle)) continue;
    sortie[cle] = valeur;
  }
  return sortie;
}

/** Clé primaire complète, restreinte aux colonnes de clé. `null` si incomplète. */
export function clePrimaire(
  pk: Record<string, unknown> | null | undefined,
  colonnesCle: readonly string[],
): Record<string, unknown> | null {
  if (colonnesCle.length === 0) return null;
  const sortie: Record<string, unknown> = {};
  for (const colonne of colonnesCle) {
    if (!pk || !(colonne in pk) || pk[colonne] === undefined || pk[colonne] === null) return null;
    sortie[colonne] = pk[colonne];
  }
  return sortie;
}

export type VerdictRequete = { ok: true; sql: string } | { ok: false; message: string };

/**
 * Motifs refusés avant même d'interroger Postgres. Le plan est vérifié ensuite
 * (`relationsDuPlan`) ; cette liste couvre ce que le plan ne montre pas :
 * fonctions scalaires d'administration (`pg_terminate_backend` reste permis
 * dans une transaction READ ONLY), accès fichiers, réglages de session.
 */
const MOTIFS_INTERDITS: readonly { motif: RegExp; raison: string }[] = [
  { motif: /\bpg_\w*/i, raison: "les objets et fonctions système (pg_*) sont interdits" },
  { motif: /\binformation_schema\b/i, raison: "information_schema est interdit" },
  { motif: /\b(dblink\w*|lo_\w+|set_config|current_setting)\b/i, raison: "fonction interdite" },
  // Fonctions qui exécutent une requête passée en chaîne : elles contourneraient
  // la vérification du plan.
  { motif: /\b(\w*_to_xml\w*|ts_stat|ts_rewrite)\b/i, raison: "fonction exécutant une sous-requête textuelle" },
  // Appel qualifié `schema.fonction(` : seules les fonctions de `pg_catalog` et
  // `achillea` (chemin de recherche de la transaction) sont atteignables.
  { motif: /\b\w+\s*\.\s*\w+\s*\(/, raison: "appel de fonction qualifié par un schéma" },
  { motif: /\bU&/i, raison: "les identifiants Unicode échappés sont interdits" },
  { motif: /\b(user_connection|oauth_csrf)\b/i, raison: "table de jetons OAuth" },
];

/**
 * Validation syntaxique d'une requête de la console : une seule instruction,
 * commençant par SELECT ou WITH, sans motif interdit. Rend la requête nettoyée
 * (point-virgule final retiré).
 */
export function validerRequeteLecture(brute: unknown): VerdictRequete {
  if (typeof brute !== "string" || !brute.trim()) return { ok: false, message: "Requête vide." };
  if (brute.length > LONGUEUR_REQUETE_MAX)
    return { ok: false, message: `Requête trop longue (${LONGUEUR_REQUETE_MAX} caractères au plus).` };
  const sql = brute.trim().replace(/;+\s*$/, "");
  if (sql.includes(";"))
    return { ok: false, message: "Une seule instruction à la fois (pas de `;` en milieu de requête)." };
  if (sql.includes("\u0000")) return { ok: false, message: "Caractère nul interdit." };
  if (!/^(select|with)\s/i.test(sql))
    return { ok: false, message: "Lecture seule : la requête doit commencer par SELECT ou WITH." };
  // Les guillemets doubles ne doivent pas permettre de masquer un nom interdit.
  const normalisee = sql.replaceAll('"', "");
  for (const { motif, raison } of MOTIFS_INTERDITS) {
    if (motif.test(normalisee)) return { ok: false, message: `Requête refusée : ${raison}.` };
  }
  return { ok: true, sql };
}

/** Enveloppe la requête validée pour plafonner le nombre de lignes. */
export function envelopperAvecLimite(sql: string, limite = LIGNES_REQUETE_MAX): string {
  return `SELECT * FROM (\n${sql}\n) AS console_lecture LIMIT ${Math.max(1, Math.floor(limite))}`;
}

export type RelationPlan = { schema: string | null; relation: string };

/** Relations et fonctions lues par un plan `EXPLAIN (VERBOSE, FORMAT JSON)`. */
export function relationsDuPlan(plan: unknown): { relations: RelationPlan[]; fonctions: RelationPlan[] } {
  const relations: RelationPlan[] = [];
  const fonctions: RelationPlan[] = [];
  const visiter = (noeud: unknown) => {
    if (Array.isArray(noeud)) {
      for (const enfant of noeud) visiter(enfant);
      return;
    }
    if (!noeud || typeof noeud !== "object") return;
    const objet = noeud as Record<string, unknown>;
    const schema = typeof objet.Schema === "string" ? objet.Schema : null;
    if (typeof objet["Relation Name"] === "string") relations.push({ schema, relation: objet["Relation Name"] });
    if (typeof objet["Function Name"] === "string") fonctions.push({ schema, relation: objet["Function Name"] });
    for (const valeur of Object.values(objet)) if (valeur && typeof valeur === "object") visiter(valeur);
  };
  visiter(plan);
  return { relations, fonctions };
}

/** Fonctions renvoyant des ensembles, autorisées dans un FROM. */
const FONCTIONS_ENSEMBLE_AUTORISEES: ReadonlySet<string> = new Set([
  "generate_series",
  "unnest",
  "jsonb_array_elements",
  "jsonb_array_elements_text",
  "json_array_elements",
  "json_array_elements_text",
  "jsonb_each",
  "jsonb_each_text",
  "jsonb_object_keys",
  "regexp_matches",
  "string_to_table",
]);

/** Vérifie qu'un plan ne lit que des tables de la liste blanche, hors table secrète. */
export function verifierPlan(plan: unknown): VerdictRequete | { ok: true } {
  const { relations, fonctions } = relationsDuPlan(plan);
  for (const { schema, relation } of relations) {
    if (schema !== SCHEMA_ACHILLEA || !tableAutorisee(relation) || COLONNES_SECRETES.has(relation))
      return { ok: false, message: `Requête refusée : la relation « ${schema ?? "?"}.${relation} » est hors liste blanche.` };
  }
  for (const { schema, relation } of fonctions) {
    if (schema !== "pg_catalog" || !FONCTIONS_ENSEMBLE_AUTORISEES.has(relation))
      return { ok: false, message: `Requête refusée : la fonction « ${relation} » n'est pas autorisée.` };
  }
  return { ok: true };
}

/**
 * La console SQL libre reste fermée en production, comme dans le legacy, sauf
 * ouverture explicite (`ACHILLEA_ADMIN_SQL_CONSOLE=1`).
 */
export function consoleSqlOuverte(env: Record<string, string | undefined> = process.env): boolean {
  if (env.ACHILLEA_ADMIN_SQL_CONSOLE === "1") return true;
  return env.NODE_ENV !== "production";
}
