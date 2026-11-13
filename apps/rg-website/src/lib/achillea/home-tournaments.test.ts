import { describe, expect, test } from "bun:test";
import { createAchilleaClient } from "./client";
import { loadRecentTournaments } from "./home-tournaments";

/**
 * Réponse réelle de `GET https://ranked.rosegriffon.fr/api/tournaments?page=1&pageSize=3`
 * relevée le 5 novembre 2026 (descriptions abrégées), quand aucun tournoi n'était actif.
 */
const RECORDED = {
  data: [
    {
      id: 32,
      name: "Summer Kama Club",
      description:
        "Tournoi Inazuma Eleven Victory Road de 32 joueurs, organisé par le serveur Discord Kama Club.",
      type: "TOURNAMENT",
      status: "Finished",
      createdAt: "2026-07-23T19:06:45.367Z",
      updatedAt: "2026-08-06T11:52:09.555Z",
    },
    {
      id: 23,
      name: "La Coupe d'Ilion #6",
      description:
        "La coupe d'Ilion est un tournoi organisé 2 fois par semaines avec 32 joueurs.",
      type: "TOURNAMENT",
      status: "Finished",
      createdAt: "2026-02-25T16:27:06.428Z",
      updatedAt: "2026-09-08T12:37:26.339Z",
    },
    {
      id: 22,
      name: "La Coupe d'Ilion #5",
      description:
        "La coupe d'Ilion est un tournoi organisé 2 fois par semaines avec 32 joueurs.",
      type: "TOURNAMENT",
      status: "Finished",
      createdAt: "2026-02-23T18:34:16.915Z",
      updatedAt: "2026-09-08T12:37:28.528Z",
    },
  ],
  meta: { page: 1, limit: 3, total: 9, pageCount: 3 },
};

function clientReturning(body: unknown, status = 200) {
  const urls: string[] = [];
  const client = createAchilleaClient({
    baseUrl: "https://ranked.example/api",
    fetch: async (input) => {
      urls.push(String(input instanceof Request ? input.url : input));
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    },
  });
  return { client, urls };
}

describe("tournois récents de l'accueil Achilléa", () => {
  test("lit les tournois terminés de l'API et valide la forme réelle", async () => {
    const { client, urls } = clientReturning(RECORDED);
    const recent = await loadRecentTournaments(client);
    expect(recent.map((item) => [item.id, item.name, item.status])).toEqual([
      [32, "Summer Kama Club", "Finished"],
      [23, "La Coupe d'Ilion #6", "Finished"],
      [22, "La Coupe d'Ilion #5", "Finished"],
    ]);
    const url = new URL(urls[0]);
    expect(url.pathname).toBe("/api/tournaments");
    expect(url.searchParams.get("pageSize")).toBe("3");
    expect(url.searchParams.getAll("states")).toEqual(["Finished"]);
  });

  test("ne dépasse pas la limite demandée", async () => {
    const { client } = clientReturning(RECORDED);
    expect(await loadRecentTournaments(client, 1)).toHaveLength(1);
  });

  test("une erreur API donne une liste vide, jamais une donnée inventée", async () => {
    const { client } = clientReturning({ message: "down" }, 503);
    expect(await loadRecentTournaments(client)).toEqual([]);
  });
});
