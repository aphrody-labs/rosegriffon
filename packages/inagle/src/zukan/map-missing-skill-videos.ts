/**
 * map-missing-skill-videos.ts
 *
 * Peuple les vidéos officielles des techniques `inagle_skills` depuis
 * `zukan.inazuma.jp`.
 *
 * SOURCE : deux `fetch()` statiques (`/{en,ja}/skill/?per_page=500&page={1,2}`).
 * Le catalogue est rendu côté serveur — l'ancien répertoire scrappé
 * `/tmp/zukan/**` n'existe plus et n'est plus nécessaire.
 *
 * MATCHING, dans cet ordre :
 *  1. nom EN normalisé ;
 *  2. nom JA normalisé (secours pour les libellés EN divergents) ;
 *  3. variantes « Dreamscape » (夢限定 / « Rêve : ») = reskins qui réutilisent
 *     l'animation du move de base — on recopie ses vidéos.
 * Rien d'autre : une technique sans correspondance reste NULL. On ne fabrique
 * pas de correspondance approximative.
 *
 * ÉCRITURE :
 *  - `inagle_skills.video_url` / `poster_url` = vidéo PRINCIPALE (position 0) ;
 *  - `inagle_skill_videos` = TOUTES les variantes (236 techniques en ont deux,
 *    ce qu'une colonne scalaire ne peut pas porter).
 *    Cf. apps/website/sql/migrations/20260813_inagle_skill_videos.sql
 *
 * Usage : bun packages/inagle/src/zukan/map-missing-skill-videos.ts [--apply] [--all]
 *   sans --apply : dry-run (audit + plan, aucune écriture).
 *   --all : traite toutes les techniques, pas seulement celles sans vidéo.
 */
import { SQL } from "bun";
import { fetchZukanSkillIndex, normalizeSkillName } from "./skill-videos.js";
import type { ZukanSkill, ZukanSkillVideo } from "./types.js";

// Dreamscape (夢限定) reskins -> move de base dont on réutilise l'animation.
const DREAMSCAPE_BASE: Record<string, string> = {
	whd00011: "whd00010", // Rêve : Le Mur     <- The Wall
	whk00011: "whk00010", // Rêve : Main céleste <- God Hand
	whs00061: "whs00060", // Rêve : Choc du dragon <- Dragon Crash
};

interface SkillRow {
	id: string;
	internal_code: string | null;
	name_en: string | null;
	name_fr: string | null;
	name_ja: string | null;
	video_url: string | null;
	poster_url: string | null;
}

interface Plan {
	id: string;
	via: string;
	videos: ZukanSkillVideo[];
	thumbnailUrl: string | null;
	source: "zukan" | "dreamscape";
}

function planFor(
	row: SkillRow,
	skill: ZukanSkill,
	via: string,
	source: "zukan" | "dreamscape"
): Plan | null {
	if (skill.videos.length === 0) return null;
	return { id: row.id, source, thumbnailUrl: skill.thumbnailUrl, via, videos: skill.videos };
}

