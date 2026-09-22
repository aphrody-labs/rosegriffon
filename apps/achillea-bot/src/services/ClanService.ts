import { rel } from "@mikro-orm/core";
import { InternalError } from "@rushstack/node-core-library";
import { BadRequest, NotFound, Unauthorized } from "@tsed/exceptions";
import { plainToInstance } from "class-transformer";
import type { BaseMessageOptions, GuildMember, TextChannel, User } from "discord.js";
import { Colors, escapeMarkdown, roleMention, userMention } from "discord.js";
import { Client } from "@aphrody/discordx";
import GraphemeSplitter from "grapheme-splitter";

import type { ClanApplicationDTO, ClanInviteDTO } from "@/api/models/dtos";
import { coreManagerConfig } from "@/configs";
import { Service } from "@/decorators";
import {
	Clan,
	ClanApplication,
	ClanExperience,
	ClanInvite,
	ClanMember,
	ClanMemberHistory,
	Notification,
	User as UserEntity,
	VoteProposal,
} from "@/entities";
import type { SocialMediaDTO } from "@/utils/functions";
import {
	assignClanRoleToUser,
	buildClanMemberEmbed,
	buildErrorEmbed,
	buildSimpleUserEmbed,
	buildSuccessEmbed,
	buildUserEmbed,
	createClanFoundationEmbed,
	createInviteThread,
	disbandClan,
	freshDiscordAvatarUrl,
	hasActiveClanMembership,
	isSocialMediaUrl,
	logDemote,
	logMemberDeparture,
	logPromote,
	normalizeNames,
	onMembershipChange,
	removeClanRoleFromUser,
	resolveDependency,
	resolveDiscordAvatarUrl,
	SocialMedia,
	syncUser,
	turnClanMemberIntoHistory,
	validateClanMemberLimits,
} from "@/utils/functions";

import { ClanDTO } from "../api/models/dtos/clanDTO";
import type { ClanMemberDTO } from "../api/models/dtos/clanMemberDTO";
import type { NewClanDTO } from "../api/models/dtos/newClanDTO";
import {
	ClanMemberDistinction,
	ClanMemberRole,
	ClanState,
	LeaveReason,
	ProposalType,
	VotingStrategy,
} from "../utils/enums";
import { ClanCreationErrors } from "../utils/enums/clanCreationErrors";
import { NotificationCategory, NotificationType } from "../utils/enums/notifications";
import {
	buildConfirmCancelApplicationButtons,
	buildVoteButtons,
} from "../utils/functions/components";
import {
	logOnAchilleaGenericClanChannel,
	logOnAchilleaSpecificClanChannel,
	logOnClanChannels,
} from "../utils/functions/messager";
import { Database } from "./Database";
import { Logger } from "./Logger";
import { NotificationService } from "./NotificationService";
import type { UserDTO } from "./UserService";
import { UserService } from "./UserService";

@Service()
export class ClanService {
	constructor(
		private db: Database,
		private notifications: NotificationService
	) {}

	private get client(): Client {
		const client = (globalThis as typeof globalThis & { __roseGriffonDiscordClient?: Client }).__roseGriffonDiscordClient;
		if (!client) throw new Error("Discord client is not initialized");
		return client;
	}

	async getMember(userId: string, em?: DatabaseEntityManager) {
		const usedEm = em ?? this.db.em;

		return await usedEm.findOne(
			ClanMember,
			{ user: userId },
			{ populate: ["clan", "user"], refresh: true }
		);
	}

	async getMemberOrHistory(userId: string, clan?: Clan, periodFilter?: Date) {
		const member = await this.getMember(userId);
		if (member) return member;

		const historyMember = await this.db.em.findOne(ClanMemberHistory, {
			user: userId,
			clan,
			joinDate: { $lt: periodFilter },
			createdAt: { $gt: periodFilter },
		});
		if (historyMember) return historyMember;
		else return null;
	}

	async UpdateMemberRolesAndDistinctions(
		role: ClanMemberRole,
		distinctions: ClanMemberDistinction[],
		memberEntity: ClanMember
	) {
		const isPromoted = role > memberEntity.role;
		const isDemoted = role < memberEntity.role;

		memberEntity.distinctions = distinctions;
		memberEntity.role = role;

		await this.db.em.persist(memberEntity).flush();

		if (!isPromoted && !isDemoted) return;
		if (isPromoted) return await logPromote(memberEntity.clan, memberEntity, this.client);
		if (isDemoted) return await logDemote(memberEntity.clan, memberEntity, this.client);
	}

