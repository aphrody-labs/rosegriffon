/**
 * Mise en forme et validation pures de `/achillea-admin` — testées sans Discord ni API.
 */
import type { AdminGuildRow } from "@rosegriffon/achillea-client";
import type { Paginated } from "@rosegriffon/achillea-types/domain/common";
import type { OrganizationDTO } from "@rosegriffon/achillea-types/domain/organization";
import type { PlayerNote } from "@rosegriffon/achillea-types/domain/player-note";
import type { RankedAdminDispute, RankedAdminSeason } from "@rosegriffon/achillea-types/domain/ranked";
import type { Sanction } from "@rosegriffon/achillea-types/domain/sanction";

/** Rôles Achilléa (`UserRole`). */
export const LIBELLES_ROLE: Readonly<Record<number, string>> = Object.freeze({
  0: "Joueur",
  1: "Modérateur",
  2: "Administrateur",
  3: "Super-administrateur",
});

/** Date `AAAA-MM-JJ` (ou ISO complète) → ISO 8601 ; `null` si illisible. */
export function dateIso(saisie: string): string | null {
  const brut = saisie.trim();
  if (!/^\d{4}-\d{2}-\d{2}([T ][\d:.]+Z?)?$/u.test(brut)) return null;
  const date = new Date(brut.length === 10 ? `${brut}T00:00:00.000Z` : brut.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Horodatage Discord relatif (`<t:…:R>`) ou `—`. */
export function quand(iso: string | Date | null | undefined, style = "R"): string {
  if (!iso) return "—";
  const ms = (iso instanceof Date ? iso : new Date(iso)).getTime();
  return Number.isNaN(ms) ? "—" : `<t:${Math.floor(ms / 1000)}:${style}>`;
}

export function ligneGuilde(g: AdminGuildRow): string {
  return `**${g.name}** · \`${g.id}\` · ${g.memberCount} membres`;
}

export function ligneSaison(s: RankedAdminSeason): string {
  const etat = s.state === "Active" ? "🟢 active" : s.state === "Upcoming" ? "🕓 à venir" : "⚪ close";
  return `**${s.name}** · ${etat} · ${quand(s.startsAt, "d")} → ${quand(s.endsAt, "d")} · ${s.playerCount} joueurs\n\`${s.id}\``;
}

export function ligneLitige(d: RankedAdminDispute): string {
  const joueur = (p: RankedAdminDispute["player1"]) =>
    `<@${p.userId}> annonce ${p.submittedScore}${p.claimedOpponentScore == null ? "" : `-${p.claimedOpponentScore}`}`;
  return `Lobby \`${d.lobbyId}\` · ${quand(d.createdAt)}\n${joueur(d.player1)} · ${joueur(d.player2)}`;
}

export function ligneSanction(s: Sanction): string {
  const etat = s.revokedAt ? "révoquée" : s.expiresAt && new Date(s.expiresAt).getTime() < Date.now() ? "expirée" : "active";
  return `\`${s.id}\` · **${s.type}** · <@${s.userId}> · ${etat} · ${quand(s.createdAt)}${s.reason ? `\n> ${s.reason.slice(0, 150)}` : ""}`;
}

export function ligneNote(n: PlayerNote): string {
  const cible = n.target ? `${n.target.displayName} (\`${n.target.id}\`)` : "—";
  return `\`${n.id}\` · ${n.severity} · ${n.category} · ${cible}${n.resolved ? " · ✅ traitée" : ""}\n> ${n.content.slice(0, 160)}`;
}

export function ligneOrganisation(o: OrganizationDTO): string {
  const proprietaire = typeof o.owner === "string" ? `<@${o.owner}>` : o.owner ? `<@${o.owner.id}>` : "—";
  return `\`${o.id ?? "?"}\` · **${o.name}** · ${proprietaire}`;
}

/** Total d'une page d'organisations, quelle que soit la génération de l'API. */
export function totalPage<T>(page: Paginated<T>): number {
  const meta = page.meta as { total?: number; totalItems?: number } | undefined;
  return meta?.total ?? meta?.totalItems ?? page.data.length;
}

/** Joint des lignes sans dépasser la limite d'une description d'embed. */
export function listeBornee(lignes: readonly string[], vide: string, limite = 3_900): string {
  if (lignes.length === 0) return vide;
  let texte = "";
  let affichees = 0;
  for (const ligne of lignes) {
    const suivant = texte ? `${texte}\n\n${ligne}` : ligne;
    if (suivant.length > limite) break;
    texte = suivant;
    affichees += 1;
  }
  return affichees < lignes.length ? `${texte}\n\n… et ${lignes.length - affichees} de plus.` : texte;
}
