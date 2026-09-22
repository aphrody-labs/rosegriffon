import { Elysia, status, t } from "elysia";
import { dbPlugin } from "../../../plugins/db";
import { ClanModel } from "./model";
import { ClanService } from "./service";

export const clanController = new Elysia({ prefix: "/clans" })
	.use(dbPlugin)
	.get("/", async ({ db, query }) => {
		return await ClanService.findAll(db, query.page, query.pageSize);
	}, {
		query: t.Object({ page: t.Optional(t.Numeric({ minimum: 1 })), pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })), state: t.Optional(t.Numeric()) }),
		response: {
			200: ClanModel.listResponse
		}
	})
	.get("/:id", async ({ db, params: { id } }) => {
		const item = await ClanService.findById(db, id);
		if (!item) {
			return status(404, { message: "Clan not found" as const });
		}
		return item;
	}, {
		params: t.Object({
			id: t.Numeric()
		}),
		response: {
			200: ClanModel.clan,
			404: ClanModel.notFound
		}
	});