	async tryDisbandingNewCreatedClan(clan: Clan) {
		await disbandClan(clan, this.db, this.client);
	}

	async kickMember(member: ClanMember, reason: string, executor: UserDTO) {
		const logger = await resolveDependency(Logger);
		await removeClanRoleFromUser(this.client, member, member.clan);
		await turnClanMemberIntoHistory(member, this.db, LeaveReason.Kick, reason);
		await logOnAchilleaSpecificClanChannel(
			logger,
			{
				embeds: [
					buildSuccessEmbed(
						`L'utilisateur ${escapeMarkdown(member.user.displayName)} a été expulsé par ${escapeMarkdown(executor.username)} !`
					),
				],
			},
			member.clan.channelId
		);
		await logMemberDeparture(this.client, logger, member.clan, member, reason);

		const kickNotif = new Notification();
		kickNotif.title = "Expulsion";
		kickNotif.message = `L'utilisateur ${escapeMarkdown(member.user.displayName)} a été expulsé par ${escapeMarkdown(executor.username)} !`;
		kickNotif.type = NotificationType.CLAN_MEMBER_KICK;
		kickNotif.category = NotificationCategory.CLAN;
		kickNotif.payload = {
			targetId: member.user.id,
			targetName: member.user.displayName,
			clanId: member.clan.id,
			clanName: member.clan.name,
			executorId: executor.id,
			executorName: executor.username,
		};

		await this.db.em.persist(kickNotif).flush();

		await this.notifications.sendClanNotification(member.clan, kickNotif);

		await onMembershipChange(member.clan, this.db, logger);
	}

	async getNewlyCreatedClanIfExists(newClanDto: NewClanDTO, userId: string) {
		const clan = await this.db.em.findOne(Clan, {
			name: newClanDto.name,
			shortenedName: newClanDto.shortName,
			normalizedShortName: newClanDto.normalizedShortName,
			clanBiography: newClanDto.description,
		});
		if (!clan) return null;
		const cpt = await this.db.get(Clan).getCaptain(clan);
		if (!cpt) return null;
		if (cpt.user.id !== userId) return null;

		return clan;
	}

	async getClans(
		page: number,
		pageSize: number,
		state: ClanState = ClanState.Approved
	): Promise<[ClanDTO[], number]> {
		const [clans, total] = await this.db.em.getRepository(Clan).getAllClans(page, pageSize, state);

		const dtos = await Promise.all(clans.map(async (clan) => this.toDTO(clan)));

		return [dtos, total];
	}

	async findById(id: number): Promise<ClanDTO> {
		const clan = await this.db.em.getRepository(Clan).findOne({ id });
		if (!clan) {
			throw new NotFound("Clan not found");
		}

		return this.toDTO(clan);
	}

	async toDTO(clan: Clan) {
		const dto = plainToInstance(ClanDTO, clan);
		const cap = await this.db.em.getRepository(Clan).getCaptain(clan);
		if (!cap) {
			throw new NotFound(`Captain not found for clan ${clan.id}`);
		}
		const clanXp = await this.db.em.findOne(ClanExperience, { clan });
		dto.experience = {
			currentLevel: clanXp?.currentLevel ?? 100,
			totalXp: clanXp?.totalXp ?? 100000,
		};
		dto.president = cap.user;
		dto.membersCount = await this.db.em.count(ClanMember, { clan: clan.id });

		return dto;
	}

	async validateName(name: string) {
		const splitter = new GraphemeSplitter();
		const count = splitter.countGraphemes(name);
		const normalizedName = normalizeNames(name);
		if (count < 3 || count > 30 || !normalizedName) {
			return ClanCreationErrors.INVALID_NAME;
		}
		const clanExists = await this.db.get(Clan).findOne({ normalizedName });
		if (clanExists) {
			return ClanCreationErrors.NAME_TAKEN;
		}

		return true;
	}

