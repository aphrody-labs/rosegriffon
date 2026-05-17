import { Discord, Once } from "@rpbey/discordx";
import type { Client } from "discord.js";

import { syncAllMembers } from "../services/syncMembers.ts";
import { syncStaffPhotos } from "../services/teamPhotos.ts";
import { GUILD_ID, SYNC_INTERVAL_MS } from "../lib/config.ts";

@Discord()
export class ReadyEvent {
  @Once({ event: "ready" })
  async ready([client]: [Client]) {
    console.log(`✓ Ready as ${client.user?.tag} — ${client.guilds.cache.size} guild(s)`);

    if (!GUILD_ID) {
      console.warn("⚠ GUILD_ID not set — skipping member sync");
      return;
    }

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.warn(`⚠ Bot is not in guild ${GUILD_ID}`);
      return;
    }

    await this.runSync(guild.id, client);
    setInterval(() => {
      void this.runSync(guild.id, client);
    }, SYNC_INTERVAL_MS);
  }

  private async runSync(guildId: string, client: Client): Promise<void> {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    try {
      const report = await syncAllMembers(guild);
      console.log(
        `[sync] ${report.upserted}/${report.fetched} members upserted in ${report.durationMs}ms` +
          (report.errors.length ? ` — ${report.errors.length} error(s)` : ""),
      );
      for (const e of report.errors.slice(0, 5)) {
        console.error(`  ✗ ${e.discordId}: ${e.reason}`);
      }
    } catch (err) {
      console.error("[sync] failed:", err);
    }

    // Sync ciblé staff (team_members) — propage avatar vers 3 tables
    try {
      const photos = await syncStaffPhotos(client);
      console.log(
        `[staff-photos] ${photos.updated}/${photos.total} updated, ${photos.unchanged} unchanged in ${photos.durationMs}ms` +
          (photos.errors.length ? ` — ${photos.errors.length} error(s)` : ""),
      );
      for (const e of photos.errors.slice(0, 3)) {
        console.error(`  ✗ ${e.name}: ${e.reason}`);
      }
    } catch (err) {
      console.error("[staff-photos] failed:", err);
    }
  }
}
