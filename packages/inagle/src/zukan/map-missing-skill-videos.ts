/**
 * map-missing-skill-videos.ts
 *
 * Audit + comble les `inagle_skills` réels (internal_code wh%/rh%) sans vidéo.
 *
 * Source vidéo officielle : scrape `zukan.inazuma.jp` dans /tmp/zukan/.
 * Chaque page skill (en) liste 50 skills via <li> : nom EN + data-movie-url (.wmv)
 * + data-poster-url (.jpg) pointant sur dxi4wb638ujep.cloudfront.net.
 * La DB stocke la version .webm (même path/hash, ext swap — CloudFront sert les deux).
 *
 * Deux stratégies de comblage :
 *  1. Match par nom EN exact contre les pages zukan (.wmv -> .webm).
 *  2. Variantes "Dreamscape" (夢限定 / "Rêve :") = reskins qui réutilisent
 *     l'animation du move de base. On copie video_url/poster_url du move parent.
 *
 * Écriture : UNIQUEMENT inagle_skills.video_url / poster_url.
 *
 * Usage : bun packages/inagle/src/zukan/map-missing-skill-videos.ts [--apply]
 *   sans --apply : dry-run (audit + plan, aucune écriture).
 */
import fs from "node:fs";
import path from "node:path";
import { createSupabaseServiceClient } from "../../../db/src/service.ts";

const ZUKAN_SKILL_DIR = "/tmp/zukan/zukan.inazuma.jp/en/skill";

// Dreamscape (夢限定) reskins -> move de base dont on réutilise l'animation.
const DREAMSCAPE_BASE: Record<string, string> = {
	whd00011: "whd00010", // Rêve : Le Mur     <- The Wall
	whk00011: "whk00010", // Rêve : Main céleste <- God Hand
	whs00061: "whs00060", // Rêve : Choc du dragon <- Dragon Crash
};

function normalize(name: string): string {
	return name
		.replace(/<[^>]+>/g, "")
		.trim()
		.toLowerCase();
}

/** Parse toutes les pages skill EN -> Map nom_en(normalisé) -> { videoUrl, posterUrl }. */
function buildZukanNameMap(): Map<string, { videoUrl: string; posterUrl: string }> {
	const map = new Map<string, { videoUrl: string; posterUrl: string }>();
	if (!fs.existsSync(ZUKAN_SKILL_DIR)) {
		console.warn(`[map] zukan scrape introuvable: ${ZUKAN_SKILL_DIR}`);
		return map;
	}
	const files = fs.readdirSync(ZUKAN_SKILL_DIR).filter((f) => f.endsWith(".html"));
	const re =
		/<span class="name"><ruby>(.*?)<\/ruby><\/span>[\s\S]*?data-movie-url="([^"]+)" data-poster-url="([^"]+)"/g;

	for (const file of files) {
		const html = fs.readFileSync(path.join(ZUKAN_SKILL_DIR, file), "utf-8");
		let m: RegExpExecArray | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: exec loop idiom
		while ((m = re.exec(html)) !== null) {
			const key = normalize(m[1]);
			if (!key || map.has(key)) {
				continue;
			}
			const wmv = m[2].split("_external/").pop() ?? "";
			const jpg = m[3].split("_external/").pop() ?? "";
			// .wmv -> .webm (même hash, CloudFront sert les deux)
			const videoUrl = `https://${wmv}`.replace(/\.wmv$/, ".webm");
			map.set(key, { posterUrl: `https://${jpg}`, videoUrl });
		}
	}
	return map;
}

async function main() {
	const apply = process.argv.includes("--apply");
	const supabase = createSupabaseServiceClient();

	const { data: skills, error } = await supabase
		.from("inagle_skills")
		.select("id, internal_code, name_en, name_fr, video_url, poster_url")
		.or("internal_code.like.wh%,internal_code.like.rh%");
	if (error) {
		console.error("Erreur lecture inagle_skills:", error);
		return;
	}

	const missing = (skills ?? []).filter((s) => !s.video_url);
	console.log(`Skills réels: ${skills?.length} — sans vidéo: ${missing.length}`);

	const zukanByName = buildZukanNameMap();
	console.log(`Noms zukan parsés: ${zukanByName.size}`);

	// Index DB par internal_code pour résoudre les bases Dreamscape.
	const byCode = new Map((skills ?? []).map((s) => [s.internal_code, s]));

	const updates: Array<{ id: string; video_url: string; poster_url: string; via: string }> = [];
	const unresolved: typeof missing = [];

	for (const s of missing) {
		// 1) Dreamscape reuse
		const baseCode = s.internal_code ? DREAMSCAPE_BASE[s.internal_code] : undefined;
		if (baseCode) {
			const base = byCode.get(baseCode);
			if (base?.video_url) {
				updates.push({
					id: s.id,
					poster_url: base.poster_url ?? "",
					via: `dreamscape<-${baseCode}`,
					video_url: base.video_url,
				});
				continue;
			}
		}
		// 2) Match nom EN
		const hit = s.name_en ? zukanByName.get(normalize(s.name_en)) : undefined;
		if (hit) {
			updates.push({
				id: s.id,
				poster_url: hit.posterUrl,
				via: "name_en",
				video_url: hit.videoUrl,
			});
			continue;
		}
		unresolved.push(s);
	}

	console.log(`\nÀ combler (${updates.length}):`);
	for (const u of updates) {
		console.log(`  ${u.id}  via ${u.via}  -> ${u.video_url}`);
	}
	console.log(`\nSans vidéo upstream (${unresolved.length}):`);
	for (const s of unresolved) {
		console.log(`  ${s.internal_code}  ${s.name_fr ?? ""} (${s.name_en ?? ""})`);
	}

	if (!apply) {
		console.log("\n[dry-run] relancer avec --apply pour écrire.");
		return;
	}

	for (const u of updates) {
		const patch: { video_url: string; poster_url?: string } = { video_url: u.video_url };
		if (u.poster_url) {
			patch.poster_url = u.poster_url;
		}
		const { error: upErr } = await supabase.from("inagle_skills").update(patch).eq("id", u.id);
		if (upErr) {
			console.error(`  ✗ ${u.id}:`, upErr.message);
		} else {
			console.log(`  ✓ ${u.id}`);
		}
	}
}

main().catch(console.error);
