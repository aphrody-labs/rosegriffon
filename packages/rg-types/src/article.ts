import { z } from "zod";

export const ArticleStatusSchema = z.enum(["draft", "published", "archived"]);

export const ArticleSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1).max(160),
	slug: z.string().regex(/^[a-z0-9-]+$/),
	excerpt: z.string().max(280).nullable(),
	content: z.string(),
	author_id: z.string().uuid(),
	cover_url: z.url().nullable(),
	status: ArticleStatusSchema.default("draft"),
	published_at: z.iso.datetime().nullable(),
	created_at: z.iso.datetime(),
	updated_at: z.iso.datetime(),
});
export type Article = z.infer<typeof ArticleSchema>;
