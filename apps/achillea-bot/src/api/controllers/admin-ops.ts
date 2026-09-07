import {
	BodyParams,
	Context,
	Controller,
	Get,
	PathParams,
	Post,
	QueryParams,
	Res,
	UseBefore,
} from "@tsed/common";
import { BadRequest, Forbidden, Unauthorized } from "@tsed/exceptions";
import type { Response } from "express";
import { Client, MetadataStorage } from "@aphrody/discordx";

import { CookieAuthorize } from "@/api/middlewares";
import type { UserDTO } from "@/services";
import { Database, Logger, MetricsService, Stats, WalletService } from "@/services";
import { User, Wallet, Transaction, Sanction, License } from "@/entities";
import { BaseController } from "@/utils/classes";
import { UserRole } from "@/utils/enums";
import { isInMaintenance, resolveDependenciesSync, setMaintenance } from "@/utils/functions";

/**
 * Hub ops pour le dashboard admin web (CookieAuthorize + rôle staff).
 * Agrège users / wallet / health / audit / maintenance — domaines absents des
 * onglets ranked/clans existants.
 */
@Controller("/admin/ops")
@UseBefore(CookieAuthorize)
export class AdminOpsController extends BaseController {
	private db: Database;
	private wallet: WalletService;
	private stats: Stats;
	private client: Client;
	private metrics: MetricsService;
	private logger: Logger;

	constructor() {
		super();
		[this.db, this.wallet, this.stats, this.client, this.metrics, this.logger] =
			resolveDependenciesSync([Database, WalletService, Stats, Client, MetricsService, Logger]);
	}

	private requireStaff(ctx: Context, minRole = UserRole.Moderator): UserDTO {
		const user = ctx.get("user") as UserDTO | undefined;
		if (!user) throw new Unauthorized("Non authentifié");
		if ((user.role ?? 0) < minRole) throw new Forbidden("Réservé au staff");
		return user;
	}

