/**
 * Messages Discord des interclans — charges JSON brutes de l'API Discord.
 *
 * UNE source pour les deux côtés : l'API les poste par REST (défi dans le
 * salon du clan défié, récapitulatif dans le salon de l'interclan, vote de
 * validation), le bot les réutilise tels quels pour réécrire le message dont
 * on vient de cliquer un bouton (discord.js accepte ces objets bruts).
 *
 * Les `custom_id` sont ceux de l'ancien bot, à l'octet près : des messages
 * déjà publiés les portent encore.
 *
 *   interclan_approval:<id>:<1|0>              réponse au défi
 *   interclan_lineup:<id>:<0|1>                ouvrir la composition (0 = A, 1 = B)
 *   lineup_manager_modal:<clanId>:<id>         fenêtre de composition
 *   lock_interclan_lineup:<id>:<0|1>           verrouiller une composition
 *   cancel_interclan:<id>                      demander l'annulation
 *   cancel_interclan_confirmation:<id>:<1|0>   confirmer / renoncer
 *   start_interclan:<id>                       lancer
 *   interclan_match:<id>:<lobbyId>             ouvrir la saisie d'un score
 *   interclan_match_result_modal:<lobbyId>     fenêtre de score
 *   vote:approve:<proposalId> / vote:reject:<proposalId>   validation des résultats
 */
import { calculerVainqueur, compositionValide, ETAT, LIBELLES_ETAT, TAILLE_COMPOSITION } from "./regles";

export const COULEURS_INTERCLAN = {
  defi: 0xc27c0e,
  recap: 0x3498db,
  verrouille: 0x5865f2,
  scores: 0xf1c40f,
  vote: 0x206694,
  succes: 0x57f287,
  erreur: 0xed4245,
} as const;

export type DateApi = Date | string;

export interface ClanInterclan {
  id: number;
  name: string;
  shortName: string;
  normalizedShortName: string;
  emojiId: string | null;
  avatarUrl: string;
  roleId: string;
  channelId: string;
}

export interface JoueurComposition {
  userId: string;
  displayName: string;
  position: number;
}

export interface CompositionInterclan {
  id: number;
  clanId: number;
  lockedIn: boolean;
  valid: boolean;
  members: JoueurComposition[];
}

export interface JoueurMatch {
  userId: string;
  displayName: string;
  team: number;
  score: number;
}

export interface MatchInterclan {
  id: number;
  state: string;
  players: JoueurMatch[];
}

export interface ValidationInterclan {
  proposalId: number;
  status: string;
  expiresAt: DateApi;
  closedAt: DateApi | null;
  approvals: number;
  rejections: number;
  eligible: number;
  minParticipationRatio: number;
}

export interface SpectateurInterclan {
  clanId: number | null;
  clanRole: number | null;
  isAdmin: boolean;
}

export interface DetailInterclan {
  id: number;
  name: string;
  description: string;
  state: number;
  stateLabel: string;
  fixedDate: DateApi;
  createdAt: DateApi;
  updatedAt: DateApi;
  discordChannelId: string | null;
  winnerClanId: number | null;
  clanA: ClanInterclan;
  clanB: ClanInterclan;
  lineups: CompositionInterclan[];
  matches: MatchInterclan[];
  validation: ValidationInterclan | null;
  viewer: SpectateurInterclan | null;
}

export interface MessageDiscord {
  content?: string;
  embeds?: Array<Record<string, unknown>>;
  components?: Array<Record<string, unknown>>;
}

const secondes = (d: DateApi) => Math.floor(new Date(d).getTime() / 1000);
/** Horodatage Discord : affiché dans le fuseau du LECTEUR. */
export const quand = (d: DateApi, style = "F") => `<t:${secondes(d)}:${style}>`;

export function compositionDe(detail: DetailInterclan, cote: 0 | 1): CompositionInterclan | null {
  const clanId = cote === 0 ? detail.clanA.id : detail.clanB.id;
  return detail.lineups.find(l => l.clanId === clanId) ?? null;
}

function statutComposition(l: CompositionInterclan | null): string {
  if (!l) return "❌ Invalide";
  if (l.lockedIn && l.valid) return "🔒 Verrouillée";
  if (l.valid) return "✅ Valide";
  return `❌ Invalide (${l.members.length}/${TAILLE_COMPOSITION})`;
}

