// SPDX-License-Identifier: Apache-2.0
/**
 * `rosegriffon achillea` — l'API Achilléa en ligne de commande, sans navigateur.
 *
 * Dispatcher GÉNÉRIQUE sur `AchilleaClient` : chaque méthode du client typé
 * (`clans.kickMember`, `ranked.adminSeasons`, …) est appelable telle quelle,
 * avec ses arguments en JSON. Rien n'est recopié ici : une méthode ajoutée au
 * client est disponible en CLI le jour même, et `achillea list` l'affiche avec
 * sa ligne de JSDoc.
 *
 *   rosegriffon achillea list [filtre]
 *   rosegriffon achillea <ressource>.<méthode> [arg JSON]...
 *   rosegriffon achillea raw <METHOD> <chemin> [corps JSON]
 *
 * Identité : `--as <discordId>` signe une session de 5 min avec
 * `JWT_SECRET_KEY` (mêmes droits que ce joueur sur le site), `--token <jeton>`
 * envoie un jeton existant, sinon l'appel part anonyme. `--api <url>` choisit
 * la base (défaut : `ACHILLEA_API_INTERNAL_URL`, sinon la boucle locale de
 * rg-core). Sortie JSON sur stdout ; code 0 si `ok`, 1 si l'API a refusé ou
 * échoué, 2 pour une erreur d'usage.
 */
import { ClientAchilleaDelegue, ConfigurationApiAchillea, type AchilleaFetch } from "@rosegriffon/bot/achillea-api";

export const CODE_OK = 0;
export const CODE_ECHEC_API = 1;
export const CODE_USAGE = 2;

export const AIDE_ACHILLEA = `Usage: rosegriffon achillea [options] <commande>

Commandes :
  list [filtre]                         ressources et méthodes du client, avec leur doc
  <ressource>.<méthode> [arg JSON]...   appelle la méthode (ex. clans.get 42, users.get 1234567890123)
  raw <METHOD> <chemin> [corps JSON]    requête brute (ex. raw GET /admin/ops/health)

Options :
  --as <discordId>    agit au nom de ce joueur (session signée 5 min avec JWT_SECRET_KEY)
  --token <jeton>     jeton de session Achilléa déjà signé
  --api <url>         base de l'API (défaut ACHILLEA_API_INTERNAL_URL, sinon http://127.0.0.1:$RG_CORE_PORT/api)
  --out <fichier>     écrit une réponse binaire (PNG, PDF) dans ce fichier
  --timeout <ms>      délai par requête (défaut 10000)

Arguments : chaque argument est lu en JSON quand c'est possible ({…}, […], "…", true,
false, null, petits nombres) ; sinon il est passé tel quel en texte. Les identifiants
Discord (17 à 20 chiffres) restent du texte.
Codes de sortie : 0 succès, 1 échec renvoyé par l'API, 2 erreur d'usage.`;

export interface OptionsAchillea {
  as: string | null;
  token: string | null;
  api: string | null;
  out: string | null;
  timeoutMs: number | null;
  positionnels: string[];
}

export class ErreurUsage extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurUsage";
  }
}

const OPTIONS_A_VALEUR = new Set(["--as", "--token", "--api", "--out", "--timeout"]);