	/** Snapshot multi-domaines pour la Vue d'ensemble. */
	@Get("/overview")
	async overview(@Context() ctx: Context, @Res() res: Response) {
		this.requireStaff(ctx);
		const em = this.db.em.fork();
		const conn = em.getConnection();

		const [
			usersTotal,
			usersStaff,
			walletsTotal,
			balanceSum,
			txToday,
			sanctionsActive,
			licensesActive,
			tournamentsOngoing,
			clansPending,
			orgsPending,
			castEventsOpen,
			auditRecent,
		] = await Promise.all([
			em.count(User, {}),
			em.count(User, { role: { $gte: UserRole.Moderator } }),
			em.count(Wallet, {}),
			conn
				.execute(`SELECT COALESCE(SUM(balance::numeric), 0) AS s FROM wallet`)
				.then((r: any) => Number(r?.[0]?.s ?? 0)),
			conn
				.execute(
					`SELECT COUNT(*)::int AS c FROM transaction WHERE created_at >= date_trunc('day', now())`
				)
				.then((r: any) => Number(r?.[0]?.c ?? 0))
				.catch(() => 0),
			em.count(Sanction, { revokedAt: null }).catch(() => 0),
			em.count(License, { status: "Active" as any }).catch(() =>
				conn
					.execute(`SELECT COUNT(*)::int AS c FROM license WHERE status = 'Active'`)
					.then((r: any) => Number(r?.[0]?.c ?? 0))
					.catch(() => 0)
			),
			conn
				.execute(
					`SELECT COUNT(*)::int AS c FROM event WHERE type = 'TOURNAMENT' AND internal_state = 'Ongoing'`
				)
				.then((r: any) => Number(r?.[0]?.c ?? 0))
				.catch(() => 0),
			conn
				.execute(`SELECT COUNT(*)::int AS c FROM clan WHERE state = 1`)
				.then((r: any) => Number(r?.[0]?.c ?? 0))
				.catch(() => 0),
			conn
				.execute(`SELECT COUNT(*)::int AS c FROM organization WHERE state = 0`)
				.then((r: any) => Number(r?.[0]?.c ?? 0))
				.catch(() => 0),
			conn
				.execute(
					`SELECT COUNT(*)::int AS c FROM cast_event WHERE status IN ('planned','open_signup','attributed','live')`
				)
				.then((r: any) => Number(r?.[0]?.c ?? 0))
				.catch(() => 0),
			conn
				.execute(`SELECT COUNT(*)::int AS c FROM audit_log WHERE ts >= now() - interval '24 hours'`)
				.then((r: any) => Number(r?.[0]?.c ?? 0))
				.catch(() => 0),
		]);

		let ranked = {
			activeMatches: 0,
			contestedMatches: 0,
			finishedToday: 0,
			matchesToday: 0,
			totalPlayers: 0,
		};
		try {
			const rows = await conn.execute(`
				SELECT
					(SELECT COUNT(*) FROM lobby WHERE event_type = 'RANKED' AND state = 'Ongoing') AS active_matches,
					(SELECT COUNT(*) FROM lobby WHERE event_type = 'RANKED' AND state = 'Contested') AS contested_matches,
					(SELECT COUNT(*) FROM lobby WHERE event_type = 'RANKED' AND state = 'Finished'
						AND updated_at >= date_trunc('day', now())) AS finished_today,
					(SELECT COUNT(*) FROM lobby WHERE event_type = 'RANKED'
						AND created_at >= date_trunc('day', now())) AS matches_today,
					(SELECT COUNT(*) FROM user_elo WHERE games_played > 0) AS total_players
			`);
			const r = rows?.[0] ?? {};
			ranked = {
				activeMatches: Number(r.active_matches ?? 0),
				contestedMatches: Number(r.contested_matches ?? 0),
				finishedToday: Number(r.finished_today ?? 0),
				matchesToday: Number(r.matches_today ?? 0),
				totalPlayers: Number(r.total_players ?? 0),
			};
		} catch {
			/* ranked tables may be missing in some envs */
		}

		const maintenance = await isInMaintenance();
		const botOnline = this.client.user?.presence?.status !== "offline";

		return res.json({
			users: { total: usersTotal, staff: usersStaff },
			wallet: { wallets: walletsTotal, totalBalance: balanceSum, txToday },
			moderation: { sanctionsActive, licensesActive },
			community: {
				tournamentsOngoing,
				clansPending,
				orgsPending,
				castEventsOpen,
			},
			ranked,
			audit24h: auditRecent,
			bot: {
				online: botOnline,
				uptime: this.client.uptime ?? 0,
				maintenance,
				guilds: this.client.guilds?.cache?.size ?? 0,
			},
			generatedAt: new Date().toISOString(),
		});
	}

	/** Liste utilisateurs DB (pagination + recherche). */
	@Get("/users")
	async listUsers(
		@Context() ctx: Context,
		@Res() res: Response,
		@QueryParams("page") page = 1,
		@QueryParams("pagination") pagination = 25,
		@QueryParams("q") q?: string
	) {
		this.requireStaff(ctx);
		const em = this.db.em.fork();
		const limit = Math.min(100, Math.max(1, Number(pagination) || 25));
		const p = Math.max(1, Number(page) || 1);
		const where: Record<string, unknown> = {};
		if (q?.trim()) {
			const term = `%${q.trim()}%`;
			where["$or"] = [
				{ username: { $ilike: term } },
				{ displayName: { $ilike: term } },
				{ id: { $like: term.replace(/%/g, "") } },
			];
		}
		const [items, total] = await em.findAndCount(User, where as any, {
			orderBy: { lastInteract: "DESC" },
			limit,
			offset: (p - 1) * limit,
			fields: ["id", "username", "displayName", "avatar", "role", "lastInteract"] as any,
		});
		return res.json({
			data: items.map((u) => ({
				id: u.id,
				username: u.username,
				displayName: u.displayName,
				avatar: u.avatar,
				role: u.role,
				lastInteract: u.lastInteract,
			})),
			meta: { page: p, limit, total, pageCount: Math.ceil(total / limit) },
		});
	}

