/**
 * Adaptateur Discord / CLI → API Achilléa, AU NOM de l'utilisateur.
 *
 * ── LE PRINCIPE ────────────────────────────────────────────────────────────
 * Le bot Achilléa n'écrit pas en base pour le métier. Chaque commande signe un
 * jeton de session Achilléa court (5 min) pour l'identifiant Discord de
 * l'auteur de l'interaction, puis appelle l'API unifiée exactement comme le
 * ferait le site avec le cookie de ce même joueur. Les règles d'autorisation
 * (rôle en base, rôle dans le clan, organisateur d'un tournoi) sont donc
 * celles de l'API, et d'elle seule : un joueur ne peut rien faire sur Discord
 * qu'il ne pourrait faire sur le site, et inversement.
 *
 * ── LA BASE INTERNE ────────────────────────────────────────────────────────
 * `rg-core` sert l'API sur `RG_CORE_PORT` (8810 par défaut) sous le préfixe
 * `/api`, traduit vers `/v1/achillea`. Le bot tourne sur la même machine : il
 * passe par la boucle locale, sans TLS ni CDN. `ACHILLEA_API_INTERNAL_URL`
 * l'emporte (développement, déploiement séparé).
 *
 * ── LES MOTIFS D'ÉCHEC ─────────────────────────────────────────────────────
 * `AchilleaClient` ne lève jamais et rend `HTTP 403 for /clans/kick/…` en cas
 * de refus — exact, mais illisible pour un joueur. Le `fetch` enveloppé ici
 * relit le corps des réponses en erreur (`{ message }`, `{ error }`) pour que
 * le motif de l'API (« Le Président ne peut pas quitter son Clan ») arrive tel
 * quel dans Discord ou dans le terminal.
 */
import {
  AchilleaClient,
  type AchilleaClientFailure,
  type AchilleaClientResult,
  type AchilleaFetch,
} from "@rosegriffon/achillea-client";
import { signAchilleaSessionToken } from "@rosegriffon/auth/achillea-session";

export { AchilleaClient };
export type { AchilleaClientFailure, AchilleaClientResult, AchilleaFetch };

/** Durée de vie d'un jeton délégué : une interaction Discord dure au plus 15 min, un appel CLI quelques secondes. */
export const TTL_JETON_DELEGUE_S = 5 * 60;

/** Port par défaut de `rg-core`, qui sert `/api/*` sur sa boucle locale. */
export const PORT_RG_CORE_DEFAUT = 8810;

export type EnvApiAchillea = Record<string, string | undefined>;

/** Identité Discord pour laquelle on signe : l'auteur de l'interaction. */
export interface IdentiteDiscord {
  id: string;
  username?: string | null;
  avatar?: string | null;
}

/** Configuration manquante : jamais un refus de l'API, toujours une erreur d'exploitation. */
export class ConfigurationApiAchillea extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationApiAchillea";
  }
}

function valeur(env: EnvApiAchillea, cle: string): string | null {
  const brut = (env[cle] ?? "").trim();
  // Un `$VAR` non substitué par le chargeur `.env` vaut absent.
  return brut === "" || brut.startsWith("$") ? null : brut;
}

/** Base de l'API interne, préfixe `/api` compris, sans `/` final. */
export function baseApiAchillea(env: EnvApiAchillea = Bun.env): string {
  const surcharge = valeur(env, "ACHILLEA_API_INTERNAL_URL");
  if (surcharge) return surcharge.replace(/\/+$/u, "");
  const port = Number(valeur(env, "RG_CORE_PORT") ?? PORT_RG_CORE_DEFAUT);
  const portValide = Number.isInteger(port) && port > 0 && port < 65_536 ? port : PORT_RG_CORE_DEFAUT;
  return `http://127.0.0.1:${portValide}/api`;
}

/**
 * Jeton de session Achilléa pour une identité Discord.
 *
 * Lève `ConfigurationApiAchillea` sans `JWT_SECRET_KEY` : sans secret, aucune
 * commande ne peut agir au nom de qui que ce soit, et il vaut mieux le dire
 * que d'envoyer des appels anonymes que l'API refuserait un par un.
 */
