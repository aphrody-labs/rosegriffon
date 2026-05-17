import jwt from "jsonwebtoken";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!SUPABASE_JWT_SECRET) {
  throw new Error(
    "CRITICAL: SUPABASE_JWT_SECRET is missing from environment variables. Authentication will fail.",
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mint a Supabase-compatible JWT for a given Better Auth user ID.
 * This JWT is accepted by PostgREST so that `auth.uid()` returns the user's UUID
 * and all existing RLS policies continue to work unchanged.
 */
export function mintSupabaseJwt(userId: string): string {
  if (!UUID_RE.test(userId)) {
    throw new Error("mintSupabaseJwt: invalid userId format");
  }
  return jwt.sign(
    {
      sub: userId,
      role: "authenticated",
      iss: "supabase",
      aud: "authenticated",
    },
    SUPABASE_JWT_SECRET!,
    { expiresIn: "1h" },
  );
}
