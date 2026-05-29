import { createSupabaseServiceClient } from "@rose-griffon/db/service";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface MediaItem {
	url: string;
	type: string;
	width?: number;
	height?: number;
	previewUrl?: string;
	original_url?: string;
	original_previewUrl?: string;
}

// Simple helper to detect Japanese characters
const containsJapanese = (text: string) =>
	/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(text);

function escapeRegExp(str: string) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Translation using Google single API
async function translateWithGoogle(text: string, from: string, to: string): Promise<string> {
	if (!text.trim()) return "";
	try {
		const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
		const res = await fetch(url);
		if (res.ok) {
			const data = await res.json() as any;
			if (data && data[0]) {
				return data[0].map((x: any) => x[0]).join("");
			}
		}
	} catch (e) {
		console.warn(`[Translator] Google translation failed from ${from} to ${to}:`, e);
	}
	return text;
}

export async function processTweets() {
	console.log("=== Starting Tweet Processing (Media, Translation, Classification) ===");
	const supabase = createSupabaseServiceClient();

	// Load Glossary for corrections
	let glossary: any = null;
	const glossaryPath = join(process.cwd(), "data", "glossary.json");
	if (existsSync(glossaryPath)) {
		try {
			glossary = JSON.parse(readFileSync(glossaryPath, "utf-8"));
			console.log(`[Glossary] Loaded glossary with ${glossary._meta?.counts?.total || 0} entries.`);
		} catch (e) {
			console.error("[Glossary] Failed to parse glossary.json:", e);
		}
	} else {
		console.warn("[Glossary] glossary.json not found. Translation will proceed without glossary corrections.");
	}

	// Fetch all tweets
	console.log("[DB] Fetching tweets...");
	const { data: tweets, error: fetchErr } = await supabase
		.from("tweets")
		.select("*");

	if (fetchErr) {
		console.error("[DB] Failed to fetch tweets:", fetchErr);
		return;
	}

	console.log(`[DB] Fetched ${tweets.length} tweets.`);

	// Pre-build translation maps from glossary to apply replacement corrections
	const jpToFrMap = new Map<string, string>();
	const enToFrMap = new Map<string, string>();

	if (glossary) {
		const categories = ["characters", "techniques", "auras", "passives", "teams", "items"];
		for (const cat of categories) {
			const list = glossary[cat] || [];
			for (const entry of list) {
				const frVal = entry.fr || entry.name_FR;
				if (!frVal) continue;

				if (entry.ja && entry.ja.trim()) {
					// Clean ja from furigana / brackets
					const cleanJa = entry.ja.split(" ")[0].replaceAll(/[\[\]]/g, "").trim();
					if (cleanJa.length > 1) {
						jpToFrMap.set(cleanJa, frVal);
					}
				}
				if (entry.en && entry.en.trim() && entry.en.toLowerCase() !== frVal.toLowerCase()) {
					enToFrMap.set(entry.en.trim(), frVal);
				}
			}
		}
	}

	// Sort replacements by length descending to replace longer phrases first
	const jpReplacements = Array.from(jpToFrMap.entries()).sort((a, b) => b[0].length - a[0].length);
	const enReplacements = Array.from(enToFrMap.entries()).sort((a, b) => b[0].length - a[0].length);

	let updatedCount = 0;

	for (const tweet of tweets) {
		try {
			console.log(`--- Processing Tweet ${tweet.id} (@${tweet.author_username}) ---`);
			let needsUpdate = false;

			// 1. Process Media URLs
			const mediaArray = (tweet.media as unknown as MediaItem[]) || [];
			const updatedMedia: MediaItem[] = [];

			for (let i = 0; i < mediaArray.length; i++) {
				const item = mediaArray[i];
				if (!item || !item.url) continue;

				const isExternal =
					item.url.includes("pbs.twimg.com") ||
					item.url.includes("video.twimg.com") ||
					!item.url.includes("storage/v1/object/public/tweets");

				if (isExternal) {
					console.log(`[Media] Downloading external media URL: ${item.url}`);
					try {
						const res = await fetch(item.url);
						if (!res.ok) {
							console.warn(`[Media] Failed to fetch media from ${item.url}. Status: ${res.status}`);
							updatedMedia.push(item);
							continue;
						}

						const buffer = Buffer.from(await res.arrayBuffer());
						const contentType = res.headers.get("content-type") || "image/jpeg";
						let ext = "jpg";
						if (contentType.includes("png")) ext = "png";
						else if (contentType.includes("webp")) ext = "webp";
						else if (contentType.includes("gif")) ext = "gif";
						else if (contentType.includes("avif")) ext = "avif";

						const storagePath = `${tweet.id}/${tweet.id}_${i}.${ext}`;
						console.log(`[Media] Uploading to Storage: tweets/${storagePath}`);

						const { error: uploadErr } = await supabase.storage
							.from("tweets")
							.upload(storagePath, buffer, {
								contentType,
								upsert: true,
							});

						if (uploadErr) {
							console.error(`[Media] Upload failed:`, uploadErr);
							updatedMedia.push(item);
						} else {
							const publicUrl = `https://azalee.rosegriffon.fr/storage/v1/object/public/tweets/${storagePath}`;
							const originalUrl = item.original_url || item.url;
							const originalPreviewUrl = item.original_previewUrl || item.previewUrl;

							updatedMedia.push({
								...item,
								url: publicUrl,
								previewUrl: publicUrl,
								original_url: originalUrl,
								original_previewUrl: originalPreviewUrl,
							});
							needsUpdate = true;
						}
					} catch (mediaErr) {
						console.error(`[Media] Error processing media URL ${item.url}:`, mediaErr);
						updatedMedia.push(item);
					}
				} else {
					updatedMedia.push(item);
				}
			}

			// Update raw_tweets media references as well
			let updatedRawTweets = tweet.raw_tweets;
			if (needsUpdate && Array.isArray(updatedRawTweets)) {
				updatedRawTweets = updatedRawTweets.map((rt: any) => {
					if (rt && Array.isArray(rt.media)) {
						const newRtMedia = rt.media.map((m: any) => {
							if (m && typeof m.url === "string") {
								const match = updatedMedia.find(
									(um) => um.original_url === m.url || um.url === m.url
								);
								if (match) {
									return { ...m, url: match.url };
								}
							}
							return m;
						});
						return { ...rt, media: newRtMedia };
					}
					return rt;
				});
			}

			// 2. Translate text if missing or update
			let translation = tweet.translation;
			const originalText = tweet.text || "";

			if (!translation) {
				if (tweet.author_username === "Azalee_IE") {
					// Azalee writes in French already
					translation = originalText;
					needsUpdate = true;
				} else {
					console.log(`[Translation] Translating tweet text...`);
					const isJa = containsJapanese(originalText);
					const sourceLang = isJa ? "ja" : "en";
					let translated = await translateWithGoogle(originalText, sourceLang, "fr");

					// Apply glossary corrections
					if (isJa) {
						for (const [jpTerm, frTerm] of jpReplacements) {
							translated = translated.replaceAll(jpTerm, frTerm);
						}
					} else {
						for (const [enTerm, frTerm] of enReplacements) {
							const regex = new RegExp("\\b" + escapeRegExp(enTerm) + "\\b", "gi");
							translated = translated.replace(regex, frTerm);
						}
					}

					translation = translated;
					needsUpdate = true;
					console.log(`[Translation] Translated: "${originalText.slice(0, 40)}..." -> "${translation.slice(0, 40)}..."`);
				}
			}

			// 3. Classify tweet if missing or update
			let category = tweet.category;
			if (!category) {
				console.log(`[Classification] Classifying tweet...`);
				const lowerText = originalText.toLowerCase() + " " + (translation || "").toLowerCase();
				
				if (/leak|rumeur|leaké|corocoro leak|scans corocoro|famitsu leak/i.test(lowerText)) {
					category = "leak";
				} else if (/patch|version|mise à jour|maj|patch note|ver\.|ver_/i.test(lowerText)) {
					category = "patch-note";
				} else if (/fan|communauté|fan-art|dessin|concours|création/i.test(lowerText)) {
					category = "fan-content";
				} else if (/trailer|pv|vidéo|scan|média|teaser|illustration|image|screenshot/i.test(lowerText)) {
					category = "media";
				} else {
					category = "news";
				}

				needsUpdate = true;
				console.log(`[Classification] Categorized as: ${category}`);
			}

			if (needsUpdate) {
				const { error: updateErr } = await supabase
					.from("tweets")
					.update({
						media: updatedMedia as any,
						raw_tweets: updatedRawTweets as any,
						translation,
						category,
						updated_at: new Date().toISOString(),
					})
					.eq("id", tweet.id);

				if (updateErr) {
					console.error(`[DB] Failed to update tweet ${tweet.id}:`, updateErr);
				} else {
					console.log(`[DB] Successfully updated tweet ${tweet.id}`);
					updatedCount++;
				}
			} else {
				console.log(`[Skip] Tweet ${tweet.id} already up-to-date.`);
			}
		} catch (tweetErr) {
			console.error(`Error processing tweet ${tweet.id}:`, tweetErr);
		}
	}

	console.log(`=== Tweet Processing Finished. Updated ${updatedCount} tweets. ===`);
}

// Standalone execution support
if (import.meta.main) {
	processTweets().catch(console.error);
}
