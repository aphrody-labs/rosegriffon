// SPDX-License-Identifier: Apache-2.0
// Client X du cron : pilote la CLI native `aphrody x` du fork de Bun (crate `bun_x`) en
// sous-processus. Aucune bibliothèque FFI à installer ; la session reste dans l'environnement du
// processus fils (`X_COOKIE_STRING`), jamais sur la ligne de commande.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { Tweet } from "@aphrody/x";

export type { Tweet };

export interface TweetPage {
  tweets: Tweet[];
  next_cursor?: string;
}

export interface UserInfo {
  id: string;
  name: string;
  screen_name: string;
}

/** Session X par cookies : `auth_token` + `ct0`. */
export class XSession {
  constructor(
    readonly auth_token: string,
    readonly ct0: string,
  ) {}

  static fromCookieString(cookie: string): XSession {
    const valeurs = new Map<string, string>();
    for (const part of cookie.split(";")) {
      const [nom, ...reste] = part.trim().split("=");
      if (nom) valeurs.set(nom, reste.join("="));
    }
    const auth = valeurs.get("auth_token");
    const ct0 = valeurs.get("ct0");
    if (!auth || !ct0) throw new Error("cookies X incomplets : auth_token et ct0 sont requis");
    return new XSession(auth, ct0);
  }

  /** Même ordre que la CLI : `X_COOKIE_STRING`, fichier de session, puis `X_AUTH_TOKEN` + `X_CT0`. */
  static loadOrEnv(): XSession {
    const chaine = process.env.X_COOKIE_STRING;
    if (chaine) return XSession.fromCookieString(chaine);
    const fichier = join(process.env.APHRODY_HOME ?? join(homedir(), ".aphrody"), "x-session.json");
    if (existsSync(fichier)) {
      const brut = JSON.parse(readFileSync(fichier, "utf8")) as { auth_token?: string; ct0?: string };
      if (brut.auth_token && brut.ct0) return new XSession(brut.auth_token, brut.ct0);
    }
    if (process.env.X_AUTH_TOKEN && process.env.X_CT0) return new XSession(process.env.X_AUTH_TOKEN, process.env.X_CT0);
    throw new Error("aucune session X : X_COOKIE_STRING, ~/.aphrody/x-session.json ou X_AUTH_TOKEN + X_CT0");
  }

  cookieHeader(): string {
    return `auth_token=${this.auth_token}; ct0=${this.ct0}`;
  }
}

function binaireAphrody(): string {
  return process.env.APHRODY_BIN || Bun.which("aphrody") || join(homedir(), ".local", "bin", "aphrody");
}

export class XClient {
  /** `userTweets` reçoit un identifiant, la CLI veut un pseudo : on retient la correspondance. */
  private readonly pseudos = new Map<string, string>();

  constructor(private readonly session: XSession = XSession.loadOrEnv()) {}

  private async lancer<T>(args: string[]): Promise<T> {
    const proc = Bun.spawn([binaireAphrody(), "x", ...args], {
      env: { ...process.env, X_COOKIE_STRING: this.session.cookieHeader() },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [sortie, erreur, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) {
      throw new Error(`aphrody x ${args[0]} : ${(erreur || sortie).trim().split("\n").slice(-3).join(" ").slice(0, 300)}`);
    }
    return JSON.parse(sortie) as T;
  }

  async userByScreenName(pseudo: string): Promise<UserInfo> {
    const nettoye = pseudo.replace(/^@/, "");
    const utilisateur = await this.lancer<UserInfo>(["user", nettoye]);
    this.pseudos.set(utilisateur.id, nettoye);
    return utilisateur;
  }

  userTweets(idUtilisateur: string, nombre: number, curseur?: string): Promise<TweetPage> {
    const pseudo = this.pseudos.get(idUtilisateur);
    if (!pseudo) throw new Error(`userTweets : pseudo inconnu pour ${idUtilisateur}, appeler userByScreenName d'abord`);
    return this.lancer<TweetPage>(["user-tweets", pseudo, "-n", String(nombre), ...(curseur ? ["--cursor", curseur] : [])]);
  }

  async getTweet(id: string): Promise<Tweet | null> {
    try {
      return await this.lancer<Tweet>(["read", id]);
    } catch {
      return null;
    }
  }

  thread(id: string, curseur?: string): Promise<TweetPage> {
    return this.lancer<TweetPage>(["thread", id, "--quote-depth", "1", ...(curseur ? ["--cursor", curseur] : [])]);
  }

  search(requete: string, nombre: number, curseur?: string, produit = "Latest"): Promise<TweetPage> {
    return this.lancer<TweetPage>([
      "search",
      requete,
      "-n",
      String(nombre),
      ...(produit === "Top" ? ["--top"] : []),
      ...(curseur ? ["--cursor", curseur] : []),
    ]);
  }

  /** Opération GraphQL du catalogue ; la CLI attend d'elle-même les limites souples (`--wait`). */
  graphqlWaiting(operation: string, variables: unknown): Promise<unknown> {
    return this.lancer<unknown>(["graphql", operation, "--vars-json", JSON.stringify(variables ?? {}), "--wait"]);
  }
}