async function main() {
	const apply = process.argv.includes("--apply");
	const all = process.argv.includes("--all");

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error("DATABASE_URL manquante.");
		process.exit(1);
	}
	const sql = new SQL(databaseUrl);

	// Les techniques réelles du jeu : `wh%` (waza) et `rh%` (moves de base).
	// Les `swap_skill_waza_*` sont des emplacements techniques, pas des techniques.
	const rows = (await sql`
		select id, internal_code, name_en, name_fr, name_ja, video_url, poster_url
		from inagle_skills
		where internal_code like 'wh%' or internal_code like 'rh%'
		order by internal_code
	`) as unknown as SkillRow[];

	const targets = all ? rows : rows.filter((r) => !r.video_url);
	console.log(`Techniques réelles: ${rows.length} — à traiter: ${targets.length}`);

	const index = await fetchZukanSkillIndex();
	console.log(
		`zukan: ${index.en.length} techniques EN, ${index.ja.length} JA — ` +
			`${index.en.filter((s) => s.videos.length > 1).length} avec 2 vidéos`
	);

	const plans: Plan[] = [];
	const unresolved: SkillRow[] = [];
	const byCode = new Map(rows.map((r) => [r.internal_code ?? "", r]));
	const planById = new Map<string, Plan>();

	for (const row of targets) {
		// 1) nom EN
		const en = row.name_en ? index.byNameEn.get(normalizeSkillName(row.name_en)) : undefined;
		if (en) {
			const p = planFor(row, en, "name_en", "zukan");
			if (p) {
				plans.push(p);
				planById.set(row.id, p);
				continue;
			}
		}
		// 2) nom JA
		const ja = row.name_ja ? index.byNameJa.get(normalizeSkillName(row.name_ja)) : undefined;
		if (ja) {
			const p = planFor(row, ja, "name_ja", "zukan");
			if (p) {
				plans.push(p);
				planById.set(row.id, p);
				continue;
			}
		}
		unresolved.push(row);
	}

	// 3) Dreamscape : reskins qui empruntent l'animation de leur move parent.
	const stillMissing: SkillRow[] = [];
	for (const row of unresolved) {
		const baseCode = row.internal_code ? DREAMSCAPE_BASE[row.internal_code] : undefined;
		const base = baseCode ? byCode.get(baseCode) : undefined;
		if (!base) {
			stillMissing.push(row);
			continue;
		}
		// La base a soit été planifiée dans cette passe, soit déjà des vidéos en DB.
		const basePlan = planById.get(base.id);
		if (basePlan) {
			plans.push({
				id: row.id,
				source: "dreamscape",
				thumbnailUrl: basePlan.thumbnailUrl,
				via: `dreamscape<-${baseCode}`,
				videos: basePlan.videos,
			});
			continue;
		}
		const baseEn = base.name_en ? index.byNameEn.get(normalizeSkillName(base.name_en)) : undefined;
		if (baseEn?.videos.length) {
			plans.push({
				id: row.id,
				source: "dreamscape",
				thumbnailUrl: baseEn.thumbnailUrl,
				via: `dreamscape<-${baseCode}`,
				videos: baseEn.videos,
			});
			continue;
		}
		stillMissing.push(row);
	}

	const multi = plans.filter((p) => p.videos.length > 1).length;
	const totalVideos = plans.reduce((n, p) => n + p.videos.length, 0);
	console.log(
		`\nPlanifié: ${plans.length} techniques, ${totalVideos} vidéos (${multi} techniques à 2 vidéos)`
	);
	const viaCount = new Map<string, number>();
	for (const p of plans) {
		const key = p.via.startsWith("dreamscape") ? "dreamscape" : p.via;
		viaCount.set(key, (viaCount.get(key) ?? 0) + 1);
	}
	for (const [k, v] of viaCount) console.log(`  via ${k}: ${v}`);

	console.log(`\nSans vidéo upstream (${stillMissing.length}) — laissés NULL:`);
	for (const s of stillMissing) {
		console.log(`  ${s.internal_code}  ${s.name_fr ?? ""} (${s.name_en ?? ""})`);
	}

	if (!apply) {
		console.log("\n[dry-run] relancer avec --apply pour écrire.");
		await sql.end();
		return;
	}

	let skillsUpdated = 0;
	let videosUpserted = 0;
	for (const p of plans) {
		const primary = p.videos[0];
		if (!primary?.videoUrl) continue;
		await sql`
			update inagle_skills
			   set video_url = ${primary.videoUrl},
			       poster_url = ${primary.posterUrl},
			       updated_at = now()
			 where id = ${p.id}
		`;
		skillsUpdated++;
		for (const v of p.videos) {
			if (!v.videoUrl) continue;
			await sql`
				insert into inagle_skill_videos
					(skill_id, position, label, video_url, poster_url, thumbnail_url, source)
				values (${p.id}, ${v.position}, ${v.label}, ${v.videoUrl}, ${v.posterUrl}, ${p.thumbnailUrl}, ${p.source})
				on conflict (skill_id, position) do update
					set label = excluded.label,
					    video_url = excluded.video_url,
					    poster_url = excluded.poster_url,
					    thumbnail_url = excluded.thumbnail_url,
					    source = excluded.source,
					    updated_at = now()
			`;
			videosUpserted++;
		}
	}

	console.log(`\ninagle_skills mis à jour: ${skillsUpdated}`);
	console.log(`inagle_skill_videos écrits: ${videosUpserted}`);
	await sql.end();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