/** Analyse la ligne de commande (`--opt valeur`, `--opt=valeur`, `--` termine les options). */
export function analyserArguments(argv: readonly string[]): OptionsAchillea {
  const options: OptionsAchillea = { as: null, token: null, api: null, out: null, timeoutMs: null, positionnels: [] };
  let finOptions = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (finOptions || !arg.startsWith("--")) {
      options.positionnels.push(arg);
      continue;
    }
    if (arg === "--") {
      finOptions = true;
      continue;
    }
    const egal = arg.indexOf("=");
    const nom = egal >= 0 ? arg.slice(0, egal) : arg;
    if (!OPTIONS_A_VALEUR.has(nom)) throw new ErreurUsage(`Option inconnue : ${nom}`);
    const valeur = egal >= 0 ? arg.slice(egal + 1) : argv[++i];
    if (valeur === undefined || valeur === "") throw new ErreurUsage(`L'option ${nom} attend une valeur.`);
    switch (nom) {
      case "--as": {
        if (!/^\d{5,25}$/u.test(valeur)) throw new ErreurUsage(`--as attend un identifiant Discord, reçu « ${valeur} ».`);
        options.as = valeur;
        break;
      }
      case "--token": {
        options.token = valeur;
        break;
      }
      case "--api": {
        try {
          new URL(valeur);
        } catch {
          throw new ErreurUsage(`--api attend une URL absolue, reçu « ${valeur} ».`);
        }
        options.api = valeur;
        break;
      }
      case "--out": {
        options.out = valeur;
        break;
      }
      case "--timeout": {
        const ms = Number(valeur);
        if (!Number.isInteger(ms) || ms <= 0) throw new ErreurUsage(`--timeout attend un entier positif (ms).`);
        options.timeoutMs = ms;
        break;
      }
    }
  }
  if (options.as && options.token) throw new ErreurUsage("--as et --token sont exclusifs : choisis une seule identité.");
  return options;
}

/**
 * Lit un argument : JSON quand c'est sûr, texte sinon.
 *
 * Un identifiant Discord (`123456789012345678`) passé en JSON deviendrait un
 * nombre arrondi à 2^53 — l'appel viserait un AUTRE joueur. Les nombres de
 * plus de 15 chiffres restent donc du texte.
 */
