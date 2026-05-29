import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { get } from "@vercel/edge-config";

const PROTECTED_PATHS = ["/dashboard", "/admin", "/profil/settings"];

export async function middleware(request: NextRequest) {
	// 1. Zero-latency maintenance mode via Edge Config
	try {
		// Only check if EDGE_CONFIG is available in the environment
		if (process.env.EDGE_CONFIG) {
			const isMaintenanceMode = await get<boolean>("maintenanceMode");
			if (isMaintenanceMode && request.nextUrl.pathname !== "/maintenance") {
				request.nextUrl.pathname = `/maintenance`;
				return NextResponse.rewrite(request.nextUrl);
			}
		}
	} catch (error) {
		console.error("[Middleware] Edge Config Error:", error);
	}

	const { pathname } = request.nextUrl;
	const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
	if (!isProtected) {
		return NextResponse.next();
	}

	// 2. Optimistic Auth Check
	const sessionCookie = getSessionCookie(request);
	if (!sessionCookie) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sitemap.xml, robots.txt (metadata files)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|logo.webp).*)",
	],
};
