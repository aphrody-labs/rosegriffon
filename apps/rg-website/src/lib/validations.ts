import { z } from "zod";

export const searchParamsSchema = z.object({
  element: z.string().optional(),
  gender: z.string().optional(),
  grade: z.string().optional(),
  has_video: z.string().optional(),
  page: z
    .string()
    .transform((val) => Math.max(1, parseInt(val, 10)))
    .optional()
    .default(1),
  position: z.string().optional(),
  q: z.string().optional().default(""),
  rarity: z.string().optional(),
  sort: z.string().optional(),
  tab: z.string().optional(),
  team: z.string().optional(),
  type: z.string().optional(),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

export function parseSearchParams(params: unknown): SearchParams {
  const result = searchParamsSchema.safeParse(params);
  if (!result.success) {
    return {
      page: 1,
      q: "",
    };
  }
  return result.data;
}
