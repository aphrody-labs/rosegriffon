import { XClient, XSession } from "@aphrody-code/x";
import { createSupabaseServiceClient } from "@rose-griffon/db/service";
import { syncThread } from "./sync-specific-thread";

// Répare en masse les threads Azalee tronqués (timeline collapse / thread()
// coupé sur 429 lors du re-crawl). Pour chaque thread stocké, on refetch le
// thread complet et on ne réécrit QUE s'il a plus de tweets (non destructif).
// Throttle + arrêt propre sur rate-limit pour préserver le bucket d'API X.
async function main() {
	const screenName = process.argv[2] || "Azalee_IE";
	const client = new XClient(XSession.loadOrEnv());
	const supabase = createSupabaseServiceClient();

	const { data: threads, error } = await supabase
		.from("tweets")
		.select("id, tweet_count")
		.eq("author_username", screenName)
		.eq("is_thread", true)
		.order("created_at", { ascending: false });

	if (error) {
		console.error("Lecture des threads échouée :", error.message);
		return;
	}
	const list = threads ?? [];
	console.log(`[Heal] ${list.length} threads @${screenName} à vérifier.`);

	let healed = 0;
	let skipped = 0;
	let consecutiveErrors = 0;
	const MAX_CONSECUTIVE_ERRORS = 5;

	for (let i = 0; i < list.length; i++) {
		const row = list[i]!;
		const id = row.id as string;
		const stored = (row.tweet_count as number) ?? 0;
		try {
			const r = await syncThread(client, supabase, id, screenName, { onlyIfLarger: true });
			consecutiveErrors = 0;
			if (r.action === "healed") {
				healed++;
				console.log(`[Heal] ✓ ${id} : ${stored} → ${r.after} tweets RÉPARÉ.`);
			} else {
				skipped++;
				console.log(`[Heal] · ${id} : ${stored} (réel ${r.after}) ${r.action}.`);
			}
		} catch (e) {
			consecutiveErrors++;
			console.warn(
				`[Heal] ! ${id} échec (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}) :`,
				e instanceof Error ? e.message : e
			);
			if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
				console.error(
					`[Heal] Arrêt anticipé : ${MAX_CONSECUTIVE_ERRORS} erreurs consécutives (rate-limit X probable). ` +
						`${i + 1}/${list.length} traités — relancer plus tard pour terminer.`
				);
				break;
			}
		}
		// Throttle anti rate-limit (TweetDetail ≈ 50 req/15min).
		await new Promise((r) => setTimeout(r, 1800));
	}

	console.log(`[Heal] Terminé : ${healed} réparés, ${skipped} déjà complets/inchangés.`);
}

main();
