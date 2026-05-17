import { z } from "zod";

export const TeamMemberSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	team_id: z.string().uuid(),
	role: z.enum(["player", "captain", "coach", "manager"]),
	joined_at: z.iso.datetime(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(50),
	slug: z.string().regex(/^[a-z0-9-]+$/),
	logo_url: z.url().nullable(),
	description: z.string().max(500).nullable(),
	created_at: z.iso.datetime(),
});
export type Team = z.infer<typeof TeamSchema>;
