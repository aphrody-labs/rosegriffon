/**
 * L'arbre de commandes du profil Achilléa, tel que Discord le recevra.
 *
 * Un nom en majuscules, une description de 101 caractères ou un 26ᵉ choix ne
 * se voient ni au type-check ni dans les tests de commande : Discord refuse
 * l'enregistrement ENTIER au démarrage, et le serveur se retrouve sans aucune
 * commande. On charge donc les modules exactement comme `index.ts` (même
 * ordre, mêmes chargeurs) et on vérifie le JSON produit contre les limites de
 * l'API Discord.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { MetadataStorage } from "discordx";

import { MODULE_LOADERS } from "../../modules";
import { PROFILS } from "../../lib/profil";

interface OptionJson {
  type: number;
  name: string;
  description: string;
  options?: OptionJson[];
  choices?: Array<{ name: string; value: unknown }>;
  required?: boolean;
}
interface CommandeJson extends OptionJson {
  options?: OptionJson[];
}

const NOM = /^[-_\p{Ll}\p{Lo}\p{N}]{1,32}$/u;
let racines: CommandeJson[] = [];

beforeAll(async () => {
  for (const chemin of PROFILS.achillea.modules) {
    const chargeur = MODULE_LOADERS[chemin];
    if (!chargeur) throw new Error(`chargeur absent : ${chemin}`);
    await chargeur();
  }
  await MetadataStorage.instance.build();
  racines = MetadataStorage.instance.applicationCommandSlashes.map(
    commande => commande.toJSON() as unknown as CommandeJson,
  );
});

/** Parcourt toutes les options (sous-groupes, sous-commandes, paramètres). */
function* parcourir(noeud: OptionJson, chemin: string): Generator<[string, OptionJson]> {
  yield [chemin, noeud];
  for (const option of noeud.options ?? []) yield* parcourir(option, `${chemin} ${option.name}`);
}

describe("arbre du profil Achilléa", () => {
  test("les quinze racines attendues sont présentes, sans doublon", () => {
    const noms = racines.map(r => r.name);
    expect(new Set(noms).size).toBe(noms.length);
    for (const racine of [
      "player",
      "interclan",
      "guild",
      "clan",
      "website",
      "blacklist",
      "player-card",
      "ping",
      "report",
      "report-tournois",
      "create-clan",
      "owner",
      "ranked-admin",
      "sanction",
      "achillea-admin",
    ]) {
      expect(noms).toContain(racine);
    }
  });

  test("noms et descriptions respectent les limites de Discord", () => {
    const fautes: string[] = [];
    for (const racine of racines) {
      for (const [chemin, noeud] of parcourir(racine, `/${racine.name}`)) {
        if (!NOM.test(noeud.name)) fautes.push(`${chemin} : nom invalide`);
        if (!noeud.description || noeud.description.length > 100) fautes.push(`${chemin} : description de ${noeud.description?.length ?? 0} caractères`);
        if ((noeud.options?.length ?? 0) > 25) fautes.push(`${chemin} : ${noeud.options?.length} options (> 25)`);
        if ((noeud.choices?.length ?? 0) > 25) fautes.push(`${chemin} : ${noeud.choices?.length} choix (> 25)`);
        for (const choix of noeud.choices ?? []) {
          if (choix.name.length < 1 || choix.name.length > 100) fautes.push(`${chemin} : choix « ${choix.name} »`);
        }
        // Discord exige les options obligatoires AVANT les facultatives.
        const parametres = (noeud.options ?? []).filter(o => o.type > 2);
        const premierFacultatif = parametres.findIndex(o => !o.required);
        if (premierFacultatif >= 0 && parametres.slice(premierFacultatif).some(o => o.required))
          fautes.push(`${chemin} : option obligatoire après une facultative`);
      }
    }
    expect(fautes).toEqual([]);
  });

  test("le groupe /clan réunit les sous-commandes des trois modules", () => {
    const clan = racines.find(r => r.name === "clan");
    const sous = new Set((clan?.options ?? []).map(o => o.name));
    for (const nom of ["infos", "invite-member", "leave", "poster", "disband", "transfer-ownership", "apply", "teams", "manage"]) {
      expect(`${nom}:${sous.has(nom)}`).toBe(`${nom}:true`);
    }
  });

  test("chaque custom_id legacy a UN gestionnaire, et un seul", () => {
    const stock = MetadataStorage.instance;
    const gestionnaires = [...stock.buttonComponents, ...stock.selectMenuComponents, ...stock.modalComponents];
    // Un identifiant d'exemple par famille legacy : chacun doit tomber sur exactement un gestionnaire.
    const exemples = [
      "confirm_application:1", "refuse_application:1", "init_application:1", "create_application:1",
      "cancel_application:1", "apply_distinctions:1", "editDistinctions:1:2", "return_to_member_menu:1",
      "edit_distinctions:1:2", "broadcast_channel_button:1", "bind_clan_guild:1", "unbind_clan_guild:1",
      "modal_guild_broadcast_channel:1", "broadcast_management_button:1", "guild_settings_menu:1",
      "ranked_broadcast_toggle:1", "delete_broadcast_channel_button:1", "interclan_approval:1:1",
      "interclan_lineup:1:0", "lineup_manager_modal:1:2", "lock_interclan_lineup:1:1", "cancel_interclan:1",
      "cancel_interclan_confirmation:1:1", "start_interclan:1", "interclan_match:1:2",
      "interclan_match_result_modal:1", "confirm_invite:1", "cancel_invite:1", "init_invite:1",
      "invite_distinctions:1", "join_queue:1", "leave_queue:1", "confirm_presence:1", "get_clan_history:1",
      "dismiss-message", "team_manager_btn:1:1", "return_teams_menu", "team_edit_btn:0:0",
      "team_settings_btn:1", "team_manager_modal:1:0", "team_settings_modal:1", "vote:approve:1", "vote:reject:1",
      "clanSelector",
    ];
    const constats = exemples.map(id => {
      const n = gestionnaires.filter(g => (g.id instanceof RegExp ? g.id.test(id) : g.id === id)).length;
      return `${id}:${n}`;
    });
    expect(constats).toEqual(exemples.map(id => `${id}:1`));
  });

  test("la charge d'enregistrement reste sous le plafond de Discord (8 000 caractères par commande)", () => {
    // Discord borne la somme des noms, descriptions et valeurs d'une commande ;
    // le JSON complet est un majorant prudent de cette somme.
    for (const racine of racines) {
      const texte = [...parcourir(racine, racine.name)]
        .map(([, n]) => `${n.name}${n.description}${(n.choices ?? []).map(c => `${c.name}${String(c.value)}`).join("")}`)
        .join("");
      expect(`${racine.name}:${texte.length <= 8000}`).toBe(`${racine.name}:true`);
    }
  });
});