	async validateShortName(shortName: string) {
		const splitter = new GraphemeSplitter();
		const count = splitter.countGraphemes(shortName);
		const normalizedShortName = normalizeNames(shortName);
		if (count < 2 || count > 3 || !normalizedShortName || !normalizedShortName.match("^[^\\s]+$")) {
			return ClanCreationErrors.INVALID_SHORTNAME;
		}
		const clanExists = await this.db.get(Clan).findOne({ normalizedShortName });
		if (clanExists) {
			return ClanCreationErrors.SHORTNAME_TAKEN;
		}

		return true;
	}

	/**
	 * MàJ des infos éditables depuis l'onglet "Infos" du dashboard de clan (logo, nom, tag,
	 * bio, réseaux, recrutement). Permissions vérifiées côté controller (Président du clan
	 * ou admin site) — ce service ne fait que valider/persister les champs fournis.
	 */
	async updateClanInfo(
		clanId: number,
		patch: {
			name?: string;
			shortenedName?: string;
			clanBiography?: string;
			clanAvatarUrl?: string;
			xUrl?: string | null;
			instagramUrl?: string | null;
			tiktokUrl?: string | null;
			isRecruiting?: boolean;
			autoAcceptMembers?: boolean;
			isInactive?: boolean;
		}
	): Promise<ClanDTO> {
		const clan = await this.db.em.getRepository(Clan).findOne({ id: clanId });
		if (!clan) throw new NotFound("Clan not found");

		const splitter = new GraphemeSplitter();
		const previousName = clan.name;

		if (patch.name !== undefined && patch.name !== clan.name) {
			const count = splitter.countGraphemes(patch.name);
			const normalizedName = normalizeNames(patch.name);
			if (count < 3 || count > 30 || !normalizedName) {
				throw new BadRequest("Nom invalide (3 à 30 caractères).");
			}
			const taken = await this.db.get(Clan).findOne({ normalizedName, id: { $ne: clanId } });
			if (taken) throw new BadRequest("Ce nom de clan est déjà pris.");
			clan.name = patch.name;
			clan.normalizedName = normalizedName;
		}

		if (patch.shortenedName !== undefined && patch.shortenedName !== clan.shortenedName) {
			const count = splitter.countGraphemes(patch.shortenedName);
			const normalizedShortName = normalizeNames(patch.shortenedName);
			if (
				count < 2 ||
				count > 3 ||
				!normalizedShortName ||
				!normalizedShortName.match("^[^\\s]+$")
			) {
				throw new BadRequest("Tag invalide (2 à 3 caractères, sans espace).");
			}
			const taken = await this.db.get(Clan).findOne({ normalizedShortName, id: { $ne: clanId } });
			if (taken) throw new BadRequest("Ce tag de clan est déjà pris.");
			clan.shortenedName = patch.shortenedName;
			clan.normalizedShortName = normalizedShortName;
		}

		if (patch.clanBiography !== undefined) {
			if (patch.clanBiography.length > 1500) {
				throw new BadRequest("Biographie trop longue (1500 caractères max).");
			}
			clan.clanBiography = patch.clanBiography;
		}

		if (patch.clanAvatarUrl !== undefined && patch.clanAvatarUrl !== clan.clanAvatarUrl) {
			if (!patch.clanAvatarUrl) throw new BadRequest("Logo invalide.");
			const taken = await this.db
				.get(Clan)
				.findOne({ clanAvatarUrl: patch.clanAvatarUrl, id: { $ne: clanId } });
			if (taken) throw new BadRequest("Cette image est déjà utilisée par un autre clan.");
			clan.clanAvatarUrl = patch.clanAvatarUrl;
		}

		const assignSocial = async (
			value: string | null | undefined,
			platform: SocialMedia,
			field: "xUrl" | "instagramUrl" | "tiktokUrl",
			label: string
		) => {
			if (value === undefined) return;
			if (!value || value.trim() === "") {
				clan[field] = null;
				return;
			}
			const social = await isSocialMediaUrl(value);
			if (!social || social.platform !== platform) {
				throw new BadRequest(`Lien ${label} invalide.`);
			}
			clan[field] = social.canonicalUrl;
		};
		await assignSocial(patch.xUrl, SocialMedia.X, "xUrl", "X/Twitter");
		await assignSocial(patch.instagramUrl, SocialMedia.Instagram, "instagramUrl", "Instagram");
		await assignSocial(patch.tiktokUrl, SocialMedia.TikTok, "tiktokUrl", "TikTok");

		if (patch.isRecruiting !== undefined) clan.isRecruiting = patch.isRecruiting;
		if (patch.autoAcceptMembers !== undefined) clan.autoAcceptMembers = patch.autoAcceptMembers;
		if (patch.isInactive !== undefined) clan.isInactive = patch.isInactive;

		await this.db.em.flush();

		// Best-effort : renomme le rôle Discord du clan en même temps que son nom. Ne bloque
		// jamais la MàJ DB (le rôle peut avoir été supprimé/renommé manuellement entre-temps).
		if (clan.name !== previousName) {
			try {
				const achillea = await this.client.guilds.fetch(coreManagerConfig.coreGuildId);
				const role = await achillea.roles.fetch(clan.roleId);
				await role?.setName(clan.name, "Renommage du Clan (dashboard)");
			} catch (err) {
				console.error(
					`[ClanService] Échec du renommage du rôle Discord pour le clan ${clan.id}:`,
					err
				);
			}
		}

		return this.toDTO(clan);
	}

