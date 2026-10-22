/**
 * Banc d'essai des commandes du profil Achilléa.
 *
 * Deux doublures, et rien d'autre :
 *
 *  - `installerApi(routes)` remplace la fabrique de `lib/achillea-api.ts` par
 *    un VRAI `ClientAchilleaDelegue` dont seul le `fetch` est simulé. Le
 *    chemin complet (signature du jeton, sérialisation, validation zod des
 *    réponses, lecture des motifs d'erreur) est donc exercé ; seul le réseau
 *    manque. Chaque appel est consigné (méthode, chemin, corps, porteur).
 *  - `fausseInteraction(...)` imite l'interface discord.js qu'utilisent les
 *    commandes (`deferReply`, `editReply`, `reply`, `followUp`, `update`,
 *    `deferUpdate`, `showModal`, `options`, `fields`) et consigne les charges.
 */
import {
  ClientAchilleaDelegue,
  remplacerFabriqueClientAchillea,
  type AchilleaFetch,
} from "../src/lib/achillea-api";

export const BASE_API_TEST = "http://api.test/api";
export const SECRET_TEST = "secret-de-test-achillea";

export interface AppelApi {
  methode: string;
  chemin: string;
  corps: unknown;
  porteur: string | null;
}

export interface RequeteSimulee {
  methode: string;
  chemin: string;
  url: URL;
  corps: unknown;
}

/** Réponse d'une route : un objet (200 JSON), `[statut, corps]`, ou une `Response`. */
export type ReponseSimulee = unknown;
export type Gestionnaire = (requete: RequeteSimulee) => ReponseSimulee | Promise<ReponseSimulee>;

/** `routes` : `"GET /clans/role"` → gestionnaire ou valeur. Le chemin s'entend SANS query-string. */
export function routeurApi(routes: Record<string, Gestionnaire | ReponseSimulee>, appels: AppelApi[] = []): AchilleaFetch {
  return async (entree, init) => {
    const brut = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    const url = new URL(brut);
    const methode = (init?.method ?? "GET").toUpperCase();
    const chemin = url.pathname.replace(/^\/api/u, "");
    let corps: unknown;
    if (typeof init?.body === "string") {
      try {
        corps = JSON.parse(init.body);
      } catch {
        corps = init.body;
      }
    }
    const entetes = new Headers(init?.headers as Record<string, string> | undefined);
    appels.push({ methode, chemin, corps, porteur: entetes.get("authorization") });

    const cle = `${methode} ${chemin}`;
    const route = routes[cle] ?? Object.entries(routes).find(([motif]) => correspond(motif, cle))?.[1];
    if (route === undefined) {
      return Response.json({ message: `Route non simulée : ${cle}` }, { status: 404 });
    }
    const valeur = typeof route === "function" ? await (route as Gestionnaire)({ methode, chemin, url, corps }) : route;
    if (valeur instanceof Response) return valeur;
    if (Array.isArray(valeur) && valeur.length === 2 && typeof valeur[0] === "number") {
      return Response.json(valeur[1], { status: valeur[0] });
    }
    return Response.json(valeur ?? {});
  };
}

/** `GET /clans/:id` correspond à `GET /clans/42`. */
function correspond(motif: string, cle: string): boolean {
  if (!motif.includes(":")) return false;
  const expression = new RegExp(`^${motif.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/:[A-Za-z]+/gu, "[^/]+")}$`, "u");
  return expression.test(cle);
}

/**
 * Remplace la fabrique des clients Achilléa le temps d'un test.
 * À appeler dans `beforeEach`, avec `restaurer()` dans `afterEach`.
 */
export function installerApi(routes: Record<string, Gestionnaire | ReponseSimulee>): {
  appels: AppelApi[];
  restaurer: () => void;
} {
  const appels: AppelApi[] = [];
  const fetch = routeurApi(routes, appels);
  const restaurer = remplacerFabriqueClientAchillea(
    identite =>
      new ClientAchilleaDelegue({ identite, fetch, baseUrl: BASE_API_TEST, env: { JWT_SECRET_KEY: SECRET_TEST } }),
  );
  return { appels, restaurer };
}

/** Charge envoyée à Discord, telle que la commande l'a construite. */
export interface ChargeEnvoyee {
  via: "reply" | "editReply" | "followUp" | "update" | "showModal" | "deferReply" | "deferUpdate";
  charge: unknown;
}

