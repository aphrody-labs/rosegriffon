import { createSupabaseServiceClient } from "@rosegriffon/db/service";

const supabaseAdmin = createSupabaseServiceClient();

export async function logAudit(
	userId: string,
	action: string,
	details?: Record<string, any>,
	meta?: { ipAddress?: string; userAgent?: string },
) {
	try {
		await supabaseAdmin.from("audit_logs").insert({
			user_id: userId,
			action,
			details: details || {},
			ip_address: meta?.ipAddress || null,
			user_agent: meta?.userAgent || null,
		});
	} catch (err) {
		console.error("[Audit] Failed to log:", action, err);
	}
}
