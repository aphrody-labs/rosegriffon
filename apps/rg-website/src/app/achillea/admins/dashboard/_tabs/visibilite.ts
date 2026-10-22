/**
 * Onglets du back-office Achilléa et rôle minimal de chacun.
 *
 * Module PUR (ni `"use client"`, ni React) : la table est lue par le routeur
 * d'onglets et par les tests. Elle reprend `admin-dashboard.ts` de l'ancienne
 * application Angular : le drapeau `superAdmin` y réservait l'onglet au rôle 3,
 * organisations / tournois / sanctions au rôle 2, le reste au staff (rôle 1).
 *
 * La visibilité n'est qu'un confort : chaque route de l'API revérifie le rôle.
 */

/** Rôles système Achilléa (colonne `user.role`). */
export const ROLE_MODERATEUR = 1;
export const ROLE_ADMIN = 2;
export const ROLE_SUPER_ADMIN = 3;

export type AdminTab =
  | "overview"
  | "bot-health"
  | "guilds"
  | "database"
  | "audit"
  | "users"
  | "clans"
  | "leagues"
  | "casts"
  | "ranked-active"
  | "disputes"
  | "seasons"
  | "ranked-telemetry"
  | "wallets"
  | "sanctions"
  | "notes"
  | "licenses";

export interface OngletAdmin {
  id: AdminTab;
  libelle: string;
  description: string;
  roleMinimal: number;
}

export interface GroupeOnglets {
  titre: string;
  onglets: OngletAdmin[];
}

export const GROUPES_ONGLETS: readonly GroupeOnglets[] = [
  {
    titre: "Ops",
    onglets: [
      {
        id: "overview",
        libelle: "Vue d'ensemble",
        description: "Alertes et indicateurs multi-domaines",
        roleMinimal: ROLE_MODERATEUR,
      },
      {
        id: "bot-health",
        libelle: "Bot & santé",
        description: "Disponibilité, maintenance, hôte, métriques et logs",
        roleMinimal: ROLE_SUPER_ADMIN,
      },
      {
        id: "guilds",
        libelle: "Serveurs Discord",
        description: "Serveurs où le bot est présent, invitations, commandes",
        roleMinimal: ROLE_SUPER_ADMIN,
      },
      {
        id: "database",
        libelle: "Base de données",
        description: "Tables, lignes et console SQL en lecture seule",
        roleMinimal: ROLE_SUPER_ADMIN,
      },
      {
        id: "audit",
        libelle: "Audit",
        description: "Journal d'actions chaîné",
        roleMinimal: ROLE_SUPER_ADMIN,
      },
    ],
  },
  {
    titre: "Communauté",
    onglets: [
      {
        id: "users",
        libelle: "Utilisateurs",
        description: "Recherche de joueurs, rôles staff",
        roleMinimal: ROLE_MODERATEUR,
      },
      {
        id: "clans",
        libelle: "Clans",
        description: "Demandes en attente, clans actifs, limites d'effectif",
        roleMinimal: ROLE_MODERATEUR,
      },
      {
        id: "leagues",
        libelle: "Ligues",
        description: "Astral League et championnats",
        roleMinimal: ROLE_MODERATEUR,
      },
      {
        id: "casts",
        libelle: "Casts",
        description: "Événements cast et planning",
        roleMinimal: ROLE_MODERATEUR,
      },
    ],
  },
  {
    titre: "Ranked",
    onglets: [
      {
        id: "ranked-active",
        libelle: "Matchs en cours",
        description: "Lobbies ranked en direct",
        roleMinimal: ROLE_MODERATEUR,
      },
      {
        id: "disputes",
        libelle: "Litiges",
        description: "Arbitrage des scores contestés",
        roleMinimal: ROLE_MODERATEUR,
      },
      {
        id: "seasons",
        libelle: "Saisons",
        description: "Activation et réinitialisation du classement",
        roleMinimal: ROLE_MODERATEUR,
      },
      {
        id: "ranked-telemetry",
        libelle: "Télémétrie",
        description: "Journal des événements de match ranked",
        roleMinimal: ROLE_MODERATEUR,
      },
    ],
  },
  {
    titre: "Économie & modération",
    onglets: [
      {
        id: "wallets",
        libelle: "Portefeuilles",
        description: "Soldes ACH, crédit / débit staff",
        roleMinimal: ROLE_SUPER_ADMIN,
      },
      {
        id: "sanctions",
        libelle: "Sanctions",
        description: "Sanctions des membres",
        roleMinimal: ROLE_ADMIN,
      },
      {
        id: "notes",
        libelle: "Signalements",
        description: "Notes du staff sur les joueurs",
        roleMinimal: ROLE_MODERATEUR,
      },
      {
        id: "licenses",
        libelle: "Licences",
        description: "Émission et révocation",
        roleMinimal: ROLE_MODERATEUR,
      },
    ],
  },
];

/** Groupes d'onglets visibles pour un rôle ; un groupe vide disparaît. */
export function groupesVisibles(role: number | null | undefined): GroupeOnglets[] {
  const niveau = role ?? 0;
  return GROUPES_ONGLETS.map(groupe => ({
    titre: groupe.titre,
    onglets: groupe.onglets.filter(onglet => niveau >= onglet.roleMinimal),
  })).filter(groupe => groupe.onglets.length > 0);
}

/** Identifiants des onglets visibles pour un rôle, dans l'ordre d'affichage. */
export function ongletsVisibles(role: number | null | undefined): AdminTab[] {
  return groupesVisibles(role).flatMap(groupe => groupe.onglets.map(onglet => onglet.id));
}

/** Libellé du rôle affiché dans l'en-tête. */
export function libelleRole(role: number | null | undefined): string {
  const niveau = role ?? 0;
  if (niveau >= ROLE_SUPER_ADMIN) return "Super-Admin";
  if (niveau >= ROLE_ADMIN) return "Admin";
  if (niveau >= ROLE_MODERATEUR) return "Modérateur";
  return "Membre";
}
