/**
 * `/website` et `/ping` — lien du site et diagnostic du bot Achilléa.
 *
 * `/ping` ne fait plus de `SELECT 1` direct : la base se mesure à travers
 * l'API (`GET /bot/maintenance` lit l'état en Postgres), le serveur ranked par
 * `GET /health`. Le diagnostic décrit donc ce que voit un joueur : la chaîne
 * Discord → bot → API → base, maillon par maillon.
 */
import { Discord, Slash, SlashOption } from "discordx";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";

import { lireApi, urlAchillea } from "../../lib/achillea-ui";
import { fiche, formaterDuree, formaterOctets, piedDeCommande } from "../../lib/ui";

export interface Controle {
  nom: string;
  ok: boolean;
  valeur: string;
  latenceMs: number | null;
  detail?: string;
}

export function pastille(controle: Pick<Controle, "ok" | "latenceMs">): string {
  if (!controle.ok) return "🔴";
  if (controle.latenceMs === null) return "⚪";
  if (controle.latenceMs < 50) return "🟢";
  if (controle.latenceMs < 200) return "🟡";
  return "🟠";
}

export function ligneControle(controle: Controle): string {
  return `${pastille(controle)} **${controle.nom}** : \`${controle.valeur}\`${controle.detail ? ` — ${controle.detail}` : ""}`;
}

/** Mesure un appel API sans rien afficher. */
async function mesurer(
  nom: string,
  detail: string,
  appel: () => Promise<{ ok: true } | { ok: false; motif: string }>,
): Promise<Controle> {
  const debut = performance.now();
  const resultat = await appel();
  const latence = Math.round(performance.now() - debut);
  return resultat.ok
    ? { nom, ok: true, valeur: `${latence} ms`, latenceMs: latence, detail }
    : { nom, ok: false, valeur: "KO", latenceMs: null, detail: resultat.motif.slice(0, 120) };
}

@Discord()
export class CommandesGenerales {
  @Slash({ name: "website", description: "Envoie le lien vers le site web d'Achilléa" })
  async website(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({ content: `Le site web d'Achilléa est joignable à l'adresse suivante : ${urlAchillea("/")}` });
  }

  @Slash({ name: "ping", description: "Diagnostic complet du bot (Discord, API, base, ranked, mémoire, uptime)" })
  async ping(
    @SlashOption({
      name: "public",
      description: "Afficher publiquement (défaut : visible que par toi)",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    publique: boolean | undefined,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const debut = Date.now();
    await interaction.deferReply(publique ? {} : { flags: MessageFlags.Ephemeral });

    const ws = interaction.client.ws.ping;
    const controles: Controle[] = [
      {
        nom: "Discord WS",
        ok: ws >= 0 && ws < 5000,
        valeur: `${ws} ms`,
        latenceMs: ws >= 0 ? ws : null,
        detail: interaction.client.ws.status === 0 ? "Ready" : `status=${interaction.client.ws.status}`,
      },
      {
        nom: "Interaction RTT",
        ok: debut - interaction.createdTimestamp < 3000,
        valeur: `${debut - interaction.createdTimestamp} ms`,
        latenceMs: debut - interaction.createdTimestamp,
      },
    ];
    const [api, ranked] = await Promise.all([
      mesurer("API + PostgreSQL", "GET /bot/maintenance", () => lireApi(interaction, c => c.admin.botMaintenance())),
      mesurer("Ranked", "GET /health", () => lireApi(interaction, c => c.admin.apiHealth())),
    ]);
    controles.push(api, ranked);

    const memoire = process.memoryUsage();
    const toutVa = controles.every(c => c.ok);
    const embed = fiche({
      intention: toutVa ? "succes" : "attention",
      icone: "🏓",
      titre: "Pong — Achilléa Bot",
      description: toutVa ? "🟢 Tous systèmes opérationnels" : "🟠 Dégradé",
    })
      .champ("Connectivité", controles.map(ligneControle).join("\n"))
      .champ(
        "Process",
        [
          `⏱️ Uptime : \`${formaterDuree(process.uptime() * 1000)}\``,
          `💾 RSS : \`${formaterOctets(memoire.rss)}\``,
          `🧠 Heap : \`${formaterOctets(memoire.heapUsed)} / ${formaterOctets(memoire.heapTotal)}\``,
          `📦 Bun : \`v${Bun.version}\``,
        ].join("\n"),
        { enLigne: true },
      )
      .champ(
        "Discord",
        [
          `🏛️ Guilds : \`${interaction.client.guilds.cache.size}\``,
          `👥 Users (cache) : \`${interaction.client.users.cache.size}\``,
          `🤖 Tag : \`${interaction.client.user?.tag ?? "—"}\``,
          `🆔 Shard : \`${interaction.guild?.shardId ?? 0}\``,
        ].join("\n"),
        { enLigne: true },
      )
      .finir();
    await interaction.editReply({
      embeds: [piedDeCommande(embed, interaction, { note: `Latence totale : ${Date.now() - debut} ms` })],
    });
  }
}
