declare module "bun" {
  interface Env {
    CRON_SECRET: string;
    AZALEE_URL: string;
    WEBSITE_URL: string;
    DATABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    NEXT_PUBLIC_SUPABASE_URL: string;
  }
}
export {};
