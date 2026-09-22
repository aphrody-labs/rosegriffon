import { t } from "elysia";

export const ClanModel = {
	clan: t.Object({
		id: t.Number(),
		name: t.String(),
		shortName: t.String(),
		avatarUrl: t.String(),
		biography: t.String(),
		fame: t.Number(),
		isRecruiting: t.Boolean(),
		membersLimit: t.Boolean()
	}),
	listResponse: t.Object({
		data: t.Array(
			t.Object({
				id: t.Number(),
				name: t.String(),
				shortName: t.String(),
				avatarUrl: t.String(),
				biography: t.String(),
				fame: t.Number(),
				isRecruiting: t.Boolean(),
				membersLimit: t.Boolean()
			})
		),
		count: t.Number()
	}),
	notFound: t.Object({
		message: t.Literal("Clan not found")
	})
} as const;

export type ClanDTO = typeof ClanModel.clan.static;
