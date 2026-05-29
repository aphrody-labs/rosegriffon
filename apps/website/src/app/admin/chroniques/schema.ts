import { z } from "zod";

export const ArticleSchema = z.object({
	author_id: z.string().optional().nullable(),
	category: z.string().optional().nullable(),
	content: z.string().min(1, "Le contenu est requis"),
	excerpt: z.string().optional().nullable(),
	featured_image_url: z.string().optional().nullable(),
	slug: z
		.string()
		.min(1, "Le slug est requis")
		.regex(
			/^[a-z0-9-]+$/,
			"Le slug ne doit contenir que des lettres minuscules, des chiffres et des tirets"
		),
	status: z.enum(["draft", "published", "archived"]).default("draft"),
	title: z.string().min(1, "Le titre est requis"),
});

export type ArticleInput = z.infer<typeof ArticleSchema>;