	/** Patch rôle utilisateur (Admin+). */
	@Post("/users/:id/role")
	async setUserRole(
		@PathParams("id") id: string,
		@BodyParams() body: { role: number },
		@Context() ctx: Context,
		@Res() res: Response
	) {
		const actor = this.requireStaff(ctx, UserRole.Administrator);
		const role = Number(body?.role);
		if (!Number.isFinite(role) || role < 0 || role > UserRole.SuperAdministrator) {
			throw new BadRequest("role invalide");
		}
		// Ne pas s'auto-dégrader / ne pas monter au-dessus de soi
		if (role > (actor.role ?? 0)) throw new Forbidden("Impossible d'assigner un rôle supérieur");
		if (id === actor.id && role < (actor.role ?? 0)) {
			throw new Forbidden("Impossible de se rétrograder soi-même");
		}
		const em = this.db.em.fork();
		const user = await em.findOne(User, { id });
		if (!user) throw new BadRequest("Utilisateur introuvable");
		user.role = role as UserRole;
		await em.flush();
		return res.json({ success: true, id, role });
	}

	/** Top wallets + derniers mouvements. */
	@Get("/wallets")
	async wallets(@Context() ctx: Context, @Res() res: Response, @QueryParams("limit") limit = 30) {
		this.requireStaff(ctx, UserRole.Moderator);
		const em = this.db.em.fork();
		const lim = Math.min(100, Math.max(1, Number(limit) || 30));
		const top = await em.find(
			Wallet,
			{},
			{
				populate: ["user"],
				orderBy: { balance: "DESC" } as any,
				limit: lim,
			}
		);
		const recent = await em.find(
			Transaction,
			{},
			{
				orderBy: { createdAt: "DESC" },
				limit: lim,
				populate: ["fromUser", "toUser"],
			}
		);
		return res.json({
			top: top.map((w) => ({
				userId: w.user.id,
				displayName: (w.user as any).displayName || (w.user as any).username || w.user.id,
				balance: parseFloat(w.balance),
				currency: w.currency,
			})),
			recent: recent.map((t) => ({
				id: t.id,
				type: t.type,
				amount: parseFloat(t.amount),
				reason: t.reason,
				fromUserId: t.fromUser?.id ?? null,
				toUserId: t.toUser?.id ?? null,
				createdAt: t.createdAt,
			})),
		});
	}

	/** Crédit / débit admin (amount > 0 crédit, < 0 débit). */
	@Post("/wallets/:userId/adjust")
	async adjustWallet(
		@PathParams("userId") userId: string,
		@BodyParams() body: { amount: number; reason?: string },
		@Context() ctx: Context,
		@Res() res: Response
	) {
		const actor = this.requireStaff(ctx, UserRole.Administrator);
		const amount = Number(body?.amount);
		if (!Number.isFinite(amount) || amount === 0) throw new BadRequest("amount requis ≠ 0");
		const reason = (body?.reason || `Ajustement staff par ${actor.id}`).slice(0, 200);
		await this.wallet.getOrCreate(userId);
		if (amount > 0) {
			await this.wallet.credit(userId, Math.abs(amount), reason, { actorId: actor.id });
		} else {
			await this.wallet.debit(userId, Math.abs(amount), reason, { actorId: actor.id });
		}
		const bal = await this.wallet.getBalance(userId);
		return res.json({ success: true, userId, balance: bal });
	}

	/** Santé bot / host (cookie staff, pas Bearer dev). */
	@Get("/health")
	async health(@Context() ctx: Context, @Res() res: Response) {
		this.requireStaff(ctx);
		const maintenance = await isInMaintenance();
		return res.json({
			bot: {
				online: this.client.user?.presence?.status !== "offline",
				uptime: this.client.uptime ?? 0,
				username: this.client.user?.username ?? null,
				guilds: this.client.guilds?.cache?.size ?? 0,
				maintenance,
			},
			host: await this.stats.getHostUsage().catch(() => null),
			pid: await this.stats.getPidUsage().catch(() => null),
			latency: this.stats.getLatency?.() ?? null,
		});
	}