	async validateFounders(founders: User[]) {
		const foundersIds = founders.map((founder) => founder.id);
		if (foundersIds.length !== 5) {
			return ClanCreationErrors.WRONG_FOUNDERS_NUMBER;
		}
		if (new Set(foundersIds).size !== foundersIds.length) {
			return ClanCreationErrors.DUPLICATE_FOUNDERS;
		}

		const clanMembersRepo = this.db.get(ClanMember);

		for (const member of founders) {
			await syncUser(member);
			const clanMember = await clanMembersRepo.findOne({ user: member.id });
			if (clanMember) {
				return ClanCreationErrors.FOUNDER_IN_CLAN;
			}
		}

		return true;
	}

	async validateSocials(socialUrls: string[]) {
		const socials = await Promise.all(
			socialUrls.map(async (url: string) => await isSocialMediaUrl(url))
		);

		return socials.filter((social) => social !== null);
	}

	async createAndSetupClanRole(name: string, presidentId: string, founders: GuildMember[]) {
		const achillea = await this.client.guilds.fetch(coreManagerConfig.coreGuildId);
		const newClanRole = await achillea.roles.create({
			name,
			mentionable: true,
			reason: `Rôle automatique suite à la création du Clan ${name}`,
		});

		const captainAsGuildMember = await achillea.members.fetch(presidentId);
		await captainAsGuildMember.roles.add(newClanRole, `Captain of the Clan ${name}`);
		founders.forEach((member) => member.roles.add(newClanRole, `Founder of the Clan ${name}`));

		return newClanRole;
	}

	async getAchillea() {
		return await this.client.guilds.fetch(coreManagerConfig.coreGuildId);
	}

	async createClan(
		dto: NewClanDTO,
		foundersIds: string[],
		validatedSocials: SocialMediaDTO[],
		clanChannelId: string,
		newRoleId: string,
		emojiId: string,
		presidentId: string
	) {
		try {
			const newClan = new Clan(
				foundersIds,
				dto.name,
				dto.shortName,
				dto.logo,
				dto.description,
				validatedSocials[0].platform,
				validatedSocials[0].canonicalUrl,
				clanChannelId,
				newRoleId
			);
			for (const social of validatedSocials.slice(1)) {
				switch (social.platform) {
					case SocialMedia.X:
						newClan.xUrl = social.canonicalUrl;
						break;

					case SocialMedia.Instagram:
						newClan.instagramUrl = social.canonicalUrl;
						break;

					case SocialMedia.TikTok:
						newClan.tiktokUrl = social.canonicalUrl;
						break;
				}
			}
			newClan.clanEmojiId = emojiId;
			newClan.origin = dto.origin?.code ?? "";
			newClan.languages = dto.languages?.map((lang) => lang.code) ?? [];

			await this.db.em.persist(newClan).flush();

			const founder = await this.db
				.get(ClanMember)
				.createMember(newClan.id, presidentId, ClanMemberRole.Captain, [
					ClanMemberDistinction.Staff,
				]);
			await this.db.em.persist(founder).flush();

			return { success: true, error: null, clan: newClan };
		} catch (err) {
			return { success: false, error: err, clan: null };
		}
	}

