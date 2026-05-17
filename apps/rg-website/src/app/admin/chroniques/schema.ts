import { z } from "zod";

export const ArticleSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  slug: z
    .string()
    .min(1, "Le slug est requis")
    .regex(
      /^[a-z0-9-]+$/,
      "Le slug ne doit contenir que des lettres minuscules, des chiffres et des tirets"
    ),
  excerpt: z.string().optional().nullable(),
  content: z.string().min(1, "Le contenu est requis"),
  category: z.string().optional().nullable(),
  featured_image_url: z.string().optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  author_id: z.string().optional().nullable(),
});

export type ArticleInput = z.infer<typeof ArticleSchema>;
