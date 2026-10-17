import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/api-auth";
import { etatDuCron, historiqueDuCron } from "@/lib/bot/cron";

export const dynamic = "force-dynamic";

/**
 * `GET /api/admin/cron` — état de l'ordonnanceur et catalogue de ses tâches.
 *
 * Le catalogue vient de `GET /v1/cron`, l'état de `public.cron_executions`.
 */
export async function GET() {
  const garde = await requireApiAdmin();
  if (!garde.ok) {
    return garde.response;
  }

  const [cron, historique] = await Promise.all([etatDuCron(), historiqueDuCron()]);

  return NextResponse.json(
    { cron, historique, role: garde.data.role },
    { headers: { "cache-control": "private, no-store" } },
  );
}