	async initFoundingVoteProcedure(foundersIds: string[], newClan: Clan, president: UserDTO) {
		const voters = await this.db.em.find(UserEntity, foundersIds);

		const voteProposal = new VoteProposal();
		voteProposal.type = ProposalType.CLAN_CREATION;
		voteProposal.strategy = VotingStrategy.MAJORITY;
		voteProposal.reason = `Proposition de création du Clan ${newClan.name} par ${escapeMarkdown(president.username)}`;
		voteProposal.eligibleVoters.set(voters);
		voteProposal.targetEntityType = "Clan";
		voteProposal.targetEntityId = newClan.id;
		voteProposal.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

		await this.db.em.persist(voteProposal).flush();

		const mentionsString = foundersIds.map((id) => userMention(id));

		const voteMsg: BaseMessageOptions = {
			content: `${mentionsString.join(", ")}\n${userMention(president.id)} souhaite fonder le clan ${newClan.name} avec vous ! Acceptez-vous ?`,
			embeds: [
				createClanFoundationEmbed(
					newClan,
					[president.id, ...foundersIds],
					voteProposal.votes.length
				) as any,
			],
			components: [buildVoteButtons(voteProposal.id.toString())],
		};

		const logger = await resolveDependency(Logger);
		await logOnAchilleaSpecificClanChannel(logger, voteMsg, newClan.channelId);
	}

	async getClanMembers(clanId: number, refresh: boolean = false): Promise<ClanMemberDTO[]> {
		const em = this.db.em.fork();

		const clanMembers = await em.find(
			ClanMember,
			{ clan: clanId },
			{
				populate: ["user"], // ensure we have user relation
				orderBy: { role: "asc" },
				refresh,
			}
		);

		if (clanMembers.length === 0) return [];

		// OPTIM : avant cette method faisait N round-trips getUserDTO (~150 queries
		// pour 30 membres). On batch maintenant en 2 queries totales :
		//   1) tous les UserView en 1 SELECT IN
		//   2) tous les Rank cache en 1 SELECT (~8 lignes, partage entre membres)
		const userIds = clanMembers.map((m) => m.user.id);
		const [userViews, ranks] = await Promise.all([
			em.find("UserView" as any, { id: { $in: userIds } }) as Promise<any[]>,
			em.find("Rank" as any, {}) as Promise<any[]>,
		]);
		const userViewMap = new Map<string, any>();
		for (const uv of userViews) userViewMap.set(uv.id, uv);
		const rankMap = new Map<string, any>();
		for (const r of ranks) rankMap.set(r.key, r);

		return clanMembers.map((member) => {
			const uv = userViewMap.get(member.user.id);
			// Avatar stocké en base (URL CDN complète, déjà peuplé via `user`) en priorité ;
			// sinon cache discord.js ; sinon défaut Discord calculé sur l'ID (pas le /0.png figé).
			const cached = this.client.users.cache.get(member.user.id);
			const avatar = cached
				? freshDiscordAvatarUrl(cached)
				: resolveDiscordAvatarUrl(member.user.id, member.user.avatar);

			const soloKey = uv?.solo_key || "Non classé";
			const duoKey = uv?.duo_key || "Non classé";
			const userDTO = {
				id: member.user.id,
				type: "user" as const,
				username: uv?.displayName ?? "Utilisateur inconnu",
				clanId: uv?.clanId,
				sim: 0,
				avatar,
				soloRank: {
					elo: uv?.solo_elo ?? 0,
					key: soloKey,
					gradient: rankMap.get(soloKey)?.gradient ?? [],
				},
				duoRank: {
					elo: uv?.duo_elo ?? 0,
					key: duoKey,
					gradient: rankMap.get(duoKey)?.gradient ?? [],
				},
				lastInteract: uv?.lastInteract,
				role: uv?.role,
				currentLevel: uv?.currentLevel,
				totalXp: uv?.totalXp,
				hasTwitch: uv?.hasTwitch,
				hasChallonge: uv?.hasChallonge,
				hasYoutube: uv?.hasYoutube,
			};

			return {
				clanRole: member.role,
				distinctions: member.distinctions,
				clanFameContributed: member.clanFameContributed,
				createdAt: member.createdAt,
				updatedAt: member.updatedAt,
				user: userDTO,
			};
		});
	}

