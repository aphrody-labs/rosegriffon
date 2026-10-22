import "./setup";
import { describe, expect, it } from "bun:test";
import { signAchilleaSessionToken } from "@rosegriffon/auth/achillea-session";
import { app } from "../src/api/server";
import { creerClansAdminController } from "../src/api/modules/achillea/clans-admin";
import { CODES_PAYS_CLAN, erreurPaysClan } from "../src/api/modules/achillea/clans/service";

const session = () =>
  `Bearer ${signAchilleaSessionToken({ id: "123456789012345678", username: "t", avatar: null }, process.env.JWT_SECRET_KEY!)}`;

describe("liste staff des clans", () => {
  it("exige une session", async () => {
    const reponse = await app.handle(new Request("http://localhost/v1/achillea/admin/clans?state=2"));
    expect(reponse.status).toBe(401);
  });

  it("refuse un membre sans rôle staff", async () => {
    const controleur = creerClansAdminController({ chargerRole: async (_db, id) => ({ id, role: 0 }) });
    const reponse = await controleur.handle(
      new Request("http://localhost/admin/clans", { headers: { authorization: session() } }),
    );
    expect(reponse.status).toBe(403);
  });

  it("borne la taille de page avant la base", async () => {
    const controleur = creerClansAdminController({ chargerRole: async (_db, id) => ({ id, role: 1 }) });
    const reponse = await controleur.handle(
      new Request("http://localhost/admin/clans?pageSize=500", { headers: { authorization: session() } }),
    );
    expect(reponse.status).toBe(422);
  });
});

describe("origine et langues d'un clan", () => {
  it("n'accepte que les codes du référentiel", () => {
    expect(CODES_PAYS_CLAN.has("fr")).toBe(true);
    expect(erreurPaysClan({})).toBeNull();
    expect(erreurPaysClan({ origin: "fr", languages: ["fr", "en"] })).toBeNull();
    expect(erreurPaysClan({ origin: "xx" })).toBe("Origine inconnue.");
    expect(erreurPaysClan({ languages: [] })).toBe("Choisis au moins une langue.");
    expect(erreurPaysClan({ languages: ["fr", "zz"] })).toBe("Langue inconnue.");
  });

  it("le PATCH valide la forme des champs avant toute écriture", async () => {
    const reponse = await app.handle(
      new Request("http://localhost/v1/achillea/clans/1", {
        method: "PATCH",
        headers: { authorization: session(), "content-type": "application/json" },
        body: JSON.stringify({ languages: "fr" }),
      }),
    );
    expect(reponse.status).toBe(422);
  });
});
