import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/admin", "/profil/settings"];

/**
 * Optimistic auth check — `getSessionCookie` lit le cookie de session Better Auth
 * en respectant la config (incluant préfixe `__Secure-` quand `useSecureCookies: true`).
 * Pas de validation crypto ici — juste un check d'existence pour rediriger vite.
 * La validation forte est faite côté pages via `auth.api.getSession()` dans `auth-helpers.ts`.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/profil/settings/:path*"],
};