	async getClanMemberDTO(
		member: ClanMember | ClanMemberHistory,
		userService: UserService
	): Promise<ClanMemberDTO> {
		return {
			clanRole: member.role,
			distinctions: [],
			clanFameContributed: member.clanFameContributed,
			createdAt: member.createdAt,
			updatedAt: member.updatedAt,
			user: await userService.getUserDTO(member.user.id),
		};
	}

	async toClanInviteDTO(invite: ClanInvite) {
		const userService = new UserService(this.db);
		const inviterAsMember = await this.getMemberOrHistory(invite.inviter.id);
		if (!inviterAsMember) return null;

		return {
			id: invite.id,
			user: await userService.getUserDTO(invite.user.id),
			inviter: await this.getClanMemberDTO(inviterAsMember, userService),
			threadId: invite.threadId,
			distinctions: invite.distinctions,
			clan: await this.toDTO(invite.clan),
			createdAt: invite.createdAt,
			updatedAt: invite.updatedAt,
			lastNotifiedAt: invite.lastNotifiedAt,
		} as ClanInviteDTO;
	}

	async toClanApplicationDTO(application: ClanApplication) {
		const userService = new UserService(this.db);

		return {
			id: application.id,
			user: await userService.getUserDTO(application.user.id),
			distinctions: application.distinctions,
			clan: await this.toDTO(application.clan),
			createdAt: application.createdAt,
			updatedAt: application.updatedAt,
		} as ClanApplicationDTO;
	}

	async verifyClanMemberManagementPermissions(executor: UserDTO, targetId: string) {
		const executorAsMember = await this.getMember(executor.id);
		if (!executorAsMember) {
			return {
				success: false,
				status: 403,
				error: "Vous n’êtes pas dans un Clan.",
			};
		}

		const targetAsMember = await this.getMember(targetId);
		if (!targetAsMember) {
			return {
				success: false,
				status: 404,
				error: "Impossible de trouver le Membre ciblé.",
			};
		}

		if (executorAsMember.clan.id !== targetAsMember.clan.id) {
			return {
				success: false,
				status: 401,
				error: "Vous ne pouvez pas gérer les Membres d'autres Clans.",
			};
		}

		if (
			executorAsMember.role < ClanMemberRole.SubCaptain ||
			(executorAsMember.role <= targetAsMember.role &&
				executorAsMember.role !== ClanMemberRole.Captain)
		) {
			return {
				success: false,
				status: 403,
				error: "Vous n’avez pas les permissions pour modifier ce membre.",
			};
		}

		// ✅ Success case — return both members for later use
		return { success: true, executorAsMember, targetAsMember };
	}

	async getAllInvites(clanId: number) {
		const [invites] = await this.db.em.getRepository(ClanInvite).getAllInvites(clanId);

		const formattedInvites = await Promise.all(
			invites.map(async (invite) => this.toClanInviteDTO(invite))
		);

		return formattedInvites.filter((i) => i !== null);
	}

	async revokeInvite(invite: ClanInviteDTO) {
		const clanInvite = await this.db.em.findOne(ClanInvite, { id: invite.id }, { refresh: true });
		if (!clanInvite) {
			throw new BadRequest("Cette invitation n'existe pas. Essayez de synchroniser les données !");
		}

		try {
			await this.db.em.remove(clanInvite).flush();
		} catch {
			throw new InternalError("Impossible de supprimer cette invitation.");
		}

		try {
			if (invite.threadId) {
				this.client.channels.fetch(invite.threadId).then((channel) => {
					channel?.delete();
				});
			}
		} catch {
			throw new NotFound("Impossible de supprimer le thread discord lié à cette invitation");
		}
	}

	async sendInviteNotification(invite: ClanInviteDTO) {
		const clanInvite = await this.db.em.findOne(ClanInvite, { id: invite.id }, { refresh: true });
		if (!clanInvite) {
			throw new BadRequest("Cette invitation n'existe pas. Essayez de synchroniser les données !");
		}
		if ((Date.now() - clanInvite.lastNotifiedAt.getTime()) / (1000 * 60 * 60) < 12) {
			throw new BadRequest(
				"Vous avez notifié cet utilisateur trop récemment, veuillez patienter !"
			);
		}
		try {
			if (clanInvite.threadId) {
				const logger = await resolveDependency(Logger);

				return await logger.discordChannel(
					clanInvite.threadId,
					`${userMention(clanInvite.user.id)}, vous avez une invitation sans réponse de la part de ${userMention(clanInvite.inviter.id)} !`
				);
			}

			throw new Error("Le salon discord pour cette invitation est introuvable !");
		} catch (err: any) {
			console.info("Tried to notify an invite but failed", err);

			throw new NotFound(err.message);
		}
	}

