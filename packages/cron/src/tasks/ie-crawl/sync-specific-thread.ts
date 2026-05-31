import { XClient, XSession } from "@aphrody-code/x";
import { createSupabaseServiceClient } from "@rose-griffon/db/service";

type MediaItem = {
	id: string;
	type: string;
	url?: string;
	original_url?: string;
	[key: string]: any;
};

async function main() {
	const tweetId = "2061064712393982247";
	const screenName = "Azalee_IE";
	console.log(`=== Manual Sync of Thread ${tweetId} ===`);

	try {
		const session = XSession.loadOrEnv();
		const client = new XClient(session);
		const supabase = createSupabaseServiceClient();

		// 1. Fetch entire thread from Twitter
		console.log("Fetching thread tweets...");
		const threadData = await client.thread(tweetId);
		const threadTweets = threadData.tweets || [];
		console.log(`Fetched ${threadTweets.length} tweets in thread.`);

		if (threadTweets.length === 0) {
			console.error("No tweets found in thread.");
			return;
		}

		// Sort by ID to ensure chronological order
		threadTweets.sort((a, b) => a.id.localeCompare(b.id));

		// Find the head tweet (usually the first one, but let's be sure)
		const headTweet = threadTweets.find((t) => t.id === tweetId) || threadTweets[0];
		console.log(`Head Tweet ID: ${headTweet.id}`);

		// 2. Download and upload all media to Supabase Storage
		const allThreadMedia: MediaItem[] = [];
		const seenMediaUrls = new Set<string>();

		const processedRawTweets = await Promise.all(
			threadTweets.map(async (t, tweetIdx) => {
				const rtMedia = t.media || [];
				const updatedRtMedia: MediaItem[] = [];

				for (let mIdx = 0; mIdx < rtMedia.length; mIdx++) {
					const m = rtMedia[mIdx];
					if (!m || !m.url) continue;

					if (seenMediaUrls.has(m.url)) {
						// Already processed this media
						const existing = allThreadMedia.find((um) => um.original_url === m.url || um.url === m.url);
						if (existing) {
							updatedRtMedia.push(existing);
						}
						continue;
					}

					console.log(`[Media] Downloading media from tweet ${t.id}: ${m.url}`);
					try {
						const res = await fetch(m.url);
						if (!res.ok) {
							console.warn(`[Media] Failed to fetch media from ${m.url}: ${res.status}`);
							const rawMedia = { id: m.id, type: m.type, url: m.url, original_url: m.url };
							updatedRtMedia.push(rawMedia);
							allThreadMedia.push(rawMedia);
							seenMediaUrls.add(m.url);
							continue;
						}

						const buffer = Buffer.from(await res.arrayBuffer());
						const contentType = res.headers.get("content-type") || "image/jpeg";
						let ext = "jpg";
						if (contentType.includes("png")) ext = "png";
						else if (contentType.includes("webp")) ext = "webp";
						else if (contentType.includes("gif")) ext = "gif";
						else if (contentType.includes("avif")) ext = "avif";

						const storagePath = `${tweetId}/${t.id}_${mIdx}.${ext}`;
						console.log(`[Media] Uploading to Storage: tweets/${storagePath}`);

						const { error: uploadErr } = await supabase.storage
							.from("tweets")
							.upload(storagePath, buffer, {
								contentType,
								upsert: true,
							});

						if (uploadErr) {
							console.error(`[Media] Upload failed:`, uploadErr);
							const rawMedia = { id: m.id, type: m.type, url: m.url, original_url: m.url };
							updatedRtMedia.push(rawMedia);
							allThreadMedia.push(rawMedia);
							seenMediaUrls.add(m.url);
						} else {
							const publicUrl = `https://azalee.rosegriffon.fr/storage/v1/object/public/tweets/${storagePath}`;
							const mediaItem = {
								id: m.id,
								type: m.type,
								url: publicUrl,
								previewUrl: publicUrl,
								original_url: m.url,
								original_previewUrl: m.url,
							};
							updatedRtMedia.push(mediaItem);
							allThreadMedia.push(mediaItem);
							seenMediaUrls.add(m.url);
						}
					} catch (err) {
						console.error(`[Media] Error downloading/uploading ${m.url}:`, err);
						const rawMedia = { id: m.id, type: m.type, url: m.url, original_url: m.url };
						updatedRtMedia.push(rawMedia);
						allThreadMedia.push(rawMedia);
						seenMediaUrls.add(m.url);
					}
				}

				return {
					id: t.id,
					text: t.text,
					fullText: t.text,
					translation: t.text, // French author
					created_at: t.created_at,
					in_reply_to_status_id: t.in_reply_to_status_id,
					media: updatedRtMedia,
				};
			})
		);

		// 3. Assemble and save DB Tweet Row
		const isThread = threadTweets.length > 1;
		const createdAtIso = headTweet.created_at
			? new Date(headTweet.created_at).toISOString()
			: new Date().toISOString();

		// Classification
		let category = "news";
		const lowerText = headTweet.text.toLowerCase();
		if (/leak|rumeur|leaké|corocoro/i.test(lowerText)) {
			category = "leak";
		} else if (/patch|version|mise à jour|maj|patch note/i.test(lowerText)) {
			category = "patch-note";
		} else if (/fan|communauté/i.test(lowerText)) {
			category = "fan-content";
		} else if (/trailer|pv|vidéo|scan|illustration/i.test(lowerText)) {
			category = "media";
		}

		const tweetRow = {
			id: headTweet.id,
			author_id: headTweet.author_id || "1391462345197686789",
			author_name: headTweet.author?.name || "Azalée 🌸 | Inazuma Eleven FR",
			author_username: headTweet.author?.username || screenName,
			created_at: createdAtIso,
			text: headTweet.text,
			translation: headTweet.text, // Azalee is French
			is_thread: isThread,
			tweet_count: threadTweets.length,
			metrics: {
				reply_count: headTweet.reply_count,
				retweet_count: headTweet.retweet_count,
				like_count: headTweet.like_count,
				quote_count: headTweet.quote_count,
				view_count: headTweet.view_count,
			},
			media: allThreadMedia,
			quoted_tweets: headTweet.quoted_tweet ? JSON.parse(JSON.stringify(headTweet.quoted_tweet)) : null,
			raw_tweets: processedRawTweets,
			category: category,
			updated_at: new Date().toISOString(),
		};

		console.log("Upserting tweet to Supabase 'tweets' table...");
		const { error: upsertErr } = await supabase
			.from("tweets")
			.upsert(tweetRow);

		if (upsertErr) {
			console.error("Upsert failed:", upsertErr);
		} else {
			console.log(`Successfully sync'ed and imported thread ${tweetId} with ${threadTweets.length} tweets!`);
		}

	} catch (e) {
		console.error("Critical error in sync-specific-thread script:", e);
	}
}

main();
