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