function bouton(
  label: string,
  style: 1 | 2 | 3 | 4,
  customId: string,
  options: { emoji?: { name: string; id?: string }; disabled?: boolean } = {},
) {
  return {
    type: 2,
    label: label.slice(0, 80),
    style,
    custom_id: customId,
    ...(options.emoji ? { emoji: options.emoji } : {}),
    ...(options.disabled ? { disabled: true } : {}),
  };
}
const rangee = (...composants: Array<Record<string, unknown>>) => ({ type: 1, components: composants });

/** Émoji de clan utilisable dans un bouton, ou `undefined` si le clan n'en a pas. */
function emojiClan(clan: ClanInterclan): { name: string; id: string } | undefined {
  return clan.emojiId && /^\d{5,25}$/u.test(clan.emojiId)
    ? { name: clan.normalizedShortName.replace(/[^A-Za-z0-9_]/gu, "").slice(0, 32) || "clan", id: clan.emojiId }
    : undefined;
}

/** Deux boutons Accepter / Refuser, `<cible>:<id>:1|0` (legacy `buildDedicatedApproveDenyButtons`). */
export function boutonsAccepterRefuser(cible: string, id: number | string) {
  return rangee(
    bouton("Accepter", 3, `${cible}:${id}:1`, { emoji: { name: "✅" } }),
    bouton("Refuser", 4, `${cible}:${id}:0`, { emoji: { name: "✖️" } }),
  );
}

// ─── Défi ───────────────────────────────────────────────────────────────────

