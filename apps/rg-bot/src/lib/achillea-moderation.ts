/**
 * Outils purs des commandes de modération du profil Achilléa.
 *
 * Aucune I/O : durées, libellés, escalade et effet Discord d'une sanction se
 * décident ici et se testent sans passerelle (`achillea-moderation.test.ts`).
 */
import { ESCALATION_WINDOW_SEC, evaluateEscalation } from "@rosegriffon/achillea-core";
import type { AchilleaClient } from "@rosegriffon/achillea-client";
import type { GuildMember, User } from "discord.js";

/** Sanction telle que l'API la rend. */
export type Sanction = Extract<Awaited<ReturnType<AchilleaClient["sanctions"]["create"]>>, { ok: true }>["value"];

/** Plafond d'un timeout Discord : 28 jours. */
export const DUREE_MAX_MUTE_S = 2_419_200;

/** `30s`, `15m`, `2h`, `7d` → secondes. `null` si la saisie n'a pas cette forme. */
export function lireDuree(brut: string): number | null {
  const correspondance = /^(\d+)([smhdj])$/u.exec(brut.trim().toLowerCase());
  if (!correspondance) return null;
  const valeur = Number.parseInt(correspondance[1] ?? "", 10);
  const multiplicateur: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400, j: 86_400 };
  const secondes = valeur * (multiplicateur[correspondance[2] ?? ""] ?? 0);
  return Number.isFinite(secondes) && secondes > 0 ? secondes : null;
}

/** Durée compacte : `7j`, `2h`, `15m`, `30s`. */
export function formaterDureeCourte(secondes: number): string {
  if (secondes >= 86_400) return `${Math.round(secondes / 86_400)}j`;
  if (secondes >= 3600) return `${Math.round(secondes / 3600)}h`;
  if (secondes >= 60) return `${Math.round(secondes / 60)}m`;
  return `${secondes}s`;
}

/** Horodatage Discord (`<t:…:F>`), recalculé dans le fuseau du lecteur. */
export function horodatage(valeur: string | Date | null | undefined, style: "R" | "t" | "f" | "F" = "F"): string {
  if (!valeur) return "—";
  const ms = valeur instanceof Date ? valeur.getTime() : new Date(valeur).getTime();
  return Number.isFinite(ms) ? `<t:${Math.floor(ms / 1000)}:${style}>` : "—";
}

/** `User` d'une option discordx, qu'elle arrive en `User` ou en `GuildMember`. */
export function utilisateurDe(brut: User | GuildMember): User {
  return "user" in brut && brut.user ? brut.user : (brut as User);
}

/**
 * Avertissements qui comptent pour l'escalade : actifs (non révoqués, non
 * expirés) et émis dans la fenêtre glissante d'`ESCALATION_WINDOW_SEC`.
 */
export function avertissementsActifs(sanctions: readonly Sanction[], maintenant = Date.now()): number {
  const debut = maintenant - ESCALATION_WINDOW_SEC * 1000;
  return sanctions.filter(
    s =>
      s.type === "warn" &&
      s.revokedAt === null &&
      (s.expiresAt === null || new Date(s.expiresAt).getTime() > maintenant) &&
      new Date(s.createdAt).getTime() >= debut,
  ).length;
}

/** Décision d'escalade automatique (mute/ban) d'après les avertissements actifs. */
export function escaladeApres(sanctions: readonly Sanction[], maintenant = Date.now()) {
  const nombre = avertissementsActifs(sanctions, maintenant);
  const decision = evaluateEscalation(nombre);
  return decision ? { ...decision, avertissements: nombre } : null;
}

/** Ce qu'une sanction demande à Discord. Les avertissements et notes n'ont aucun effet. */
export type EffetDiscord =
  | { action: "aucun" }
  | { action: "timeout"; ms: number }
  | { action: "expulser" }
  | { action: "bannir" }
  | { action: "lever-timeout" }
  | { action: "debannir" };

export function effetDeSanction(sanction: Pick<Sanction, "type" | "durationSec">): EffetDiscord {
  switch (sanction.type) {
    case "mute": {
      return { action: "timeout", ms: (sanction.durationSec ?? 600) * 1000 };
    }
    case "kick": {
      return { action: "expulser" };
    }
    case "ban": {
      return { action: "bannir" };
    }
    default: {
      return { action: "aucun" };
    }
  }
}

/** Effet inverse appliqué à la révocation d'une sanction. */
export function effetDeRevocation(sanction: Pick<Sanction, "type">): EffetDiscord {
  if (sanction.type === "mute") return { action: "lever-timeout" };
  if (sanction.type === "ban") return { action: "debannir" };
  return { action: "aucun" };
}

/** Ce que la passerelle doit savoir faire pour appliquer un effet (doublé en test). */
export interface ServeurModerable {
  members: { fetch(id: string): Promise<{ timeout(ms: number | null, raison?: string): Promise<unknown>; kick(raison?: string): Promise<unknown> }> };
  bans: { create(id: string, options?: { reason?: string }): Promise<unknown>; remove(id: string, raison?: string): Promise<unknown> };
}

/** Applique l'effet Discord ; lève l'erreur Discord telle quelle, que l'appelant raconte. */
export async function appliquerEffet(
  serveur: ServeurModerable,
  utilisateurId: string,
  effet: EffetDiscord,
  raison?: string,
): Promise<void> {
  switch (effet.action) {
    case "aucun": {
      return;
    }
    case "timeout": {
      await (await serveur.members.fetch(utilisateurId)).timeout(effet.ms, raison);
      return;
    }
    case "lever-timeout": {
      await (await serveur.members.fetch(utilisateurId)).timeout(null, raison);
      return;
    }
    case "expulser": {
      await (await serveur.members.fetch(utilisateurId)).kick(raison);
      return;
    }
    case "bannir": {
      await serveur.bans.create(utilisateurId, raison ? { reason: raison } : {});
      return;
    }
    case "debannir": {
      await serveur.bans.remove(utilisateurId, raison);
      return;
    }
  }
}

/** Libellé d'un mode ranked. */
export function libelleMode(mode: number | null | undefined): string {
  if (mode === 2) return "Standard (1v1)";
  if (mode === 4) return "Double (2v2)";
  return mode == null ? "—" : `Mode ${mode}`;
}

export function signe(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Lien cliquable vers une capture de litige (chemin relatif servi par le ranked). */
export function lienCapture(url: string | null | undefined, origine: string): string {
  if (!url) return "pas de capture";
  return `[capture](${url.startsWith("http") ? url : `${origine.replace(/\/$/u, "")}${url}`})`;
}