	@Post("/maintenance")
	async setMaint(
		@BodyParams() body: { maintenance: boolean },
		@Context() ctx: Context,
		@Res() res: Response
	) {
		this.requireStaff(ctx, UserRole.SuperAdministrator);
		const next = !!body?.maintenance;
		await setMaintenance(next);
		return res.json({ maintenance: next });
	}

	/** Dernières entrées audit. */
	@Get("/audit")
	async audit(@Context() ctx: Context, @Res() res: Response, @QueryParams("limit") limit = 50) {
		this.requireStaff(ctx, UserRole.Administrator);
		const em = this.db.em.fork();
		const lim = Math.min(200, Math.max(1, Number(limit) || 50));
		const { AuditLog } = await import("@/entities");
		const rows = await em.find(AuditLog, {}, { orderBy: { ts: "DESC" }, limit: lim });
		return res.json({
			data: rows.map((r) => ({
				id: r.id,
				ts: r.ts,
				actorId: r.actorId,
				action: r.action,
				targetType: r.targetType,
				targetId: r.targetId,
				reason: r.reason,
			})),
		});
	}

	/** Métriques Prometheus en JSON simplifié (compteurs). */
	@Get("/metrics-summary")
	async metricsSummary(@Context() ctx: Context, @Res() res: Response) {
		this.requireStaff(ctx);
		const text = await this.metrics.render();
		// Parse basique des compteurs name value
		const counters: Record<string, number> = {};
		for (const line of text.split("\n")) {
			if (!line || line.startsWith("#")) continue;
			const m = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{[^}]*\})?\s+([0-9.eE+-]+)/);
			if (m) counters[m[1]] = (counters[m[1]] ?? 0) + Number(m[2]);
		}
		return res.json({ counters, rawLines: text.split("\n").length });
	}

	/**
	 * Serveurs Discord où le bot est présent (cache live du client, pas le
	 * scanner /guilds — dont le script d'alimentation a disparu du dépôt).
	 */
	@Get("/guilds")
	async guilds(@Context() ctx: Context, @Res() res: Response) {
		this.requireStaff(ctx);
		const data = [...this.client.guilds.cache.values()].map((g) => ({
			id: g.id,
			name: g.name,
			iconURL: g.iconURL(),
			memberCount: g.memberCount,
			ownerId: g.ownerId,
			createdAt: g.joinedAt,
		}));
		data.sort((a, b) => b.memberCount - a.memberCount);
		return res.json({ data });
	}

	/** Génère une invitation ponctuelle pour un serveur où le bot est présent. */
	@Get("/guilds/:id/invite")
	async guildInvite(@PathParams("id") id: string, @Context() ctx: Context, @Res() res: Response) {
		this.requireStaff(ctx, UserRole.Administrator);
		const guild = await this.client.guilds.fetch(id).catch(() => null);
		if (!guild) throw new BadRequest("Serveur introuvable");

		const { ChannelType, PermissionsBitField } = await import("discord.js");
		const channels = await guild.channels.fetch();
		for (const channel of channels.values()) {
			const canInvite =
				channel &&
				(guild.members.me
					?.permissionsIn(channel)
					.has(PermissionsBitField.Flags.CreateInstantInvite) ??
					false) &&
				(channel.type === ChannelType.GuildText ||
					channel.type === ChannelType.GuildVoice ||
					channel.type === ChannelType.GuildAnnouncement);
			if (canInvite) {
				const invite = await (channel as any).createInvite({ maxAge: 3600, maxUses: 1 });
				return res.json({ url: invite.url });
			}
		}
		throw new BadRequest("Aucun salon disponible pour créer une invitation");
	}

	/** Liste des slash-commands enregistrées (lecture seule). */
	@Get("/commands")
	async commands(@Context() ctx: Context, @Res() res: Response) {
		this.requireStaff(ctx);
		const commands = MetadataStorage.instance.applicationCommands.map((c) => c.toJSON());
		return res.json({ data: commands });
	}

	/** Dernières lignes de logs process bot (tail borné, cf. Logger). */
	@Get("/logs")
	async logs(@Context() ctx: Context, @Res() res: Response) {
		this.requireStaff(ctx, UserRole.SuperAdministrator);
		return res.json({ data: this.logger.getLastLogs() });
	}
}
