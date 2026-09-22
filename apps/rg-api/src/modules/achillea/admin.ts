import { Elysia, status, t } from "elysia";
import { sql as kyselySql } from "kysely";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { dbPlugin } from "../../plugins/db";
import { resolveAchilleaSession } from "../auth/session";

async function staff(db: Kysely<Database>, headers: { authorization?: string; cookie?: string }, minimumRole = 2) {
	const session = await resolveAchilleaSession(headers);
	if (!session) return { error: status(401, { message: "Authentication required" as const }) };
	const actor = await db.selectFrom("user").select(["id", "role"]).where("id", "=", session.id).executeTakeFirst();
	if (!actor || actor.role < minimumRole) return { error: status(403, { message: "Staff role required" as const }) };
	return { session, actor };
}

export const adminController = new Elysia({ prefix: "/admin" })
	.use(dbPlugin)
	.get("/ops/users", async ({ db, headers, query }) => {
		const auth = await staff(db, headers, 2);
		if (auth.error) return auth.error;
		const limit = Math.min(100, Math.max(1, Math.floor(query.pagination ?? 25)));
		const page = Math.max(1, Math.floor(query.page ?? 1));
		const term = query.q?.trim();
		let base = db.selectFrom("user");
		if (term) {
			const pattern = `%${term}%`;
			base = base.where((eb) => eb.or([
				eb("username", "ilike", pattern),
				eb("display_name", "ilike", pattern),
				eb("id", "ilike", pattern),
			]));
		}
		const [rows, count] = await Promise.all([
			base.select(["id", "username", "display_name", "avatar", "role", "last_interact"])
				.orderBy("last_interact", "desc").limit(limit).offset((page - 1) * limit).execute(),
			base.select(({ fn }) => fn.countAll<number>().as("count")).executeTakeFirst(),
		]);
		const total = Number(count?.count ?? 0);
		return {
			data: rows.map((user) => ({
				id: user.id,
				username: user.username,
				displayName: user.display_name,
				avatar: user.avatar,
				role: user.role,
				lastInteract: user.last_interact,
			})),
			meta: { page, limit, total, pageCount: Math.ceil(total / limit) },
		};
	}, {
		query: t.Object({ page: t.Optional(t.Numeric()), pagination: t.Optional(t.Numeric()), q: t.Optional(t.String()) }),
	})
	.get("/ops/wallets", async ({ db, headers, query }) => {
		const auth = await staff(db, headers, 2);
		if (auth.error) return auth.error;
		const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 30)));
		const [top, recent] = await Promise.all([
			db.selectFrom("wallet as wallet")
				.innerJoin("user", "user.id", "wallet.user_id")
				.select([
					"wallet.user_id",
					"wallet.balance",
					"wallet.currency",
					"user.display_name",
					"user.username",
				])
				.orderBy("wallet.balance", "desc").limit(limit).execute(),
			db.selectFrom("transaction")
				.select(["id", "type", "amount", "reason", "from_user_id", "to_user_id", "created_at"])
				.orderBy("created_at", "desc").limit(limit).execute(),
		]);
		return {
			top: top.map((wallet) => ({
				userId: wallet.user_id,
				displayName: wallet.display_name || wallet.username || wallet.user_id,
				balance: Number(wallet.balance),
				currency: wallet.currency,
			})),
			recent: recent.map((transaction) => ({
				id: transaction.id,
				type: transaction.type,
				amount: Number(transaction.amount),
				reason: transaction.reason,
				fromUserId: transaction.from_user_id,
				toUserId: transaction.to_user_id,
				createdAt: transaction.created_at,
			})),
		};
	}, {
		query: t.Object({ limit: t.Optional(t.Numeric()) }),
	})
	.post("/users/:id/role", async ({ db, headers, params: { id }, body }) => {
		const auth = await staff(db, headers, 2);
		if (auth.error) return auth.error;
		const role = Number(body.role);
		if (!Number.isInteger(role) || role < 0 || role > auth.actor.role) return status(400, { message: "Invalid role" as const });
		if (id === auth.actor.id && role < auth.actor.role) return status(403, { message: "Cannot demote yourself" as const });
		const target = await db.selectFrom("user").select("id").where("id", "=", id).executeTakeFirst();
		if (!target) return status(404, { message: "User not found" as const });
		await db.updateTable("user").set({ role }).where("id", "=", id).execute();
		return { success: true as const, id, role };
	}, {
		params: t.Object({ id: t.String() }), body: t.Object({ role: t.Numeric() }),
		response: { 200: t.Object({ success: t.Literal(true), id: t.String(), role: t.Number() }), 400: t.Object({ message: t.String() }), 401: t.Object({ message: t.Literal("Authentication required") }), 403: t.Object({ message: t.String() }), 404: t.Object({ message: t.Literal("User not found") }) },
	})
	.post("/wallets/:userId/adjust", async ({ db, headers, params: { userId }, body }) => {
		const auth = await staff(db, headers, 2);
		if (auth.error) return auth.error;
		const amount = Number(body.amount);
		if (!Number.isFinite(amount) || amount === 0) return status(400, { message: "Amount must be non-zero" as const });
		const target = await db.selectFrom("user").select("id").where("id", "=", userId).executeTakeFirst();
		if (!target) return status(404, { message: "User not found" as const });
		const reason = (body.reason?.trim() || `Staff adjustment by ${auth.actor.id}`).slice(0, 200);
		const balance = await db.transaction().execute(async (trx) => {
			await trx.insertInto("wallet").values({ user_id: userId, balance: "0.00", currency: "ACH" }).onConflict((oc) => oc.column("user_id").doNothing()).execute();
			const wallet = await trx.selectFrom("wallet").select("balance").where("user_id", "=", userId).forUpdate().executeTakeFirstOrThrow();
			if (amount < 0 && Number(wallet.balance) < Math.abs(amount)) throw new Error("Insufficient balance");
			await trx.updateTable("wallet").set({ balance: kyselySql<string>`round(balance + ${amount}, 2)`, updated_at: new Date() }).where("user_id", "=", userId).execute();
			await trx.insertInto("transaction").values({ type: amount > 0 ? "Credit" : "Debit", amount: Math.abs(amount).toFixed(2), reason, from_user_id: amount < 0 ? userId : null, to_user_id: amount > 0 ? userId : null, metadata: { actorId: auth.actor.id } }).execute();
			return Number((Number(wallet.balance) + amount).toFixed(2));
		});
		return { success: true as const, userId, balance };
	}, {
		params: t.Object({ userId: t.String() }), body: t.Object({ amount: t.Numeric(), reason: t.Optional(t.String()) }),
		response: { 200: t.Object({ success: t.Literal(true), userId: t.String(), balance: t.Number() }), 400: t.Object({ message: t.String() }), 401: t.Object({ message: t.Literal("Authentication required") }), 403: t.Object({ message: t.Literal("Staff role required") }), 404: t.Object({ message: t.Literal("User not found") }) },
	});
