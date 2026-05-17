import { type ArgsOf, Discord, On } from "@rpbey/discordx";
import type { Client } from "discord.js";

import { syncOneMember, syncOneUser } from "../services/syncMembers.ts";
import { GUILD_ID } from "../lib/config.ts";

@Discord()
export class MemberEvents {
  @On({ event: "guildMemberAdd" })
  async onAdd([member]: ArgsOf<"guildMemberAdd">) {
    if (member.guild.id !== GUILD_ID) return;
    await syncOneMember(member).catch((err) => console.error("[guildMemberAdd] failed:", err));
  }

  @On({ event: "guildMemberUpdate" })
  async onUpdate([_, after]: ArgsOf<"guildMemberUpdate">) {
    if (after.guild.id !== GUILD_ID) return;
    await syncOneMember(after).catch((err) => console.error("[guildMemberUpdate] failed:", err));
  }

  @On({ event: "userUpdate" })
  async onUserUpdate([_, after]: ArgsOf<"userUpdate">, client: Client) {
    if (!GUILD_ID) return;
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;
    await syncOneUser(after, guild).catch((err) => console.error("[userUpdate] failed:", err));
  }
}
