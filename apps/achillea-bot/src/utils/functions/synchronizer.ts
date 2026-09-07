import type { User as DUser } from "discord.js";
import { GuildMember } from "discord.js";
import type { Client } from "@aphrody/discordx";

import { Guild, User, UserElo, UserExperience } from "@/entities";
import { Database, Logger, Stats } from "@/services";
import {
	freshDiscordAvatarUrl,
	normalizeNames,
	resolveDependencies,
	resolveDependency,
} from "@/utils/functions";

import { MatchMode } from "../enums";

/**
 * Ajoute un user Discord en base s'il n'existe pas, sinon **rafraîchit**
 * username / displayName / avatar (les URLs CDN Discord expirent au changement d'avatar).
 */
export async function syncUser(user: DUser) {
	const [db, stats, logger] = await resolveDependencies([Database, Stats, Logger]);

	const userRepo = db.get(User);

	const userData = await userRepo.findOne({
		id: user.id,
	});

	const discordUser = user instanceof GuildMember ? user.user : user;
	const avatarUrl = freshDiscordAvatarUrl(discordUser);
	// `username`/`displayName` sont NOT NULL en base. Discord.js peut renvoyer un
	// objet partiellement patché (payload API avec des champs qu'il ne connaît pas
	// encore, ex. collectibles/avatar_decoration_data) où `globalName` est absent
	// sans que `username` le soit — on ne laisse jamais une valeur vide écraser la
	// colonne : fallback sur `username`, puis sur l'ancienne valeur en base.
	const safeUsername = discordUser.username || userData?.username || undefined;
	const safeDisplayName =
		discordUser.displayName || safeUsername || userData?.displayName || undefined;

	if (!userData) {
		if (!safeUsername || !safeDisplayName) {
			// Payload Discord inexploitable (ni username ni displayName) : on
			// n'insère pas un user à moitié vide, mieux vaut réessayer plus tard.
			return;
		}
		// add user to the db
		const newUser = new User();
		newUser.id = user.id;
		newUser.username = safeUsername;
		newUser.displayName = safeDisplayName;
		newUser.avatar = avatarUrl;
		newUser.normalizedDisplayName = normalizeNames(safeDisplayName);

		const newUserEloSolo = new UserElo();
		newUserEloSolo.user = newUser;
		newUserEloSolo.mode = MatchMode.ONE_VS_ONE;

		const newUserEloDuo = new UserElo();
		newUserEloDuo.user = newUser;
		newUserEloDuo.mode = MatchMode.TWO_VS_TWO;

		const newUserXP = new UserExperience();
		newUserXP.user = newUser;

		await db.em.persist([newUser, newUserEloSolo, newUserEloDuo, newUserXP]).flush();

		// record new user both in logs and stats
		stats.register("NEW_USER", user.id);
		logger.logNewUser(user);
	} else {
		// Refresh profil Discord (avatar CDN en particulier)
		let dirty = false;
		if (safeUsername && userData.username !== safeUsername) {
			userData.username = safeUsername;
			dirty = true;
		}
		if (safeDisplayName && userData.displayName !== safeDisplayName) {
			userData.displayName = safeDisplayName;
			userData.normalizedDisplayName = normalizeNames(safeDisplayName);
			dirty = true;
		}
		if (userData.avatar !== avatarUrl) {
			userData.avatar = avatarUrl;
			dirty = true;
		}
		if (dirty) await db.em.flush();
	}
}

/**
 * Sync a guild with the database.
 * @param guildId
 * @param client
 */
export async function syncGuild(guildId: string, client: Client) {
	const [db, stats, logger] = await resolveDependencies([Database, Stats, Logger]);

	const guildRepo = db.get(Guild);
	const guildData = await guildRepo.findOne({ id: guildId, deleted: false });

	const fetchedGuild = await client.guilds.fetch(guildId).catch(() => null);

	// check if this guild exists in the database, if not it creates it (or recovers it from the deleted ones)
	if (!guildData) {
		const deletedGuildData = await guildRepo.findOne({ id: guildId, deleted: true });

		if (deletedGuildData) {
			// recover deleted guild

			deletedGuildData.deleted = false;
			await db.em.persist(deletedGuildData).flush();

			stats.register("RECOVER_GUILD", guildId);
			logger.logGuild("RECOVER_GUILD", guildId);
		} else {
			// create new guild

			const newGuild = new Guild();
			newGuild.id = guildId;
			await db.em.persist(newGuild).flush();

			stats.register("NEW_GUILD", guildId);
			logger.logGuild("NEW_GUILD", guildId);
		}
	} else if (!fetchedGuild) {
		// guild is deleted but still exists in the database

		guildData.deleted = true;
		await db.em.persist(guildData).flush();

		stats.register("DELETE_GUILD", guildId);
		logger.logGuild("DELETE_GUILD", guildId);
	}
}

/**
 * Sync all guilds with the database.
 * @param client
 */
export async function syncAllGuilds(client: Client) {
	const db = await resolveDependency(Database);

	// add missing guilds
	const guilds = client.guilds.cache;
	for (const guild of guilds) await syncGuild(guild[1].id, client);

	// remove deleted guilds
	const guildRepo = db.get(Guild);
	const guildsData = await guildRepo.getActiveGuilds();
	for (const guildData of guildsData) await syncGuild(guildData.id, client);
}