export function embedDefi(detail: DetailInterclan, proposeur: string): Record<string, unknown> {
  const expire = new Date(new Date(detail.createdAt).getTime() + 24 * 60 * 60 * 1000);
  return {
    color: COULEURS_INTERCLAN.defi,
    title: `${detail.name} - Proposition d'Interclan`,
    description: `Vous êtes défié à un Interclan par le clan ${detail.clanA.name} !\nMotif : ${detail.description}`,
    ...(/^https?:\/\//u.test(detail.clanA.avatarUrl) ? { thumbnail: { url: detail.clanA.avatarUrl } } : {}),
    fields: [
      { name: "Proposé par", value: proposeur, inline: true },
      { name: "Clan rival", value: detail.clanA.name, inline: true },
      { name: "Date proposée", value: quand(detail.fixedDate), inline: true },
      { name: "Expire le", value: quand(expire), inline: true },
    ],
  };
}

/** Message posté dans le salon du clan défié : mentions de ses dirigeants + boutons de réponse. */
export function messageDefi(detail: DetailInterclan, proposeurId: string, dirigeants: readonly string[]): MessageDiscord {
  const mentions = dirigeants.map(id => `<@${id}>`).join(", ");
  return {
    content: `${mentions}\n<@${proposeurId}> du clan ${detail.clanA.name} vous défie ! Acceptez-vous ?`.trim(),
    embeds: [embedDefi(detail, `<@${proposeurId}>`)],
    components: [boutonsAccepterRefuser("interclan_approval", detail.id)],
  };
}

// ─── Compositions ───────────────────────────────────────────────────────────

export function embedRecap(detail: DetailInterclan): Record<string, unknown> {
  const fields = [
    { name: "Clan challenger", value: detail.clanA.name, inline: true },
    { name: "Clan défié", value: detail.clanB.name, inline: true },
    { name: "État", value: LIBELLES_ETAT[detail.state] ?? String(detail.state), inline: true },
    { name: "Initié le", value: quand(detail.createdAt), inline: true },
    { name: "Débute le", value: quand(detail.fixedDate), inline: true },
    { name: "​", value: "​", inline: true },
    { name: `Lineup ${detail.clanA.shortName}`, value: statutComposition(compositionDe(detail, 0)), inline: true },
    { name: `Lineup ${detail.clanB.shortName}`, value: statutComposition(compositionDe(detail, 1)), inline: true },
    { name: "​", value: "​", inline: true },
  ];
  if (detail.description) fields.push({ name: "Motif", value: detail.description.slice(0, 1024), inline: false });
  return {
    color: COULEURS_INTERCLAN.recap,
    title: `🏆 Interclan — ${detail.name}`,
    description:
      "Voici le récapitulatif de l'Interclan à venir. Chaque clan saisit 5 joueurs, puis verrouille sa lineup dans l'heure qui précède la rencontre.",
    fields,
    timestamp: new Date().toISOString(),
  };
}

/** Boutons de composition (legacy `buildLineupsButtons`). */
export function boutonsCompositions(detail: DetailInterclan) {
  const a = compositionDe(detail, 0);
  const b = compositionDe(detail, 1);
  const valideA = a?.valid ?? false;
  const valideB = b?.valid ?? false;
  const verrouA = a?.lockedIn ?? false;
  const verrouB = b?.lockedIn ?? false;
  const emojiA = emojiClan(detail.clanA);
  const emojiB = emojiClan(detail.clanB);
  return rangee(
    bouton(`Lineup ${detail.clanA.name}`, valideA ? 3 : 4, `interclan_lineup:${detail.id}:0`, {
      ...(emojiA ? { emoji: emojiA } : {}),
      disabled: verrouA,
    }),
    bouton("Verrouiller", 1, `lock_interclan_lineup:${detail.id}:0`, { emoji: { name: "🔒" }, disabled: !valideA || verrouA }),
    bouton(`Lineup ${detail.clanB.name}`, valideB ? 3 : 4, `interclan_lineup:${detail.id}:1`, {
      ...(emojiB ? { emoji: emojiB } : {}),
      disabled: verrouB,
    }),
    bouton("Verrouiller", 1, `lock_interclan_lineup:${detail.id}:1`, { emoji: { name: "🔒" }, disabled: !valideB || verrouB }),
    bouton("Annuler", 4, `cancel_interclan:${detail.id}`, { emoji: { name: "❌" } }),
  );
}

function listeJoueurs(l: CompositionInterclan | null): string {
  const lignes = (l?.members ?? [])
    .toSorted((x, y) => x.position - y.position)
    .map(m => `**${m.position}.** ${m.displayName}`);
  return lignes.join("\n") || "*Aucun joueur*";
}

/** Composition d'un clan après mise à jour (legacy `interclanRecapLineupEmbed`). */
export function embedComposition(detail: DetailInterclan, clanId: number): Record<string, unknown> {
  const clan = clanId === detail.clanA.id ? detail.clanA : detail.clanB;
  const l = detail.lineups.find(x => x.clanId === clanId) ?? null;
  return {
    color: COULEURS_INTERCLAN.succes,
    title: `${clan.shortName} - Mise à jour de la lineup`,
    fields: [{ name: "Lineup", value: listeJoueurs(l) }],
    timestamp: new Date().toISOString(),
  };
}

export function embedVerrouille(detail: DetailInterclan): Record<string, unknown> {
  const a = compositionDe(detail, 0);
  const b = compositionDe(detail, 1);
  return {
    color: COULEURS_INTERCLAN.verrouille,
    title: `🏆 Interclan confirmé — ${detail.clanA.name} vs ${detail.clanB.name}`,
    description: `**Date prévue :** ${quand(detail.fixedDate)}\nLes deux clans ont verrouillé leur lineup.`,
    fields: [
      { name: detail.clanA.name, value: listeJoueurs(a), inline: true },
      { name: "-", value: (b?.members ?? []).map(() => "VS").join("\n") || "​", inline: true },
      { name: detail.clanB.name, value: listeJoueurs(b), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };
}

export function boutonsLancement(detail: DetailInterclan) {
  return rangee(
    bouton("Commencer", 3, `start_interclan:${detail.id}`, { emoji: { name: "⚽" } }),
    bouton("Annuler", 4, `cancel_interclan:${detail.id}`, { emoji: { name: "❌" } }),
  );
}

// ─── Matchs et scores ───────────────────────────────────────────────────────

/** Scores d'un match : équipe 1 = clan A, équipe 2 = clan B. */
export function scoresDuMatch(m: MatchInterclan): { scoreA: number; scoreB: number; joueurA: JoueurMatch | null; joueurB: JoueurMatch | null } {
  const joueurA = m.players.find(p => p.team === 1) ?? null;
  const joueurB = m.players.find(p => p.team === 2) ?? null;
  return { scoreA: joueurA?.score ?? 0, scoreB: joueurB?.score ?? 0, joueurA, joueurB };
}

function tableauScores(detail: DetailInterclan) {
  const matchs = detail.matches.toSorted((x, y) => x.id - y.id);
  const lignes = matchs.map((m, i) => {
    const s = scoresDuMatch(m);
    const fini = m.state === "Finished";
    return {
      a: `**${i + 1}.** ${s.joueurA?.displayName ?? "—"}`,
      vs: fini ? `${s.scoreA} — ${s.scoreB}` : "⏳",
      b: s.joueurB?.displayName ?? "—",
    };
  });
  return [
    { name: detail.clanA.name, value: lignes.map(l => l.a).join("\n") || "*Aucun joueur*", inline: true },
    { name: "Score", value: lignes.map(l => l.vs).join("\n") || "​", inline: true },
    { name: detail.clanB.name, value: lignes.map(l => l.b).join("\n") || "*Aucun joueur*", inline: true },
  ];
}

export function embedScores(detail: DetailInterclan): Record<string, unknown> {
  const enCours = detail.state === ETAT.EN_COURS;
  const fields = tableauScores(detail);
  if (!enCours) {
    const total = calculerVainqueur(
      detail.matches.filter(m => m.state === "Finished").map(scoresDuMatch),
      detail.clanA.id,
      detail.clanB.id,
    );
    fields.push({ name: "Bilan", value: `${detail.clanA.shortName} ${total.pointsA} — ${total.pointsB} ${detail.clanB.shortName}`, inline: false });
  }
  return {
    color: COULEURS_INTERCLAN.scores,
    title: `🏆 Interclan — ${detail.clanA.name} vs ${detail.clanB.name}`,
    description:
      `**Dernière mise à jour :** ${quand(detail.updatedAt)}\n` +
      (enCours ? "Les matchs sont en cours. Voici les scores actuels :" : "Interclan terminé, voici les résultats finaux :"),
    fields,
    timestamp: new Date().toISOString(),
  };
}

/** Un bouton par match, désactivé une fois le score saisi (legacy `buildInterclanMatchButtons`). */
export function boutonsMatchs(detail: DetailInterclan) {
  const matchs = detail.matches.toSorted((x, y) => x.id - y.id).slice(0, 5);
  return rangee(
    ...matchs.map((m, i) => {
      const fini = m.state === "Finished";
      return bouton(fini ? `Match ${i + 1} — Terminé` : `Match ${i + 1}`, fini ? 2 : 1, `interclan_match:${detail.id}:${m.id}`, {
        emoji: { name: fini ? "✅" : "⚽" },
        disabled: fini,
      });
    }),
  );
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function embedVote(detail: DetailInterclan): Record<string, unknown> {
  const v = detail.validation;
  const fields: Array<{ name: string; value: string; inline?: boolean }> = tableauScores(detail);
  if (v) {
    const votes = v.approvals + v.rejections;
    const requis = Math.ceil(v.eligible * v.minParticipationRatio);
    const pct = (n: number) => (votes > 0 ? Math.round((n / votes) * 100) : 0);
    fields.push(
      { name: "Requis", value: `${requis}/${v.eligible} (${Math.round(v.minParticipationRatio * 100)}%)`, inline: true },
      { name: "Pour", value: `✅ ${v.approvals}/${votes} (${pct(v.approvals)}%)`, inline: true },
      { name: "Contre", value: `❌ ${v.rejections}/${votes} (${pct(v.rejections)}%)`, inline: true },
      v.closedAt
        ? {
            name: `Vote clôturé ${quand(v.closedAt, "R")}`,
            value: `__*Issue du vote :* ${v.status === "APPROVED" ? "Approuvé" : v.status === "EXPIRED" ? "Expiré" : "Rejeté"}__`,
          }
        : { name: "Fin du vote", value: quand(v.expiresAt) },
    );
  }
  const titres: Record<string, string> = {
    PENDING: "🗳️ Vote en cours",
    EXPIRED: "🕛 Expirée",
    APPROVED: "✅ Approuvée",
    REJECTED: "❌ Refusée",
  };
  return {
    color: COULEURS_INTERCLAN.vote,
    title: `${titres[v?.status ?? "PENDING"] ?? "🗳️ Vote"} - Validation Interclan ${detail.name}`,
    description: "Tous les joueurs alignés doivent approuver les scores (unanimité, 24 h).",
    fields,
  };
}

export function boutonsVote(proposalId: number) {
  return rangee(bouton("Approuver", 3, `vote:approve:${proposalId}`), bouton("Rejeter", 4, `vote:reject:${proposalId}`));
}

export function messageVote(detail: DetailInterclan): MessageDiscord {
  return {
    content: `<@&${detail.clanA.roleId}> <@&${detail.clanB.roleId}>`,
    embeds: [embedVote(detail)],
    components: detail.validation && detail.validation.status === "PENDING" ? [boutonsVote(detail.validation.proposalId)] : [],
  };
}

// ─── Vue selon l'état ───────────────────────────────────────────────────────

/** Le message qui décrit l'interclan dans son état courant, boutons d'action compris. */
export function messagePourEtat(detail: DetailInterclan): MessageDiscord {
  switch (detail.state) {
    case ETAT.EN_ATTENTE: {
      return { embeds: [embedDefi(detail, detail.clanA.name)], components: [boutonsAccepterRefuser("interclan_approval", detail.id)] };
    }
    case ETAT.ACCEPTE: {
      return { embeds: [embedRecap(detail)], components: [boutonsCompositions(detail)] };
    }
    case ETAT.PRET: {
      return { embeds: [embedVerrouille(detail)], components: [boutonsLancement(detail)] };
    }
    case ETAT.EN_COURS: {
      return { embeds: [embedScores(detail)], components: detail.matches.length > 0 ? [boutonsMatchs(detail)] : [] };
    }
    case ETAT.TERMINE:
    case ETAT.RESULTAT_CONTESTE: {
      return detail.validation ? messageVote(detail) : { embeds: [embedScores(detail)], components: [] };
    }
    case ETAT.RESULTAT_VALIDE: {
      return { embeds: [embedScores(detail)], components: [] };
    }
    default: {
      return { embeds: [embedRecap(detail)], components: [] };
    }
  }
}

/** Message posté dans le salon de l'interclan à son ouverture. */
export function messageOuverture(detail: DetailInterclan): MessageDiscord {
  return {
    content: `<@&${detail.clanA.roleId}> <@&${detail.clanB.roleId}>`,
    embeds: [embedRecap(detail)],
    components: [boutonsCompositions(detail)],
  };
}

export const embedSucces = (message: string) => ({ color: COULEURS_INTERCLAN.succes, title: `✅ ${message}`.slice(0, 256) });
export const embedErreur = (message: string) => ({ color: COULEURS_INTERCLAN.erreur, title: `❌ ${message}`.slice(0, 256) });

// ─── Fenêtres ───────────────────────────────────────────────────────────────

/** Fenêtre de composition : 5 champs `lineup_member_1..5` pré-remplis (legacy `buildLineupManagementModal`). */
export function fenetreComposition(detail: DetailInterclan, cote: 0 | 1): Record<string, unknown> {
  const clan = cote === 0 ? detail.clanA : detail.clanB;
  const l = compositionDe(detail, cote);
  const champs = Array.from({ length: TAILLE_COMPOSITION }, (_, i) => {
    const membre = l?.members.find(m => m.position === i + 1);
    return rangee({
      type: 4,
      custom_id: `lineup_member_${i + 1}`,
      label: `Joueur ${i + 1}${membre ? ` (${membre.displayName})` : ""}`.slice(0, 45),
      style: 1,
      min_length: 17,
      max_length: 20,
      required: false,
      ...(membre ? { value: membre.userId } : { placeholder: "Identifiant Discord du joueur" }),
    });
  });
  return {
    custom_id: `lineup_manager_modal:${clan.id}:${detail.id}`,
    title: `Gestion de la lineup ${clan.name}`.slice(0, 45),
    components: champs,
  };
}

/** Fenêtre de score d'un match : `score_a` / `score_b` (legacy `buildInterclanMatchScoreModal`). */
export function fenetreScore(m: MatchInterclan): Record<string, unknown> | null {
  const s = scoresDuMatch(m);
  if (!s.joueurA || !s.joueurB) return null;
  const champ = (id: string, label: string, valeur: number) =>
    rangee({ type: 4, custom_id: id, label: label.slice(0, 45), style: 1, min_length: 1, max_length: 2, required: true, value: String(valeur) });
  return {
    custom_id: `interclan_match_result_modal:${m.id}`,
    title: `Résultat du match #${m.id}`.slice(0, 45),
    components: [champ("score_a", s.joueurA.displayName, s.scoreA), champ("score_b", s.joueurB.displayName, s.scoreB)],
  };
}

/** Une composition est-elle complète ? Ré-exporté pour les appelants qui n'importent que ce module. */
export { compositionValide };