	async inviteUser(
		userId: string,
		clanId: number,
		distinctions: ClanMemberDistinction[],
		inviter: UserDTO
	) {
		await this.db.em.transactional(async (em) => {
			const clan = await em.findOne(Clan, { id: clanId });
			if (!clan) {
				throw new BadRequest("Vous devez être dans un Clan pour effectuer cette action !");
			}
			const user = await em.findOne(UserEntity, { id: userId });
			if (!user) {
				throw new NotFound("L'Utilisateur ciblé est introuvable.");
			}
			// Une adhésion à un Clan inactif ne bloque pas (transfert/prêt implicite).
			const userInActiveClan = await hasActiveClanMembership(userId, em);
			if (userInActiveClan) {
				throw new BadRequest("L'Utilisateur ciblé fait déjà partie d'un Clan.");
			}
			const alreadyInvited = await em.findOne(
				ClanInvite,
				{ user: userId, clan },
				{ refresh: true }
			);
			if (alreadyInvited) {
				throw new BadRequest(
					"L'utilisateur ciblé a déjà une invitation en attente de votre part !"
				);
			}

			await validateClanMemberLimits(clan, em, distinctions);

			const invite = new ClanInvite();
			invite.user = user;
			invite.inviter = rel(UserEntity, inviter.id);
			invite.clan = clan;
			invite.distinctions = distinctions;

			await createInviteThread(this.client, user, invite, em, inviter);
		});
	}

	async getAllApplications(clanId: number) {
		const [applications] = await this.db.em
			.getRepository(ClanApplication)
			.getAllApplications(clanId);

		const formattedInvites = await Promise.all(
			applications.map(async (app) => this.toClanApplicationDTO(app))
		);

		return formattedInvites.filter((i) => i !== null);
	}

	async rejectApplication(applicationId: number, executor: ClanMember) {
		const application = await this.db.em.findOne(
			ClanApplication,
			{ id: applicationId },
			{ populate: ["user"] }
		);
		if (!application) {
			throw new NotFound("Candidature introuvable.");
		}

		if (application.clan.id !== executor.clan.id) {
			throw new Unauthorized("Vous ne pouvez pas gérer les candidatures des autres Clans.");
		}

		await this.db.em.getRepository(ClanApplication).nativeDelete(application);

		const logger = await resolveDependency(Logger);
		if (application.messageId) {
			try {
				const clanChannel = (await this.client.channels.fetch(
					application.clan.channelId
				)) as TextChannel;
				const applicationMessage = await clanChannel.messages.fetch(application.messageId);

				await applicationMessage.edit({
					content: "",
					embeds: [
						await buildUserEmbed(application.user, this.client, "Candidature rejetée", Colors.Red),
					],
					components: [],
				});
			} catch (err) {
				logger.log(
					`[ClanService] Maj du message de candidature rejetée impossible (${application.messageId}): ${err instanceof Error ? err.message : String(err)}`,
					"warn",
					false
				);
			}
		}

		await logOnClanChannels(
			logger,
			{
				embeds: [
					buildErrorEmbed(
						`La candidature de l'utilisateur ${escapeMarkdown(application.user.displayName)} a été refusée par ${escapeMarkdown(executor.user.displayName)}`
					),
				],
			},
			executor.clan
		);
	}

