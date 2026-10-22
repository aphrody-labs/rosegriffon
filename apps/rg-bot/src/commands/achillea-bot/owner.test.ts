import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi, type AppelApi } from "../../../test/achillea-kit";
import { CommandeOwner, roleCible } from "./owner";

let restaurer: (() => void) | null = null;
afterEach(() => {
  restaurer?.();
  restaurer = null;
});
function api(routes: Parameters<typeof installerApi>[0]): AppelApi[] {
  const installation = installerApi(routes);
  restaurer = installation.restaurer;
  return installation.appels;
}

const CIBLE = { id: "333333333333333333", username: "akira", displayName: "Akira" };
const REFUS = [403, { message: "Rôle Administrateur Achilléa requis." }] as const;

describe("roleCible", () => {
  test("ajout → rôle demandé, retrait → utilisateur, choix inconnu → null", () => {
    expect(roleCible("add", "admin")).toBe(2);
    expect(roleCible("add", "mod")).toBe(1);
    expect(roleCible("add", "superadmin")).toBe(3);
    expect(roleCible("remove", "admin")).toBe(0);
    expect(roleCible("toggle", "admin")).toBeNull();
    expect(roleCible("add", "dieu")).toBeNull();
  });
});

describe("/owner blacklist-add / blacklist-remove", () => {
  test("ajout nominal", async () => {
    const appels = api({
      [`POST /blacklist/${CIBLE.id}`]: { userId: CIBLE.id, username: "akira", displayName: "Akira", reason: "triche", since: new Date().toISOString() },
    });
    const interaction = fausseInteraction();
    await new CommandeOwner().ajouter(CIBLE as never, "triche", interaction as never);
    expect(appels[0]?.corps).toEqual({ reason: "triche" });
    expect(interaction.texte()).toContain("a été ajouté");
  });

  test("ajout refusé (403)", async () => {
    api({ [`POST /blacklist/${CIBLE.id}`]: REFUS });
    const interaction = fausseInteraction();
    await new CommandeOwner().ajouter(CIBLE as never, "triche", interaction as never);
    expect(interaction.texte()).toContain("Administrateur Achilléa requis");
  });

  test("retrait nominal et absent de la liste", async () => {
    api({
      [`DELETE /blacklist/${CIBLE.id}`]: { success: true, userId: CIBLE.id },
      "DELETE /blacklist/444444444444444444": [404, { message: "Ce joueur n'est pas sur la liste noire." }],
    });
    const ok = fausseInteraction();
    await new CommandeOwner().retirer(CIBLE as never, "appel accepté", ok as never);
    expect(ok.texte()).toContain("a été retiré");
    const absent = fausseInteraction();
    await new CommandeOwner().retirer({ id: "444444444444444444", username: "z" } as never, "x", absent as never);
    expect(absent.texte()).toContain("n'est pas sur la liste noire");
  });
});

describe("/owner bot-role", () => {
  test("ajout admin : rôle 2 écrit par l'API", async () => {
    const appels = api({ [`POST /admin/ops/users/${CIBLE.id}/role`]: { success: true, id: CIBLE.id, role: 2 } });
    const interaction = fausseInteraction();
    await new CommandeOwner().botRole("add", CIBLE as never, "admin", interaction as never);
    expect(appels[0]?.corps).toEqual({ role: 2 });
    expect(interaction.texte()).toContain("est désormais administrateur");
  });

  test("refus (403)", async () => {
    api({ [`POST /admin/ops/users/${CIBLE.id}/role`]: REFUS });
    const interaction = fausseInteraction();
    await new CommandeOwner().botRole("remove", CIBLE as never, "mod", interaction as never);
    expect(interaction.texte()).toContain("requis");
  });
});

describe("/owner maintenance et resync-users", () => {
  test("maintenance activée", async () => {
    const appels = api({ "POST /admin/ops/maintenance": { maintenance: true } });
    const interaction = fausseInteraction();
    await new CommandeOwner().maintenance(true, interaction as never);
    expect(appels[0]?.corps).toEqual({ maintenance: true });
    expect(interaction.texte()).toContain("activé");
  });

  test("maintenance refusée (403)", async () => {
    api({ "POST /admin/ops/maintenance": [403, { message: "Super-administrateur requis" }] });
    const interaction = fausseInteraction();
    await new CommandeOwner().maintenance(false, interaction as never);
    expect(interaction.texte()).toContain("Super-administrateur requis");
  });

  test("resync lancé, ou déjà en cours", async () => {
    api({ "POST /users/resync-avatars": { started: true } });
    const lance = fausseInteraction();
    await new CommandeOwner().resync(lance as never);
    expect(lance.texte()).toContain("Réindexation lancée");
    restaurer?.();
    api({ "POST /users/resync-avatars": { started: false } });
    const deja = fausseInteraction();
    await new CommandeOwner().resync(deja as never);
    expect(deja.texte()).toContain("déjà en cours");
  });

  test("resync refusé (403)", async () => {
    api({ "POST /users/resync-avatars": [403, { message: "Réservé au staff" }] });
    const interaction = fausseInteraction();
    await new CommandeOwner().resync(interaction as never);
    expect(interaction.texte()).toContain("Réservé au staff");
  });
});
