import { t } from "elysia";

export const ClanModel = {
	validation: t.Object({
		valid: t.Boolean(),
		code: t.Optional(t.Union([
			t.Literal("INVALID_NAME"), t.Literal("NAME_TAKEN"),
			t.Literal("INVALID_SHORTNAME"), t.Literal("SHORTNAME_TAKEN"),
		])),
	}),
	updateBody: t.Object({
		name: t.Optional(t.String()), shortenedName: t.Optional(t.String()),
		clanBiography: t.Optional(t.String()), clanAvatarUrl: t.Optional(t.String()),
		xUrl: t.Optional(t.Nullable(t.String())), instagramUrl: t.Optional(t.Nullable(t.String())),
		tiktokUrl: t.Optional(t.Nullable(t.String())), isRecruiting: t.Optional(t.Boolean()),
		autoAcceptMembers: t.Optional(t.Boolean()), isInactive: t.Optional(t.Boolean()),
	}),
	updateResponse: t.Object({
		success: t.Literal(true),
		previousName: t.String(), roleId: t.String(),
		clan: t.Object({
			id: t.Number(), name: t.String(), shortName: t.String(), avatarUrl: t.String(),
			biography: t.String(), fame: t.Number(), isRecruiting: t.Boolean(), membersLimit: t.Boolean(),
		}),
	}),
	member: t.Object({
		clanRole: t.Number(), distinctions: t.Array(t.String()), clanFameContributed: t.Number(),
		createdAt: t.Date(), updatedAt: t.Date(),
		user: t.Object({ id: t.String(), type: t.Literal("user"), username: t.String(), avatar: t.String(), clanId: t.Number(), role: t.Number() }),
	}),
	members: t.Array(t.Object({
		clanRole: t.Number(), distinctions: t.Array(t.String()), clanFameContributed: t.Number(),
		createdAt: t.Date(), updatedAt: t.Date(),
		user: t.Object({ id: t.String(), type: t.Literal("user"), username: t.String(), avatar: t.String(), clanId: t.Number(), role: t.Number() }),
	})),
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
