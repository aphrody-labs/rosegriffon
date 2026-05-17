import { z } from "zod";

export const searchParamsSchema = z.object({
  q: z.string().optional().default(""),
  page: z
    .string()
    .transform((val) => Math.max(1, parseInt(val, 10)))
    .optional()
    .default(1),
  element: z.string().optional(),
  position: z.string().optional(),
  rarity: z.string().optional(),
  gender: z.string().optional(),
  grade: z.string().optional(),
  team: z.string().optional(),
  tab: z.string().optional(),
  type: z.string().optional(),
  has_video: z.string().optional(),
  sort: z.string().optional(),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

export function parseSearchParams(params: unknown): SearchParams {
  const result = searchParamsSchema.safeParse(params);
  if (!result.success) {
    return {
      q: "",
      page: 1,
    };
  }
  return result.data;
}
