// SPDX-License-Identifier: Apache-2.0
/**
 * Tests du dispatcher `rosegriffon achillea` — sans réseau : `fetch` simulé.
 */
import { describe, expect, test } from "bun:test";
import { verifyAchilleaSessionToken } from "@rosegriffon/achillea-core/auth";
import { AchilleaClient, ClientAchilleaDelegue } from "@rosegriffon/bot/achillea-api";

import {
  analyserArguments,
  CODE_ECHEC_API,
  CODE_OK,
  CODE_USAGE,
  ErreurUsage,
  executerAchillea,
  lireArgument,
  listerMethodes,
  methodesDe,
  resoudreMethode,
  ressourcesDe,
  type DependancesAchillea,
} from "./achillea";
import { docsClientAchillea, docsDuSource, proprietesDuClient } from "./achillea-docs";

const SECRET = "secret-cli-test";

interface Appel {
  methode: string;
  url: string;
  corps: unknown;
  porteur: string | null;
}

function banc(reponses: Record<string, () => Response>) {
  const appels: Appel[] = [];
  const sorties: string[] = [];
  const erreurs: string[] = [];
  const fichiers: Record<string, number> = {};
  const deps: DependancesAchillea = {
    env: { JWT_SECRET_KEY: SECRET, ACHILLEA_API_INTERNAL_URL: "http://api.test/api" },
    docs: { "clans.get": "`GET /clans/:id` — fiche publique d'un clan." },
    fetch: async (entree, init) => {
      const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
      const methode = init?.method ?? "GET";
      const entetes = new Headers(init?.headers as Record<string, string>);
      appels.push({
        methode,
        url,
        corps: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
        porteur: entetes.get("authorization"),
      });
      const chemin = new URL(url).pathname.replace(/^\/api/u, "");
      const fabrique = reponses[`${methode} ${chemin}`];
      return fabrique ? fabrique() : Response.json({ message: "absent" }, { status: 404 });
    },
    sortie: texte => sorties.push(texte),
    erreur: texte => erreurs.push(texte),
    ecrireFichier: async (chemin, octets) => {
      fichiers[chemin] = octets.byteLength;
    },
  };
  return { deps, appels, sorties, erreurs, fichiers };
}

describe("analyserArguments", () => {
  test("options avant, après, avec =, et -- final", () => {
    const o = analyserArguments(["--as", "123456789012345678", "clans.get", "--api=http://x/api", "42", "--", "--brut"]);
    expect(o.as).toBe("123456789012345678");
    expect(o.api).toBe("http://x/api");
    expect(o.positionnels).toEqual(["clans.get", "42", "--brut"]);
  });

  test("erreurs d'usage explicites", () => {
    expect(() => analyserArguments(["--inconnue"])).toThrow(ErreurUsage);
    expect(() => analyserArguments(["--as"])).toThrow(/attend une valeur/);
    expect(() => analyserArguments(["--as", "akira"])).toThrow(/identifiant Discord/);
    expect(() => analyserArguments(["--api", "pas-une-url"])).toThrow(/URL absolue/);
    expect(() => analyserArguments(["--timeout", "-3"])).toThrow(/entier positif/);
    expect(() => analyserArguments(["--as", "123456789012345678", "--token", "t"])).toThrow(/exclusifs/);
  });
});

describe("lireArgument", () => {
  test("JSON quand c'est sûr", () => {
    expect(lireArgument("42")).toBe(42);
    expect(lireArgument('{"a":1}')).toEqual({ a: 1 });
    expect(lireArgument("[1,2]")).toEqual([1, 2]);
    expect(lireArgument('"42"')).toBe("42");
    expect(lireArgument("true")).toBe(true);
  });

  test("un identifiant Discord reste du texte, jamais un nombre arrondi", () => {
    expect(lireArgument("123456789012345678")).toBe("123456789012345678");
  });

  test("texte libre passé tel quel ; JSON cassé refusé", () => {
    expect(lireArgument("absence répétée")).toBe("absence répétée");
    expect(() => lireArgument("{cassé")).toThrow(ErreurUsage);
  });
});

describe("résolution des méthodes", () => {
  const client = new AchilleaClient({ baseUrl: "http://api.test/api" });

  test("ressources sans le transport ni l'état interne, méthodes du prototype", () => {
    const delegue = new ClientAchilleaDelegue({ jeton: "x", baseUrl: "http://api.test/api" });
    expect(ressourcesDe(delegue).has("motifs")).toBe(false);
    const ressources = ressourcesDe(client);
    expect(ressources.has("http")).toBe(false);
    expect([...ressources.keys()]).toContain("clans");
    expect([...ressources.keys()]).toContain("interclans");
    const clans = ressources.get("clans");
    expect(clans && methodesDe(clans)).toContain("kickMember");
  });

  test("ressource ou méthode inconnue : suggestions", () => {
    const r1 = resoudreMethode(client, "clan.get");
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.message).toContain("clans");
    const r2 = resoudreMethode(client, "clans.kick");
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.message).toContain("kickMember");
    expect(resoudreMethode(client, "clans").ok).toBe(false);
  });

  test("list affiche la doc quand elle existe", () => {
    const lignes = listerMethodes(client, { "clans.get": "`GET /clans/:id` — fiche" }, "clans.get");
    expect(lignes[0]).toBe("clans");
    expect(lignes.some(l => l.includes("clans.get(1)") && l.includes("`GET /clans/:id`"))).toBe(true);
  });
});

