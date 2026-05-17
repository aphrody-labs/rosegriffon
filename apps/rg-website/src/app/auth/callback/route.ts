import { NextResponse } from "next/server";

// Better Auth gère les callbacks OAuth à /api/auth/callback/:provider.
// Cette route est conservée pour compatibilité avec d'anciens liens.
//
// ⚠️ `new URL(request.url).origin` renvoie `http://localhost:3005` derrière
// nginx (Node bind sur loopback). Sans fix, le browser boucle à l'infini
// sur un host inaccessible. On privilégie l'env publique, puis les headers
// x-forwarded-*, et en dernier recours l'URL interne.
export async function GET(request: Request) {
  const publicOrigin =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_URL ||
    publicOriginFromHeaders(request) ||
    new URL(request.url).origin;
  return NextResponse.redirect(`${publicOrigin}/dashboard`);
}

function publicOriginFromHeaders(request: Request): string | null {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (!host || host.startsWith("localhost") || host.startsWith("127.")) {
    return null;
  }
  return `${proto}://${host}`;
}
