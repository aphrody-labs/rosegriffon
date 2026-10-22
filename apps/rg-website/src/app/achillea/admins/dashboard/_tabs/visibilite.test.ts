import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import type { DbColumn } from "@rosegriffon/achillea-types/domain/admin";
import {
  GROUPES_ONGLETS,
  ROLE_ADMIN,
  ROLE_MODERATEUR,
  ROLE_SUPER_ADMIN,
  libelleRole,
  ongletsVisibles,
  type AdminTab,
} from "./visibilite";
import {
  VALEUR_MASQUEE,
  depuisSaisie,
  formaterOctets,
  genreColonne,
  messageRefusDb,
  messageRefusSauvegarde,
  sauvegardesSchema,
  tailleBaseSchema,
  valeursInsertion,
  valeursModifiees,
} from "./database-valeurs";

/**
 * Onglet Angular (`legacy/achillea-web/.../admin-dashboard/<dossier>`) → onglet Next.
 * Organisations et tournois n'étaient pas des dossiers d'onglet : ils ont leurs pages.
 */
const ONGLETS_LEGACY: Record<string, AdminTab> = {
  "audit-tab": "audit",
  "bot-health-tab": "bot-health",
  "casts-tab": "casts",
  "clans-tab": "clans",
  "database-tab": "database",
  "guilds-tab": "guilds",
  "leagues-tab": "leagues",
  "licenses-tab": "licenses",
  "overview-tab": "overview",
  "ranked-active-tab": "ranked-active",
  "ranked-disputes-tab": "disputes",
  "ranked-seasons-tab": "seasons",
  "ranked-telemetry-tab": "ranked-telemetry",
  "sanctions-tab": "sanctions",
  "users-tab": "users",
  "wallets-tab": "wallets",
};

/** Onglets extraits dans `_tabs/` : chacun a son composant. */
const COMPOSANTS_EXTRAITS: ReadonlyArray<readonly [AdminTab, string]> = [
  ["audit", "audit-tab.tsx"],
  ["bot-health", "bot-health-tab.tsx"],
  ["casts", "casts-tab.tsx"],
  ["clans", "clans-tab.tsx"],
  ["database", "database-tab.tsx"],
  ["guilds", "guilds-tab.tsx"],
  ["leagues", "leagues-tab.tsx"],
  ["licenses", "licenses-tab.tsx"],
  ["ranked-active", "ranked-active-tab.tsx"],
  ["ranked-telemetry", "ranked-telemetry-tab.tsx"],
];

const SUPER_ADMIN_SEULEMENT: AdminTab[] = ["bot-health", "guilds", "database", "audit", "wallets"];

describe("visibilité des onglets du back-office", () => {
  test("un membre sans rôle staff ne voit rien", () => {
    expect(ongletsVisibles(0)).toEqual([]);
    expect(ongletsVisibles(null)).toEqual([]);
  });

  test("un modérateur voit les onglets staff, ni sanctions ni ops sensibles", () => {
    const visibles = ongletsVisibles(ROLE_MODERATEUR);
    for (const id of ["overview", "clans", "casts", "leagues", "licenses", "ranked-active", "ranked-telemetry"] as const)
      expect(visibles).toContain(id);
    expect(visibles).not.toContain("sanctions");
    for (const id of SUPER_ADMIN_SEULEMENT) expect(visibles).not.toContain(id);
  });

  test("un admin gagne les sanctions mais pas les ops SuperAdmin", () => {
    const visibles = ongletsVisibles(ROLE_ADMIN);
    expect(visibles).toContain("sanctions");
    for (const id of SUPER_ADMIN_SEULEMENT) expect(visibles).not.toContain(id);
  });

  test("un super-admin voit tous les onglets", () => {
    const tous = GROUPES_ONGLETS.flatMap(groupe => groupe.onglets.map(onglet => onglet.id));
    expect(ongletsVisibles(ROLE_SUPER_ADMIN)).toEqual(tous);
    expect(new Set(tous).size).toBe(tous.length);
  });

  test("libellé du rôle", () => {
    expect(libelleRole(3)).toBe("Super-Admin");
    expect(libelleRole(2)).toBe("Admin");
    expect(libelleRole(1)).toBe("Modérateur");
    expect(libelleRole(undefined)).toBe("Membre");
  });
});