describe("executerAchillea", () => {
  test("appel nominal : JSON sur stdout, code 0, anonyme sans --as", async () => {
    const b = banc({ "GET /clans/role": () => Response.json({ role: 2 }) });
    expect(await executerAchillea(["clans.myRole"], b.deps)).toBe(CODE_OK);
    expect(JSON.parse(b.sorties[0]!)).toEqual({ ok: true, value: { role: 2 } });
    expect(b.appels[0]?.porteur).toBeNull();
    expect(b.appels[0]?.url).toBe("http://api.test/api/clans/role");
  });

  test("--as signe une session de 5 min pour ce joueur", async () => {
    const b = banc({ "GET /clans/role": () => Response.json({ role: 0 }) });
    await executerAchillea(["--as", "123456789012345678", "clans.myRole"], b.deps);
    const jeton = b.appels[0]?.porteur?.replace("Bearer ", "") ?? "";
    const claims = await verifyAchilleaSessionToken(jeton, SECRET);
    expect(claims?.id).toBe("123456789012345678");
    expect((claims?.expiresAt ?? 0) - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(300);
  });

  test("arguments JSON transmis à la méthode (corps POST)", async () => {
    const b = banc({ "POST /clans/kick/123456789012345678": () => Response.json({ success: true }) });
    const code = await executerAchillea(
      ["--token", "jeton", "clans.kickMember", "123456789012345678", "absence répétée"],
      b.deps,
    );
    expect(code).toBe(CODE_OK);
    expect(b.appels[0]?.corps).toEqual({ reason: "absence répétée" });
    expect(b.appels[0]?.porteur).toBe("Bearer jeton");
  });

  test("ok:false → code 1, avec le motif de l'API", async () => {
    const b = banc({ "POST /clans/kick/42": () => Response.json({ message: "Président requis" }, { status: 403 }) });
    expect(await executerAchillea(["clans.kickMember", '"42"', "x"], b.deps)).toBe(CODE_ECHEC_API);
    const sortie = JSON.parse(b.sorties[0]!);
    expect(sortie.ok).toBe(false);
    expect(sortie.status).toBe(403);
    expect(sortie.motif).toBe("Président requis");
  });

  test("erreurs d'usage → code 2 sur stderr", async () => {
    const b = banc({});
    expect(await executerAchillea(["clans.inexistante"], b.deps)).toBe(CODE_USAGE);
    expect(await executerAchillea(["--bizarre"], b.deps)).toBe(CODE_USAGE);
    expect(await executerAchillea([], b.deps)).toBe(CODE_USAGE);
    expect(await executerAchillea(["raw", "FETCH", "/x"], b.deps)).toBe(CODE_USAGE);
    expect(b.erreurs.length).toBe(3);
  });

  test("--as sans JWT_SECRET_KEY : erreur de configuration, code 2", async () => {
    const b = banc({});
    b.deps.env = {};
    expect(await executerAchillea(["--as", "123456789012345678", "clans.myRole"], b.deps)).toBe(CODE_USAGE);
    expect(b.erreurs[0]).toContain("JWT_SECRET_KEY");
  });

  test("méthode sans réseau (URL) rendue telle quelle", async () => {
    const b = banc({});
    expect(await executerAchillea(["users.cardUrl", "123456789012345678"], b.deps)).toBe(CODE_OK);
    expect(JSON.parse(b.sorties[0]!).value).toBe("http://api.test/api/users/123456789012345678/card.png");
    expect(b.appels).toHaveLength(0);
  });

  test("binaire écrit dans --out", async () => {
    const b = banc({ "GET /users/123456789012345678/card.png": () => new Response(new Uint8Array([1, 2, 3])) });
    expect(await executerAchillea(["--out", "carte.png", "users.card", "123456789012345678"], b.deps)).toBe(CODE_OK);
    expect(b.fichiers["carte.png"]).toBe(3);
  });

  test("raw : méthode, chemin, corps ; code selon le statut", async () => {
    const b = banc({
      "POST /admin/ops/maintenance": () => Response.json({ maintenance: true }),
      "GET /admin/ops/health": () => Response.json({ message: "Administrateur requis" }, { status: 403 }),
    });
    expect(await executerAchillea(["raw", "post", "admin/ops/maintenance", '{"maintenance":true}'], b.deps)).toBe(CODE_OK);
    expect(b.appels[0]?.methode).toBe("POST");
    expect(b.appels[0]?.corps).toEqual({ maintenance: true });
    expect(JSON.parse(b.sorties[0]!).value).toEqual({ maintenance: true });
    expect(await executerAchillea(["raw", "GET", "/admin/ops/health"], b.deps)).toBe(CODE_ECHEC_API);
    expect(JSON.parse(b.sorties[1]!).motif).toBe("Administrateur requis");
  });

  test("help et --help → aide, code 0", async () => {
    const b = banc({});
    expect(await executerAchillea(["help"], b.deps)).toBe(CODE_OK);
    expect(await executerAchillea(["--help"], b.deps)).toBe(CODE_OK);
    expect(b.sorties[0]).toContain("rosegriffon achillea");
  });
});

describe("docs (macro)", () => {
  test("relève les lignes JSDoc des ressources", () => {
    const source = `export class ClansResource extends AchilleaResource {
  /** \`GET /clans/:id\` — fiche publique d'un clan. */
  get(id: number) { return 1; }
  /**
   * \`POST /clans/x\` — multi-ligne.
   * détail
   */
  async x() {}
}`;
    expect(docsDuSource(source)).toEqual({
      "ClansResource.get": "`GET /clans/:id` — fiche publique d'un clan.",
      "ClansResource.x": "`POST /clans/x` — multi-ligne.",
    });
    expect(proprietesDuClient("this.clans = new ClansResource(this.http);")).toEqual({ ClansResource: "clans" });
  });

  test("la table réelle couvre les méthodes du client", () => {
    const docs = docsClientAchillea();
    expect(docs["clans.kickMember"]).toContain("/clans/kick/:id");
    expect(docs["ranked.adminSeasons"]).toBeDefined();
  });
});
