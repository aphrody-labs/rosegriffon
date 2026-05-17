import { z } from "zod";

export const StreamPlatformSchema = z.enum(["twitch", "youtube", "kick"]);

export const StreamSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	platform: StreamPlatformSchema,
	channel_name: z.string().min(1).max(100),
	channel_url: z.url(),
	is_live: z.boolean().default(false),
	title: z.string().nullable(),
	viewer_count: z.number().int().min(0).nullable(),
	thumbnail_url: z.url().nullable(),
	last_seen_at: z.iso.datetime().nullable(),
});
export type Stream = z.infer<typeof StreamSchema>;
