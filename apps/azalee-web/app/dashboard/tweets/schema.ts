import { z } from "zod";

export const TweetSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, "Le contenu ne peut pas être vide"),
  author_username: z.string().min(1, "Nom d'utilisateur requis"),
  author_name: z.string().min(1, "Nom requis"),
});

export type TweetFormValues = z.infer<typeof TweetSchema>;
