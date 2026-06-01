/** True quand on prerender côté Vercel sans env runtime. */
export declare function isBuildPhase(): boolean;
export declare function getSupabaseUrl(preferInternal?: boolean): string;
export declare function getSupabasePublishableKey(): string;
export declare function getSupabaseServiceRoleKey(): string | null;
