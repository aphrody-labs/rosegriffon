/**
 * Relevé multi-serveurs du bot Achilléa : guildes, rôles et salons.
 *
 * POURQUOI UNE TÂCHE DISTINCTE DE `sync:achillea`
 * `sync:achillea` recopie ce que le bot Rose Griffon voit, et il ne voit qu'un
 * serveur Achilléa. Le bot Achilléa, lui, est une AUTRE application Discord,
 * invitée sur des dizaines de serveurs de la communauté (tournois, clans,
 * ligues). Ce sont ces serveurs que le back-office liste (`/v1/achillea/guilds`,
 * onglet « Guildes »), et seul le jeton de cette application peut les lire.
 * Ils avaient été relevés une seule fois, le 8 septembre 2026, par un script
 * manuel de l'ancien bot (`legacy/achillea-bot/scripts/sync-discord-production.ts`) ;
 * cette tâche le remplace et le planifie.
 *
 * CE QU'ELLE NE FAIT PAS
 * Elle ne relève pas les membres : 18 000 comptes à chaque passage pour une
 * donnée que `sync:achillea` tient déjà pour le serveur qui compte. Elle ne
 * supprime aucune ligne : une guilde quittée passe à `deleted = true`, ses
 * rôles et salons restent comme dernier état connu.
 */

import { sql } from "../lib/db.js";
import { appelDiscord, appelDiscordOuNull } from "../lib/discord-rest.js";

export interface ResultatGuildesAchillea {
  success: boolean;
  guildes?: number;
  roles?: number;
  salons?: number;
  /** Guildes passées à `deleted` parce que le bot n'y est plus. */
  quittees?: number;
  /** Guildes dont le relevé a échoué (identifiant et motif). */
  echecs?: string[];
  error?: string;
}

interface GuildePartielle {
  id: string;
  name: string;
}