describe("parité des onglets Angular → Next", () => {
  const dossierLegacy = resolve(
    import.meta.dir,
    "../../../../../../../../legacy/achillea-web/src/app/views/admin-dashboard",
  );
  const declares = new Set(GROUPES_ONGLETS.flatMap(groupe => groupe.onglets.map(onglet => onglet.id)));

  test.skipIf(!existsSync(dossierLegacy))("chaque dossier d'onglet legacy a son onglet Next", () => {
    const dossiers = readdirSync(dossierLegacy, { withFileTypes: true })
      .filter(entree => entree.isDirectory() && entree.name.endsWith("-tab"))
      .map(entree => entree.name);
    expect(dossiers.length).toBeGreaterThan(0);
    for (const dossier of dossiers) {
      const id = ONGLETS_LEGACY[dossier];
      expect(id, `onglet legacy non mappé : ${dossier}`).toBeDefined();
      if (id) expect(declares.has(id), `onglet Next absent : ${id}`).toBe(true);
    }
  });

  test("chaque onglet extrait a son composant et est rendu par le routeur", async () => {
    const routeur = await Bun.file(resolve(import.meta.dir, "../admin-dashboard-client.tsx")).text();
    for (const [id, fichier] of COMPOSANTS_EXTRAITS) {
      expect(existsSync(resolve(import.meta.dir, fichier)), fichier).toBe(true);
      expect(routeur).toContain(`ongletActif === "${id}"`);
    }
  });
});

describe("éditeur de lignes de l'onglet base de données", () => {
  const colonnes: DbColumn[] = [
    { name: "id", dataType: "integer", nullable: false, default: "nextval()", isPrimaryKey: true },
    { name: "name", dataType: "text", nullable: false, default: null, isPrimaryKey: false },
    { name: "qr_secret", dataType: "text", nullable: false, default: null, isPrimaryKey: false },
    { name: "languages", dataType: "ARRAY", nullable: false, default: null, isPrimaryKey: false },
    { name: "is_hidden", dataType: "boolean", nullable: false, default: "false", isPrimaryKey: false },
  ];

  test("genre des colonnes", () => {
    expect(genreColonne("integer")).toBe("number");
    expect(genreColonne("jsonb")).toBe("json");
    expect(genreColonne("ARRAY")).toBe("json");
    expect(genreColonne("boolean")).toBe("boolean");
    expect(genreColonne("timestamp with time zone")).toBe("text");
  });

  test("seules les colonnes modifiées partent, jamais la clé ni une valeur masquée", () => {
    const initiale = { id: "1", name: "A", qr_secret: VALEUR_MASQUEE, languages: '["fr"]', is_hidden: "false" };
    const courante = { ...initiale, id: "2", name: "B", is_hidden: "true" };
    expect(valeursModifiees(colonnes, initiale, courante)).toEqual({ name: "B", is_hidden: true });
  });

  test("un JSON invalide nomme la colonne fautive", () => {
    const initiale = { languages: "[]" };
    expect(() => valeursModifiees(colonnes, initiale, { languages: "[" })).toThrow("languages");
    expect(() => depuisSaisie("abc", "number")).toThrow();
  });

  test("l'insertion ignore les champs vides", () => {
    expect(valeursInsertion(colonnes, { name: "C", languages: '["en"]', is_hidden: "" })).toEqual({
      name: "C",
      languages: ["en"],
    });
  });

  test("sauvegardes : contrat, tailles et refus", () => {
    expect(
      sauvegardesSchema.safeParse({
        data: [{ name: "achillea-1.dump", sizeBytes: 2048, createdAt: "2026-10-22T10:00:00.000Z" }],
        retention: 7,
      }).success,
    ).toBe(true);
    expect(tailleBaseSchema.safeParse({ database: { bytes: 1 } }).success).toBe(false);
    expect(formaterOctets(512)).toBe("512 o");
    expect(formaterOctets(1536)).toBe("1,5 Kio");
    expect(messageRefusSauvegarde(409)).toContain("en cours");
    expect(messageRefusSauvegarde(503)).toContain("pg_dump");
    expect(messageRefusSauvegarde(200)).toBeNull();
  });

  test("refus de la console traduits par statut", () => {
    expect(messageRefusDb(400)).toContain("SELECT");
    expect(messageRefusDb(403)).toContain("Super-Admin");
    expect(messageRefusDb(500)).toBeNull();
  });
});
