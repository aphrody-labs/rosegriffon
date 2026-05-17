import { z } from "zod";

export const UserRoleSchema = z.enum([
	"member",
	"staff",
	"team_captain",
	"admin",
	"superadmin",
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
	id: z.string().uuid(),
	discord_id: z.string().nullable(),
	display_name: z.string().min(1).max(50),
	avatar_url: z.url().nullable(),
	email: z.email().nullable(),
	role: UserRoleSchema.default("member"),
	created_at: z.iso.datetime(),
	updated_at: z.iso.datetime(),
});
export type User = z.infer<typeof UserSchema>;