interface GuildeDetail {
  id: string;
  name: string;
  icon: string | null;
  banner: string | null;
  owner_id: string;
  description: string | null;
  features?: string[];
  premium_tier?: number;
  verification_level?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

interface RoleDiscord {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  hoist: boolean;
  managed: boolean;
  mentionable: boolean;
}

interface SalonDiscord {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  topic?: string | null;
  nsfw?: boolean;
}

/** Jeton de l'application Achilléa — jamais celui du bot Rose Griffon. */
export function jetonAchillea(env: Record<string, string | undefined> = Bun.env): string | null {
  const jeton = (env.ACHILLEA_DISCORD_BOT_TOKEN ?? "").trim();
  return jeton === "" ? null : jeton;
}

/** URL CDN d'une icône ou bannière, animée si le hachage l'indique. */
export function urlCdn(type: "icons" | "banners", id: string, hachage: string | null): string | null {
  if (!hachage) return null;
  const extension = hachage.startsWith("a_") ? "gif" : "webp";
  return `https://cdn.discordapp.com/${type}/${id}/${hachage}.${extension}?size=512`;
}

/** Toutes les guildes du bot, page par page (200 par page côté Discord). */
async function listerGuildes(jeton: string): Promise<GuildePartielle[]> {
  const toutes: GuildePartielle[] = [];
  let apres = "0";
  for (;;) {
    const page = await appelDiscord<GuildePartielle[]>(`/users/@me/guilds?limit=200&after=${apres}`, 0, jeton);
    toutes.push(...page);
    if (page.length < 200) return toutes;
    apres = page.at(-1)!.id;
  }
}

async function releverGuilde(jeton: string, id: string): Promise<{ roles: number; salons: number }> {
  const [detail, roles, salons] = await Promise.all([
    appelDiscord<GuildeDetail>(`/guilds/${id}?with_counts=true`, 0, jeton),
    appelDiscord<RoleDiscord[]>(`/guilds/${id}/roles`, 0, jeton),
    // Un serveur peut retirer au bot la vue des salons : la guilde reste relevée.
    appelDiscordOuNull<SalonDiscord[]>(`/guilds/${id}/channels`, jeton).then(s => s ?? []),
  ]);

  await sql.begin(async tx => {
    // Mêmes politiques RLS que `sync:achillea` : écriture via `service_role`.
    // Les tableaux passent en JSON (Bun.SQL ne produit pas de littéral de tableau
    // Postgres, cf. `diagnostiquerSalons` dans `tasks/campagnes-discord.ts`).
    await tx`SET LOCAL ROLE service_role`;
    await tx`
      INSERT INTO achillea.guild (
        id, created_at, updated_at, last_interact, deleted, ranked_enabled,
        name, icon, banner, owner_id, member_count, presence_count, features,
        premium_tier, verification_level, description, scanned_at
      ) VALUES (
        ${detail.id}, now(), now(), now(), false, false,
        ${detail.name}, ${urlCdn("icons", detail.id, detail.icon)}, ${urlCdn("banners", detail.id, detail.banner)},
        ${detail.owner_id}, ${detail.approximate_member_count ?? null}, ${detail.approximate_presence_count ?? null},
        ARRAY(SELECT jsonb_array_elements_text(${detail.features ?? []}::jsonb)), ${detail.premium_tier ?? 0}, ${detail.verification_level ?? 0},
        ${detail.description ?? null}, now()
      )
      ON CONFLICT (id) DO UPDATE SET
        deleted = false, updated_at = now(), name = EXCLUDED.name, icon = EXCLUDED.icon,
        banner = EXCLUDED.banner, owner_id = EXCLUDED.owner_id, member_count = EXCLUDED.member_count,
        presence_count = EXCLUDED.presence_count, features = EXCLUDED.features,
        premium_tier = EXCLUDED.premium_tier, verification_level = EXCLUDED.verification_level,
        description = EXCLUDED.description, scanned_at = now()`;

    for (const role of roles) {
      await tx`
        INSERT INTO achillea.guild_role (id, guild_id, name, color, position, permissions, hoist, managed, mentionable, scanned_at)
        VALUES (${role.id}, ${detail.id}, ${role.name}, ${role.color}, ${role.position}, ${role.permissions},
                ${role.hoist}, ${role.managed}, ${role.mentionable}, now())
        ON CONFLICT (id) DO UPDATE SET
          guild_id = EXCLUDED.guild_id, name = EXCLUDED.name, color = EXCLUDED.color, position = EXCLUDED.position,
          permissions = EXCLUDED.permissions, hoist = EXCLUDED.hoist, managed = EXCLUDED.managed,
          mentionable = EXCLUDED.mentionable, scanned_at = now()`;
    }
    for (const salon of salons) {
      await tx`
        INSERT INTO achillea.guild_channel (id, guild_id, name, type, parent_id, position, topic, nsfw, scanned_at)
        VALUES (${salon.id}, ${detail.id}, ${salon.name}, ${salon.type}, ${salon.parent_id ?? null},
                ${salon.position ?? null}, ${salon.topic ?? null}, ${salon.nsfw ?? false}, now())
        ON CONFLICT (id) DO UPDATE SET
          guild_id = EXCLUDED.guild_id, name = EXCLUDED.name, type = EXCLUDED.type, parent_id = EXCLUDED.parent_id,
          position = EXCLUDED.position, topic = EXCLUDED.topic, nsfw = EXCLUDED.nsfw, scanned_at = now()`;
    }
  });
  return { roles: roles.length, salons: salons.length };
}

export async function runAchilleaGuildes(): Promise<ResultatGuildesAchillea> {
  const jeton = jetonAchillea();
  if (!jeton) {
    return { success: false, error: "ACHILLEA_DISCORD_BOT_TOKEN absent : aucun serveur du bot Achilléa à relever." };
  }
  try {
    const guildes = await listerGuildes(jeton);
    let roles = 0;
    let salons = 0;
    const echecs: string[] = [];
    // Séquentiel : trois appels par guilde suffisent à approcher la limite de
    // débit globale ; `appelDiscord` attend le `retry_after` si on la touche.
    for (const guilde of guildes) {
      try {
        const compte = await releverGuilde(jeton, guilde.id);
        roles += compte.roles;
        salons += compte.salons;
      } catch (err) {
        echecs.push(`${guilde.id} (${guilde.name}) : ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const presentes = guildes.map(g => g.id);
    const quittees = await sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      const lignes = await tx`
        UPDATE achillea.guild SET deleted = true, updated_at = now()
         WHERE deleted = false AND name IS NOT NULL AND id NOT IN (SELECT jsonb_array_elements_text(${presentes}::jsonb))
        RETURNING id`;
      return lignes.length;
    });

    return {
      // Un serveur illisible n'invalide pas le relevé des autres ; tout perdre en est un échec.
      success: echecs.length < guildes.length || guildes.length === 0,
      guildes: guildes.length,
      roles,
      salons,
      quittees,
      ...(echecs.length > 0 ? { echecs } : {}),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
