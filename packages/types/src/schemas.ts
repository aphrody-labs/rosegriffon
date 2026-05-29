import { z } from "zod";

// ============================================================================
// Roles & Authentication
// ============================================================================

/** Schema for Rose Griffon user roles. */
export const rgRoleSchema = z.enum(["admin", "editor", "moderator", "member", "guest"]);

// ============================================================================
// Articles & Chronicles
// ============================================================================

/** Schema for validating article/chronique inputs. */
export const articleSchema = z.object({
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
	status: z.enum(["draft", "published", "scheduled", "archived"]).default("draft"),
	title: z.string().min(1, "Le titre est requis"),
});

export type ArticleInput = z.infer<typeof articleSchema>;

// ============================================================================
// Tweets
// ============================================================================

/** Schema for validating tweet objects. */
export const tweetSchema = z.object({
	author_name: z.string().min(1, "Nom requis"),
	author_username: z.string().min(1, "Nom d'utilisateur requis"),
	id: z.string().optional(),
	text: z.string().min(1, "Le contenu ne peut pas être vide"),
});

export type TweetInput = z.infer<typeof tweetSchema>;

// ============================================================================
// Contact
// ============================================================================

/** Schema for the contact form. */
export const contactFormSchema = z.object({
	description: z.string().min(10, {
		message: "La description doit contenir au moins 10 caractères.",
	}),
	subject: z.enum(
		[
			"Information sur l'association",
			"Collaboration",
			"Don et soutien",
			"Événements à venir",
			"Adhésion",
			"Bénévolat",
			"Demande de presse",
			"Témoignage",
			"Support technique",
			"Autres",
		],
		{
			message: "Veuillez sélectionner un sujet.",
		}
	),
	title: z.string().min(2, {
		message: "Le titre doit contenir au moins 2 caractères.",
	}),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
