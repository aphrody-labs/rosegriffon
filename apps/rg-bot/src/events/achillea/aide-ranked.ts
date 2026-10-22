/**
 * Vocal « 🛑・Aide Ranked » : prévenir les Tournament Organizers qu'un joueur attend.
 *
 * Porté de `legacy/achillea-bot/src/events/ranked-help-voice.ts`. Lecture et
 * écriture purement Discord (un état vocal, un message de salon) : aucune
 * donnée métier, donc pas d'appel à l'API.
 *
 * ⚠ L'évènement `voiceStateUpdate` n'est livré qu'avec l'intent
 * `GuildVoiceStates` (non privilégié) dans le profil Achilléa.
 *
 * Les salons viennent de l'environnement, avec repli sur les valeurs de
 * production de l'ancien bot (`configs/general.ts`) :
 *   - `ACHILLEA_HELP_RANKED_VOICE_ID` : le vocal d'aide ;
 *   - `ACHILLEA_TO_CHANNEL_ID` : `⚙🎮〡discussion-to`, salon des organisateurs.
 */
import { Discord, On, type ArgsOf } from "discordx";

export const VOCAL_AIDE_RANKED_DEFAUT = "1398801498598539356";
export const SALON_TO_DEFAUT = "1436378680153608203";

/** Anti-rafale : un même joueur ne déclenche qu'une alerte par fenêtre. */
export const FENETRE_ALERTE_MS = 2 * 60 * 1000;

function lire(env: Record<string, string | undefined>, cle: string, defaut: string): string {
  const v = (env[cle] ?? "").trim();
  return /^\d{15,25}$/u.test(v) ? v : defaut;
}

export function salonsAideRanked(env: Record<string, string | undefined> = Bun.env): { vocal: string; to: string } {
  return {
    vocal: lire(env, "ACHILLEA_HELP_RANKED_VOICE_ID", VOCAL_AIDE_RANKED_DEFAUT),
    to: lire(env, "ACHILLEA_TO_CHANNEL_ID", SALON_TO_DEFAUT),
  };
}

/** Vrai pour une ENTRÉE dans le vocal d'aide (ni un départ, ni un mute, ni un déplacement interne). */
export function estEntreeDansAide(avant: string | null, apres: string | null, vocal: string): boolean {
  return apres === vocal && avant !== vocal;
}

export function messageAlerte(membreId: string): string {
  return `🔔 <@${membreId}> vient de rejoindre le vocal **Aide Ranked** — assistance / arbitrage demandé.`;
}

const dernieresAlertes = new Map<string, number>();

/** Décide d'alerter (et mémorise), en tenant compte de l'anti-rafale. */
export function doitAlerter(membreId: string, maintenant = Date.now()): boolean {
  const derniere = dernieresAlertes.get(membreId);
  if (derniere !== undefined && maintenant - derniere < FENETRE_ALERTE_MS) return false;
  dernieresAlertes.set(membreId, maintenant);
  for (const [id, t] of dernieresAlertes) if (maintenant - t > FENETRE_ALERTE_MS) dernieresAlertes.delete(id);
  return true;
}

export function oublierAlertes(): void {
  dernieresAlertes.clear();
}

@Discord()
export class EvenementAideRanked {
  @On({ event: "voiceStateUpdate" })
  async etatVocal([avant, apres]: ArgsOf<"voiceStateUpdate">): Promise<void> {
    const { vocal, to } = salonsAideRanked();
    if (!estEntreeDansAide(avant.channelId, apres.channelId, vocal)) return;
    if (apres.member?.user.bot) return;
    if (!doitAlerter(apres.id)) return;
    const salon = await apres.client.channels.fetch(to).catch(() => null);
    if (!salon || !salon.isSendable()) {
      console.warn(`[achillea/aide-ranked] salon des TO ${to} introuvable ou non inscriptible.`);
      return;
    }
    await salon
      .send({ content: messageAlerte(apres.id), allowedMentions: { users: [apres.id] } })
      .catch((err: unknown) => console.error("[achillea/aide-ranked] alerte TO :", err instanceof Error ? err.message : err));
  }
}
