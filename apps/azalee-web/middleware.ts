import { type NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/settings"];
const API_PROTECTED_PATHS = ["/api/dashboard"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedPage = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isProtectedApi = API_PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  // Quick guard: check cookie presence (full validation happens server-side in layouts/pages)
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/api/dashboard/:path*"],
};