export function lireArgument(brut: string): unknown {
  const texte = brut.trim();
  if (/^-?\d+(\.\d+)?$/u.test(texte)) {
    return texte.replace(/^-/u, "").replace(".", "").length <= 15 ? Number(texte) : texte;
  }
  if (/^[[{"]/u.test(texte) || texte === "true" || texte === "false" || texte === "null") {
    try {
      return JSON.parse(texte);
    } catch {
      throw new ErreurUsage(`Argument JSON invalide : ${brut}`);
    }
  }
  return brut;
}

type Ressource = Record<string, unknown>;

/**
 * Ressources du client : chaque propriété qui porte elle-même le transport
 * (`AchilleaResource.http`). Le transport et l'état interne (mémoire des motifs
 * d'échec du client délégué) en sont exclus.
 */
export function ressourcesDe(client: object): Map<string, Ressource> {
  const ressources = new Map<string, Ressource>();
  for (const [nom, valeur] of Object.entries(client)) {
    if (nom === "http" || !valeur || typeof valeur !== "object" || !("http" in valeur)) continue;
    ressources.set(nom, valeur as Ressource);
  }
  return new Map([...ressources.entries()].toSorted(([a], [b]) => a.localeCompare(b)));
}

/** Méthodes publiques d'une ressource, dans l'ordre alphabétique. */
export function methodesDe(ressource: Ressource): string[] {
  const methodes = new Set<string>();
  let proto = Object.getPrototypeOf(ressource) as object | null;
  while (proto && proto !== Object.prototype) {
    for (const nom of Object.getOwnPropertyNames(proto)) {
      if (nom === "constructor" || nom.startsWith("_")) continue;
      const descripteur = Object.getOwnPropertyDescriptor(proto, nom);
      if (descripteur && typeof descripteur.value === "function") methodes.add(nom);
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return [...methodes].toSorted();
}

/** Nombre de paramètres déclarés (indication pour `list`). */
function arite(ressource: Ressource, methode: string): number {
  const fn = ressource[methode];
  return typeof fn === "function" ? fn.length : 0;
}

export type Resolution =
  | { ok: true; ressource: string; methode: string; fn: (...args: unknown[]) => unknown; cible: Ressource }
  | { ok: false; message: string };

/** `clans.kickMember` → fonction liée, ou message d'erreur avec suggestions. */
export function resoudreMethode(client: object, nomComplet: string): Resolution {
  const [nomRessource, nomMethode, ...reste] = nomComplet.split(".");
  const ressources = ressourcesDe(client);
  if (!nomRessource || !nomMethode || reste.length > 0) {
    return { ok: false, message: `Commande attendue sous la forme <ressource>.<méthode>, reçu « ${nomComplet} ».` };
  }
  const ressource = ressources.get(nomRessource);
  if (!ressource) {
    const proches = [...ressources.keys()].filter(n => n.toLowerCase().includes(nomRessource.toLowerCase().slice(0, 3)));
    return {
      ok: false,
      message:
        `Ressource inconnue : ${nomRessource}.` +
        (proches.length > 0 ? ` Voulais-tu : ${proches.join(", ")} ?` : ` Ressources : ${[...ressources.keys()].join(", ")}.`),
    };
  }
  const methodes = methodesDe(ressource);
  if (!methodes.includes(nomMethode)) {
    const proches = methodes.filter(m => m.toLowerCase().includes(nomMethode.toLowerCase()));
    return {
      ok: false,
      message:
        `Méthode inconnue : ${nomRessource}.${nomMethode}.` +
        ` ${proches.length > 0 ? "Voulais-tu" : "Méthodes"} : ${(proches.length > 0 ? proches : methodes).join(", ")}.`,
    };
  }
  const fn = ressource[nomMethode] as (...args: unknown[]) => unknown;
  return { ok: true, ressource: nomRessource, methode: nomMethode, fn: fn.bind(ressource), cible: ressource };
}

/** Lignes de `list`, filtrées par sous-chaîne (`list clans`, `list season`). */
export function listerMethodes(client: object, docs: Record<string, string>, filtre = ""): string[] {
  const lignes: string[] = [];
  const motif = filtre.toLowerCase();
  for (const [nom, ressource] of ressourcesDe(client)) {
    const methodes = methodesDe(ressource).filter(m => `${nom}.${m}`.toLowerCase().includes(motif));
    if (methodes.length === 0) continue;
    lignes.push(`${nom}`);
    for (const methode of methodes) {
      const doc = docs[`${nom}.${methode}`];
      const signature = `  ${nom}.${methode}(${arite(ressource, methode)})`;
      lignes.push(doc ? `${signature.padEnd(46)} ${doc}` : signature);
    }
  }
  return lignes;
}

export interface DependancesAchillea {
  env: Record<string, string | undefined>;
  fetch?: AchilleaFetch;
  docs: Record<string, string>;
  sortie: (texte: string) => void;
  erreur: (texte: string) => void;
  ecrireFichier: (chemin: string, octets: ArrayBuffer) => Promise<void>;
}

/** Sérialise une valeur de résultat (les `Date` en ISO, les binaires en résumé). */
function enJson(valeur: unknown): string {
  return JSON.stringify(
    valeur,
    (_cle, v) => (v instanceof ArrayBuffer ? { octets: v.byteLength } : typeof v === "bigint" ? v.toString() : v),
    2,
  );
}

function estResultat(valeur: unknown): valeur is { ok: boolean; value?: unknown } {
  return Boolean(valeur) && typeof valeur === "object" && typeof (valeur as { ok?: unknown }).ok === "boolean";
}

function construireClient(options: OptionsAchillea, deps: DependancesAchillea): ClientAchilleaDelegue {
  return new ClientAchilleaDelegue({
    env: deps.env,
    ...(options.api ? { baseUrl: options.api } : {}),
    ...(options.token ? { jeton: options.token } : {}),
    ...(options.as ? { identite: { id: options.as } } : {}),
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  });
}

const METHODES_HTTP = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

async function executerBrut(client: ClientAchilleaDelegue, args: string[], options: OptionsAchillea, deps: DependancesAchillea) {
  const [methodeBrute, chemin, corpsBrut, ...reste] = args;
  const methode = (methodeBrute ?? "").toUpperCase();
  if (!METHODES_HTTP.has(methode) || !chemin || reste.length > 0) {
    throw new ErreurUsage("raw attend : raw <GET|POST|PUT|PATCH|DELETE> <chemin> [corps JSON]");
  }
  const cheminNormalise = chemin.startsWith("/") ? chemin : `/${chemin}`;
  const corps = corpsBrut === undefined ? undefined : lireArgument(corpsBrut);
  const reponse = await client.http.request(cheminNormalise, {
    method: methode as "GET",
    ...(corps === undefined ? {} : { body: corps }),
    accept: "application/json, text/plain, */*",
  });
  if (!reponse.ok) {
    deps.sortie(enJson({ ...reponse, motif: client.motifEchec(reponse) }));
    return CODE_ECHEC_API;
  }
  const type = reponse.value.headers.get("content-type") ?? "";
  if (type.includes("json")) {
    deps.sortie(enJson({ ok: true, value: await reponse.value.json() }));
  } else if (type.startsWith("text/") || type === "") {
    deps.sortie(enJson({ ok: true, value: await reponse.value.text() }));
  } else {
    const octets = await reponse.value.arrayBuffer();
    if (options.out) await deps.ecrireFichier(options.out, octets);
    deps.sortie(enJson({ ok: true, value: { octets: octets.byteLength, type, fichier: options.out } }));
  }
  return CODE_OK;
}

/** Point d'entrée testable : rend le code de sortie, n'appelle jamais `process.exit`. */
export async function executerAchillea(argv: readonly string[], deps: DependancesAchillea): Promise<number> {
  if (argv.includes("-h") || argv.includes("--help")) {
    deps.sortie(AIDE_ACHILLEA);
    return CODE_OK;
  }
  let options: OptionsAchillea;
  try {
    options = analyserArguments(argv);
  } catch (err) {
    deps.erreur(`${(err as Error).message}\n\n${AIDE_ACHILLEA}`);
    return CODE_USAGE;
  }
  const [commande, ...args] = options.positionnels;
  if (!commande || commande === "help" || commande === "aide") {
    deps.sortie(AIDE_ACHILLEA);
    return commande ? CODE_OK : CODE_USAGE;
  }

  let client: ClientAchilleaDelegue;
  try {
    client = construireClient(options, deps);
  } catch (err) {
    if (err instanceof ConfigurationApiAchillea) {
      deps.erreur(err.message);
      return CODE_USAGE;
    }
    throw err;
  }

  try {
    if (commande === "list") {
      deps.sortie(listerMethodes(client, deps.docs, args.join(" ")).join("\n"));
      return CODE_OK;
    }
    if (commande === "raw") return await executerBrut(client, args, options, deps);

    const resolution = resoudreMethode(client, commande);
    if (!resolution.ok) {
      deps.erreur(resolution.message);
      return CODE_USAGE;
    }
    const valeurs = args.map(lireArgument);
    const resultat = await resolution.fn(...valeurs);
    if (!estResultat(resultat)) {
      // Méthodes de construction d'URL (`users.cardUrl`, `auth.discordLoginUrl`) : pas d'appel réseau.
      deps.sortie(enJson({ ok: true, value: resultat }));
      return CODE_OK;
    }
    if (!resultat.ok) {
      const echec = resultat as Parameters<ClientAchilleaDelegue["motifEchec"]>[0];
      deps.sortie(enJson({ ...echec, motif: client.motifEchec(echec) }));
      return CODE_ECHEC_API;
    }
    if (resultat.value instanceof ArrayBuffer && options.out) {
      await deps.ecrireFichier(options.out, resultat.value);
      deps.sortie(enJson({ ok: true, value: { octets: resultat.value.byteLength, fichier: options.out } }));
      return CODE_OK;
    }
    deps.sortie(enJson(resultat));
    return CODE_OK;
  } catch (err) {
    if (err instanceof ErreurUsage) {
      deps.erreur(err.message);
      return CODE_USAGE;
    }
    throw err;
  }
}
