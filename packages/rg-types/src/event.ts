import { z } from "zod";

export const EventStatusSchema = z.enum([
	"scheduled",
	"live",
	"completed",
	"cancelled",
]);

export const EventSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1).max(120),
	slug: z.string().regex(/^[a-z0-9-]+$/),
	description: z.string().max(2000).nullable(),
	starts_at: z.iso.datetime(),
	ends_at: z.iso.datetime().nullable(),
	status: EventStatusSchema.default("scheduled"),
	stream_url: z.url().nullable(),
	cover_url: z.url().nullable(),
	created_at: z.iso.datetime(),
});
export type Event = z.infer<typeof EventSchema>;