export function jetonSessionDiscord(
  identite: IdentiteDiscord,
  env: EnvApiAchillea = Bun.env,
  maintenant = Math.floor(Date.now() / 1000),
  ttlSecondes = TTL_JETON_DELEGUE_S,
): string {
  const secret = valeur(env, "JWT_SECRET_KEY");
  if (!secret) {
    throw new ConfigurationApiAchillea(
      "JWT_SECRET_KEY absent : impossible de signer une session Achilléa. Renseigne-le dans l'environnement du service.",
    );
  }
  if (!/^\d{5,25}$/u.test(identite.id)) {
    throw new ConfigurationApiAchillea(`Identifiant Discord invalide : « ${identite.id} ».`);
  }
  return signAchilleaSessionToken(
    {
      id: identite.id,
      ...(identite.username ? { username: identite.username } : {}),
      ...(identite.avatar ? { avatar: identite.avatar } : {}),
    },
    secret,
    maintenant,
    ttlSecondes,
  );
}

/** Motif lisible extrait d'un corps d'erreur JSON de l'API (`message`, `error`, `erreur`, `detail`). */
export function motifDuCorps(corps: unknown): string | null {
  if (typeof corps === "string") return corps.trim() === "" ? null : corps.trim().slice(0, 500);
  if (!corps || typeof corps !== "object") return null;
  const objet = corps as Record<string, unknown>;
  for (const cle of ["message", "error", "erreur", "detail", "reason"]) {
    const v = objet[cle];
    if (typeof v === "string" && v.trim() !== "") return v.trim().slice(0, 500);
  }
  return null;
}

export interface OptionsClientAchillea {
  /** Environnement lu pour la base et le secret (défaut : `Bun.env`). */
  env?: EnvApiAchillea;
  /** Base explicite (option `--api` de la CLI). */
  baseUrl?: string;
  /** Jeton déjà signé (option `--token` de la CLI). L'emporte sur `identite`. */
  jeton?: string | null;
  /** Identité pour laquelle signer un jeton délégué. */
  identite?: IdentiteDiscord | null;
  /** `fetch` injecté (tests). */
  fetch?: AchilleaFetch;
  /** Délai par requête. 10 s par défaut : un relevé ou une génération d'image peut être lent. */
  timeoutMs?: number;
}

/**
 * Client Achilléa lié à UNE identité, qui retient le motif des refus.
 *
 * Une instance par interaction : les motifs sont indexés par chemin, et deux
 * interactions concurrentes ne partagent jamais leur mémoire d'échecs.
 */
export class ClientAchilleaDelegue extends AchilleaClient {
  /** Identifiant Discord au nom duquel les appels partent (`null` : anonyme ou jeton fourni). */
  readonly utilisateurId: string | null;
  private readonly motifs: Map<string, string>;

  constructor(options: OptionsClientAchillea = {}) {
    const env = options.env ?? Bun.env;
    const base = (options.baseUrl ?? baseApiAchillea(env)).replace(/\/+$/u, "");
    const jeton = options.jeton ?? (options.identite ? jetonSessionDiscord(options.identite, env) : null);
    const motifs = new Map<string, string>();
    const fetchBrut: AchilleaFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

    const fetchLisant: AchilleaFetch = async (entree, init) => {
      const reponse = await fetchBrut(entree, init);
      if (!reponse.ok) {
        const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
        const chemin = url.startsWith(base) ? url.slice(base.length) : url;
        const texte = await reponse
          .clone()
          .text()
          .catch(() => "");
        let corps: unknown = texte;
        try {
          corps = JSON.parse(texte);
        } catch {
          // Corps non JSON : on garde le texte brut.
        }
        const motif = motifDuCorps(corps);
        if (motif) motifs.set(chemin, motif);
      }
      return reponse;
    };

    super({
      baseUrl: base,
      timeoutMs: options.timeoutMs ?? 10_000,
      fetch: fetchLisant,
      ...(jeton ? { getAuthToken: () => jeton } : {}),
      headers: { "User-Agent": "RoseGriffon-Achillea-Delegue/1.0" },
    });
    this.utilisateurId = options.jeton ? null : (options.identite?.id ?? null);
    this.motifs = motifs;
  }

