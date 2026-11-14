import { NextResponse } from "next/server";
import { MONOREPO_OPENAPI } from "@rosegriffon/config/openapi";

export const revalidate = 300;

export function GET() {
  return NextResponse.json(MONOREPO_OPENAPI, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}
