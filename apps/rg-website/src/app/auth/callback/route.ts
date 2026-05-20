import { NextResponse } from "next/server";

// Better Auth gère les callbacks OAuth à /api/auth/callback/:provider.
// Cette route est conservée pour compatibilité avec d'anciens liens.
//
// Fail fast au lieu de fallback vers localhost (qui ferait boucler le
// Browser sur un host inaccessible derrière nginx). Si aucune origin
// Publique n'est résolvable, retourner 500 pour signaler la config cassée.
export async function GET(request: Request) {
	const publicOrigin =
		process.env.BETTER_AUTH_URL ||
		process.env.NEXT_PUBLIC_URL ||
		publicOriginFromHeaders(request);

	if (!publicOrigin) {
		console.error(
			"[auth/callback] no public origin resolvable (BETTER_AUTH_URL/NEXT_PUBLIC_URL missing + no x-forwarded-host)",
		);
		return new NextResponse("auth callback misconfigured", { status: 500 });
	}
	return NextResponse.redirect(`${publicOrigin}/dashboard`);
}

function publicOriginFromHeaders(request: Request): string | null {
	const host =
		request.headers.get("x-forwarded-host") ?? request.headers.get("host");
	const proto = request.headers.get("x-forwarded-proto") ?? "https";
	if (!host || host.startsWith("localhost") || host.startsWith("127.")) {
		return null;
	}
	return `${proto}://${host}`;
}
