/** True pendant un prerender de build, sans variables d'environnement runtime. */
export declare function isBuildPhase(): boolean;
export declare function getSupabaseUrl(preferInternal?: boolean): string;
export declare function getSupabasePublishableKey(): string;
export declare function getSupabaseServiceRoleKey(): string | null;