	async acceptApplication(applicationId: number, executor?: ClanMember) {
		const [newMember, application] = await this.db.em.transactional(async (em) => {
			const application = await em.findOne(ClanApplication, {
				id: applicationId,
			});
			if (!application) {
				throw new NotFound("Candidature introuvable.");
			}

			if (executor && application.clan.id !== executor.clan.id) {
				throw new Unauthorized("Vous ne pouvez pas gérer les candidatures des autres Clans.");
			}

			// Une adhésion à un Clan inactif ne bloque pas (transfert/prêt implicite).
			const isInActiveClan = await hasActiveClanMembership(application.user.id, em);
			if (isInActiveClan) {
				throw new BadRequest("Cet Utilisateur fait déjà partie d'un Clan");
			}

			const applications = await em.find(ClanApplication, {
				user: application.user,
			});

			applications.forEach((a) => em.remove(a));

			const newMember = new ClanMember(
				application.clan.id,
				application.user.id,
				ClanMemberRole.Trial,
				application.distinctions
			);

			em.persist(newMember);

			return [newMember, application];
		});

		await this.db.em.populate(newMember, ["user", "clan.guild"]);

		await assignClanRoleToUser(this.client, newMember, newMember.clan);

		const user = await this.client.users.fetch(newMember.user.id);

		const msg: BaseMessageOptions = {
			embeds: [await buildClanMemberEmbed(newMember, this.client, "Nouveau membre")],
		};

		const logger = await resolveDependency(Logger);
		if (application.messageId) {
			try {
				const clanChannel = (await this.client.channels.fetch(
					application.clan.channelId
				)) as TextChannel;
				const applicationMessage = await clanChannel.messages.fetch(application.messageId);

				await applicationMessage.edit({
					content: "",
					embeds: [
						await buildUserEmbed(
							application.user,
							this.client,
							"Candidature acceptée",
							Colors.Green
						),
					],
					components: [],
				});
			} catch (err) {
				logger.log(
					`[ClanService] Maj du message de candidature acceptée impossible (${application.messageId}): ${err instanceof Error ? err.message : String(err)}`,
					"warn",
					false
				);
			}
		}

		if (executor)
			await logOnClanChannels(
				logger,
				{
					embeds: [
						buildSuccessEmbed(
							`La candidature de l'utilisateur ${escapeMarkdown(application.user.displayName)} a été acceptée par ${escapeMarkdown(executor.user.displayName)}`
						),
					],
				},
				executor.clan
			);
		await logOnClanChannels(logger, msg, newMember.clan);

		await logOnAchilleaGenericClanChannel(logger, {
			embeds: [
				await buildSimpleUserEmbed(
					user,
					"Nouveau membre",
					`${user.displayName} a rejoint ${newMember.clan.name} !`,
					0x57f287
				),
			],
		});

		return true;
	}

	async applyToClan(userId: string, clanId: number, distinctions: ClanMemberDistinction[]) {
		const newApplication = await this.db.em.transactional(async (em) => {
			const clan = await em.findOne(Clan, { id: clanId });
			if (!clan) {
				throw new NotFound("Clan introuvable.");
			}
			// Une adhésion à un Clan inactif ne bloque pas (transfert/prêt implicite).
			const userInActiveClan = await hasActiveClanMembership(userId, em);
			if (userInActiveClan) {
				throw new BadRequest("Vous faites déjà partie d'un Clan.");
			}
			const alreadyApplied = await em.findOne(
				ClanApplication,
				{ user: userId, clan },
				{ refresh: true }
			);
			if (alreadyApplied) {
				throw new BadRequest("Vous avez déjà soumis votre candidature auprès de ce Clan.");
			}

			await validateClanMemberLimits(clan, em, distinctions);

			const application = new ClanApplication();
			application.user = rel(UserEntity, userId);
			application.clan = clan;
			application.distinctions = distinctions;

			em.persist(application);

			return application;
		});

		if (newApplication.clan.autoAcceptMembers)
			return await this.acceptApplication(newApplication.id);

		await this.db.em.populate(newApplication, ["user", "clan"]);

		const logger = await resolveDependency(Logger);

		const msg: BaseMessageOptions = {
			content: `${roleMention(newApplication.clan.roleId)} Cet utilisateur postule en tant que **${distinctions.join(", ")}**`,
			embeds: [await buildUserEmbed(newApplication.user, this.client, "Candidature", Colors.Blue)],
			components: [buildConfirmCancelApplicationButtons(newApplication.id.toString())],
		};
		const sentMsg = await logOnAchilleaSpecificClanChannel(
			logger,
			msg,
			newApplication.clan.channelId
		);
		if (sentMsg) newApplication.messageId = sentMsg.id;
		await this.db.em.persist(newApplication).flush();

		return false;
	}
}