  /** Motif renvoyé par l'API pour cet échec, s'il y en avait un. */
  motifApi(echec: AchilleaClientFailure): string | null {
    return this.motifs.get(echec.path) ?? null;
  }

  /** Phrase française, sans trace d'appel, à montrer à qui a déclenché l'action. */
  motifEchec(echec: AchilleaClientFailure): string {
    return decrireEchec(echec, this.motifApi(echec));
  }
}

/**
 * Traduit un échec du client en une phrase pour un humain.
 *
 * Le motif de l'API, quand il existe, passe en premier : c'est lui qui dit
 * QUOI faire (« Le joueur est déjà dans un clan »). Le statut ne sert qu'à
 * choisir la tournure quand l'API n'a rien dit.
 */
export function decrireEchec(echec: AchilleaClientFailure, motifApi: string | null = null): string {
  switch (echec.kind) {
    case "unreachable": {
      return `L'API Achilléa est injoignable (${echec.detail}). Réessaie dans un instant ; si cela dure, préviens le staff.`;
    }
    case "invalid_json":
    case "invalid_response": {
      return `Réponse inattendue de l'API Achilléa (${echec.detail}).`;
    }
    case "http": {
      const suffixe = motifApi ? ` — ${motifApi}` : "";
      switch (echec.status) {
        case 401: {
          return `Session refusée par l'API${suffixe}. Le secret de signature du bot ne correspond pas à celui de l'API.`;
        }
        case 403: {
          return motifApi ?? "Tu n'as pas les droits nécessaires pour cette action.";
        }
        case 404: {
          return motifApi ?? "Élément introuvable.";
        }
        case 409: {
          return motifApi ?? "Conflit : l'état a changé entre-temps, recharge et réessaie.";
        }
        case 400:
        case 422: {
          return motifApi ? `Demande invalide : ${motifApi}` : "Demande invalide.";
        }
        case 429: {
          return "Trop de demandes d'un coup : patiente quelques secondes.";
        }
        case 503: {
          return motifApi ?? "Service momentanément indisponible (maintenance ou bot hors ligne).";
        }
        default: {
          return `L'API Achilléa a répondu HTTP ${echec.status}${suffixe}.`;
        }
      }
    }
  }
}

/** Vrai si l'échec est un refus de droits (403) — utile pour distinguer « pas le droit » de « en panne ». */
export function estRefus(echec: AchilleaClientFailure): boolean {
  return echec.kind === "http" && (echec.status === 401 || echec.status === 403);
}

/** Fabrique des clients des commandes Discord. Remplaçable en test, jamais ailleurs. */
export type FabriqueClientAchillea = (identite: IdentiteDiscord) => ClientAchilleaDelegue;

const fabriqueParDefaut: FabriqueClientAchillea = identite => new ClientAchilleaDelegue({ identite });
let fabrique: FabriqueClientAchillea = fabriqueParDefaut;

/** Client Achilléa au nom de cet utilisateur Discord. */
export function clientAchilleaPour(identite: IdentiteDiscord): ClientAchilleaDelegue {
  return fabrique(identite);
}

/**
 * Remplace la fabrique (tests). Rend la fonction qui restaure la précédente.
 * Aucune commande n'a à l'appeler.
 */
export function remplacerFabriqueClientAchillea(nouvelle: FabriqueClientAchillea): () => void {
  const precedente = fabrique;
  fabrique = nouvelle;
  return () => {
    fabrique = precedente;
  };
}

/** Identité tirée d'un `User` discord.js (seuls `id`, `username`, `avatar` sont lus). */
export function identiteDe(utilisateur: { id: string; username?: string | null; avatar?: string | null }): IdentiteDiscord {
  return { id: utilisateur.id, username: utilisateur.username ?? null, avatar: utilisateur.avatar ?? null };
}
