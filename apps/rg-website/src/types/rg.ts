import type { Database } from "./supabase";

// ==============================================================================
// 🛠️ Helpers Supabase
// ==============================================================================

/**
 * Helper pour récupérer le type d'une ligne (Row) d'une table.
 * @example type Article = Tables<"articles">;
 */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/**
 * Helper pour récupérer le type d'insertion (Insert) d'une table.
 * @example type NewArticle = Insert<"articles">;
 */
export type Insert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/**
 * Helper pour récupérer le type de mise à jour (Update) d'une table.
 * @example type ArticleUpdate = Update<"articles">;
 */
export type Update<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

/**
 * Helper pour récupérer les Enums de la base de données.
 * @example type UserRole = Enums<"user_role">;
 */
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

// ==============================================================================
// 📦 Entités Métier (Alias)
// ==============================================================================

// Utilisateurs & Profils
export type Profile = Tables<"profiles">;
export type User = Profile; // Alias commun

// Contenu : Articles & Chroniques
export type Article = Tables<"articles">;
export type ArticleCategory = Tables<"article_categories">;
export type Chronicle = Tables<"chronicles">;
// TODO: table dropped post-migration
// export type Category = Tables<"categories">;

// Événements & Planning
export type Event = Tables<"events">;
export type StreamSchedule = Tables<"stream_schedules">;

// Administration & Logs
// TODO: table dropped post-migration
// export type AdminLog = Tables<"admin_logs">;
// TODO: table dropped post-migration
// export type BotLog = Tables<"bot_logs">;
export type Setting = Tables<"settings">;
export type EmailTemplate = Tables<"email_templates">;

// Fonctionnalités Spécifiques
// TODO: table dropped post-migration
// export type AnimationExport = Tables<"animations_exports">;
// TODO: table dropped post-migration
// export type ChristmasCleat = Tables<"christmas_cleats">;
// TODO: table dropped post-migration
// export type ChristmasTierList = Tables<"christmas_tier_lists">;
// TODO: table dropped post-migration
// export type NoelCrampon = Tables<"noel_crampons">;
export type TeamMember = Tables<"team_members">;

// ==============================================================================
// 🧩 Types Utilitaires
// ==============================================================================

/**
 * Type pour une réponse d'API standard.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Type pour les paramètres de pagination.
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Type pour les résultats paginés.
 */
export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  totalPages: number;
}
