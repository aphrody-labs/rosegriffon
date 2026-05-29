import { articleSchema } from "@rose-griffon/types/schemas";
import type { ArticleInput as SharedArticleInput } from "@rose-griffon/types/schemas";

export const ArticleSchema = articleSchema;
export type ArticleInput = SharedArticleInput;

