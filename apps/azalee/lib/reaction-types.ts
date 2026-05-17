export const REACTION_TYPES = ["like", "fire", "clap", "mind_blown", "sad"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: "❤️",
  fire: "🔥",
  clap: "👏",
  mind_blown: "🤯",
  sad: "😢",
};
