// DEBUG ONLY — endpoint pour capturer le full message BetterAuthError sur Vercel runtime.
// À retirer après diagnostic.
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	const debug: Record<string, unknown> = {
		now: new Date().toISOString(),
		env: {
			NODE_ENV: process.env.NODE_ENV,
			VERCEL_ENV: process.env.VERCEL_ENV,
			BETTER_AUTH_URL: process.env.BETTER_AUTH_URL?.slice(0, 50),
			BETTER_AUTH_SECRET_len: process.env.BETTER_AUTH_SECRET?.length,
			DATABASE_URL_starts: process.env.DATABASE_URL?.slice(0, 20),
			SUPABASE_INTERNAL_URL: process.env.SUPABASE_INTERNAL_URL?.slice(0, 60),
		},
		authShape: {
			hasApi: typeof (auth as unknown as { api?: unknown })?.api === "object",
			hasGetSession:
				typeof (auth as unknown as { api?: { getSession?: unknown } })?.api
					?.getSession === "function",
		},
	};

	try {
		const reqHeaders = await headers();
		debug.headers = {
			host: reqHeaders.get("host"),
			origin: reqHeaders.get("origin"),
			"x-forwarded-host": reqHeaders.get("x-forwarded-host"),
		};
		const session = await auth.api.getSession({ headers: reqHeaders });
		debug.session = session ? { userId: session.user?.id } : null;
		debug.ok = true;
	} catch (e) {
		debug.ok = false;
		debug.error = {
			name: e instanceof Error ? e.constructor.name : typeof e,
			message: e instanceof Error ? e.message : String(e),
			stack: e instanceof Error ? e.stack?.split("\n").slice(0, 10) : null,
			cause:
				e instanceof Error && e.cause
					? String((e.cause as { message?: string }).message ?? e.cause)
					: null,
		};
	}

	return NextResponse.json(debug, { status: 200 });
}