export interface OptionsInteraction {
  utilisateur?: { id: string; username?: string; avatar?: string | null; bot?: boolean; displayName?: string };
  guildId?: string | null;
  customId?: string;
  valeurs?: string[];
  champs?: Record<string, string>;
  /** Permissions du membre : `true` = administrateur du serveur. */
  administrateur?: boolean;
  options?: Record<string, unknown>;
  sousCommande?: string;
  groupe?: string | null;
  commande?: string;
  guilde?: unknown;
  client?: unknown;
}

export interface InteractionSimulee {
  envois: ChargeEnvoyee[];
  /** Texte concaténé de toutes les charges (titres, descriptions, champs, contenus). */
  texte(): string;
  [cle: string]: unknown;
}

/** Texte lisible d'une charge (embeds compris), pour les assertions. */
export function texteDe(charge: unknown): string {
  return JSON.stringify(charge, (_cle, valeur) =>
    valeur && typeof valeur === "object" && "toJSON" in valeur && typeof valeur.toJSON === "function"
      ? valeur.toJSON()
      : valeur,
  );
}

export function fausseInteraction(options: OptionsInteraction = {}): InteractionSimulee & Record<string, any> {
  const utilisateur = {
    id: options.utilisateur?.id ?? "111111111111111111",
    username: options.utilisateur?.username ?? "joueur",
    displayName: options.utilisateur?.displayName ?? options.utilisateur?.username ?? "joueur",
    avatar: options.utilisateur?.avatar ?? null,
    bot: options.utilisateur?.bot ?? false,
    toString() {
      return `<@${this.id}>`;
    },
  };
  const envois: ChargeEnvoyee[] = [];
  const valeursOptions = options.options ?? {};
  const interaction: Record<string, any> = {
    id: "999999999999999999",
    user: utilisateur,
    guildId: options.guildId === undefined ? "1055585286320554055" : options.guildId,
    guild: options.guilde ?? null,
    client: options.client ?? { user: { id: "222222222222222222" } },
    commandName: options.commande ?? "commande",
    customId: options.customId ?? "",
    values: options.valeurs ?? [],
    createdTimestamp: Date.now(),
    deferred: false,
    replied: false,
    member: {
      permissions: {
        has: () => options.administrateur === true,
      },
    },
    message: { interactionMetadata: { user: { id: utilisateur.id } }, edit: async () => undefined },
    options: {
      getSubcommand: () => options.sousCommande ?? null,
      getSubcommandGroup: () => options.groupe ?? null,
      getString: (nom: string) => (valeursOptions[nom] as string | undefined) ?? null,
      getInteger: (nom: string) => (valeursOptions[nom] as number | undefined) ?? null,
      getNumber: (nom: string) => (valeursOptions[nom] as number | undefined) ?? null,
      getBoolean: (nom: string) => (valeursOptions[nom] as boolean | undefined) ?? null,
      getUser: (nom: string) => (valeursOptions[nom] as unknown) ?? null,
      getFocused: () => (valeursOptions.focused as string | undefined) ?? "",
    },
    fields: {
      getTextInputValue: (nom: string) => options.champs?.[nom] ?? "",
    },
    isRepliable: () => true,
    inGuild: () => interaction.guildId !== null,
    isButton: () => true,
    isStringSelectMenu: () => (options.valeurs?.length ?? 0) > 0,
    async deferReply(charge?: unknown) {
      interaction.deferred = true;
      envois.push({ via: "deferReply", charge });
    },
    async deferUpdate(charge?: unknown) {
      interaction.deferred = true;
      envois.push({ via: "deferUpdate", charge });
    },
    async reply(charge: unknown) {
      interaction.replied = true;
      envois.push({ via: "reply", charge });
      return { id: "1", createMessageComponentCollector: () => ({ on: () => undefined }) };
    },
    async editReply(charge: unknown) {
      envois.push({ via: "editReply", charge });
      return { id: "1" };
    },
    async followUp(charge: unknown) {
      envois.push({ via: "followUp", charge });
      return { id: "2" };
    },
    async update(charge: unknown) {
      interaction.replied = true;
      envois.push({ via: "update", charge });
    },
    async showModal(charge: unknown) {
      interaction.replied = true;
      envois.push({ via: "showModal", charge });
    },
    async respond(charge: unknown) {
      envois.push({ via: "reply", charge });
    },
    async deleteReply() {
      envois.push({ via: "editReply", charge: { supprime: true } });
    },
  };
  interaction.envois = envois;
  interaction.texte = () => envois.map(envoi => texteDe(envoi.charge)).join("\n");
  return interaction as InteractionSimulee & Record<string, any>;
}
