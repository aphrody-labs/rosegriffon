/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { XClient, XSession, type Tweet } from "@aphrody-code/x";
import { createSupabaseServiceClient } from "@rose-griffon/db/service";
import type { Json } from "@rose-griffon/db";

type MediaItem = {
	id: string;
	type: string;
	url?: string;
	original_url?: string;
	[key: string]: string | number | boolean | null | undefined;
};

type RawTweetItem = {
	id: string;
	text: string;
	fullText: string;
	created_at?: string;
	in_reply_to_status_id?: string;
	media: { url?: string }[];
	[key: string]: Json | undefined;
};

type DBTweetRow = {
	id: string;
	author_id: string;
	author_name: string;
	author_username: string;
	created_at: string;
	text: string;
	is_thread: boolean;
	tweet_count: number;
	metrics: Json | null;
	media: Json | null;
	quoted_tweets: Json | null;
	raw_tweets: Json | null;
	updated_at: string;
};

export async function crawlTwitter(): Promise<{
	success: boolean;
	count?: number;
	error?: string;
}> {
	const screenNames = ["Azalee_IE", "AkihiroHino", "LEVEL5_times", "inazuma_project"];
	console.log(
		`[Crawl Twitter] Démarrage de la synchronisation des tweets de : ${screenNames.join(", ")}...`
	);

	let totalCount = 0;
	let hasErrors = false;

	try {
		const session = XSession.loadOrEnv();
		const client = new XClient(session);
		const supabase = createSupabaseServiceClient();

		for (const screenName of screenNames) {
			console.log(`[Crawl Twitter] Résolution du profil @${screenName}...`);
			try {
				const user = await client.userByScreenName(screenName);
				if (!user.id) {
					console.warn(`[Crawl Twitter] Impossible de résoudre l'ID de @${screenName}`);
					hasErrors = true;
					continue;
				}
				console.log(`[Crawl Twitter] ID résolu pour @${screenName} : ${user.id} (${user.name})`);

				console.log(`[Crawl Twitter] Récupération des tweets récents de @${screenName}...`);
				const timeline = await client.userTweets(user.id, 40);
				const fetchedTweets = timeline.tweets || [];
				console.log(
					`[Crawl Twitter] ${fetchedTweets.length} tweets récupérés pour @${screenName}.`
				);

				const nonRetweets = fetchedTweets.filter((t) => !t.text.startsWith("RT @"));
				console.log(`[Crawl Twitter] ${nonRetweets.length} tweets après filtrage des RTs.`);

				const conversations = new Map<string, Tweet[]>();
				for (const t of nonRetweets) {
					const convId = t.conversation_id || t.id;
					if (!conversations.has(convId)) {
						conversations.set(convId, []);
					}
					conversations.get(convId)!.push(t);
				}

				const finalTweetsToUpsert: DBTweetRow[] = [];

				for (const [convId, group] of conversations.entries()) {
					group.sort((a, b) => a.id.localeCompare(b.id));

					let isUserThread = group.some((t) => t.id === convId);

					if (!isUserThread && group.length > 0) {
						const { data: dbHead } = await supabase
							.from("tweets")
							.select("author_username")
							.eq("id", convId)
							.maybeSingle();

						if (dbHead) {
							isUserThread = dbHead.author_username?.toLowerCase() === screenName.toLowerCase();
						} else {
							try {
								console.log(
									`[Crawl Twitter] Vérification de l'origine de la conversation ${convId}...`
								);
								const headTweet = await client.getTweet(convId);
								if (headTweet) {
									isUserThread =
										headTweet.author.username.toLowerCase() === screenName.toLowerCase();
								}
							} catch (apiErr) {
								console.warn(
									`[Crawl Twitter] Impossible de récupérer le tweet d'origine ${convId} :`,
									apiErr
								);
							}
						}
					}

					const filteredGroup = group.filter((t) => {
						if (!t.in_reply_to_status_id) {
							return true;
						}
						return isUserThread;
					});

					if (filteredGroup.length === 0) continue;

					const isThread = isUserThread && filteredGroup.length > 1;

					for (const t of filteredGroup) {
						const createdAtIso = t.created_at
							? new Date(t.created_at).toISOString()
							: new Date().toISOString();

						const tMedia = (t.media || []).map((m: { id: string; type: string; url?: string }) => ({
							id: m.id,
							type: m.type,
							url: m.url,
							original_url: m.url,
						}));

						const allThreadMedia: MediaItem[] = [];
						const seenMediaUrls = new Set<string>();

						for (const m of tMedia) {
							if (m.url) {
								allThreadMedia.push(m);
								seenMediaUrls.add(m.url);
							}
						}

						for (const item of filteredGroup) {
							if (item.id === t.id) continue;
							const itemMedia = (item.media || []).map(
								(m: { id: string; type: string; url?: string }) => ({
									id: m.id,
									type: m.type,
									url: m.url,
									original_url: m.url,
								})
							);
							for (const m of itemMedia) {
								if (m.url && !seenMediaUrls.has(m.url)) {
									allThreadMedia.push(m);
									seenMediaUrls.add(m.url);
								}
							}
						}

						const tweetRow: DBTweetRow = {
							id: t.id,
							author_id: t.author_id || user.id,
							author_name: t.author.name || user.name,
							author_username: t.author.username || screenName,
							created_at: createdAtIso,
							text: t.text,
							is_thread: isThread,
							tweet_count: isThread ? filteredGroup.length : 1,
							metrics: {
								reply_count: t.reply_count,
								retweet_count: t.retweet_count,
								like_count: t.like_count,
								quote_count: t.quote_count,
								view_count: t.view_count,
							},
							media: allThreadMedia,
							quoted_tweets: t.quoted_tweet ? JSON.parse(JSON.stringify(t.quoted_tweet)) : null,
							raw_tweets: filteredGroup.map((item) => ({
								id: item.id,
								text: item.text,
								fullText: item.text,
								created_at: item.created_at,
								in_reply_to_status_id: item.in_reply_to_status_id,
								media: (item.media || []).map((m: { url?: string }) => ({
									url: m.url,
								})),
							})),
							updated_at: new Date().toISOString(),
						};

						finalTweetsToUpsert.push(tweetRow);
					}
				}

				if (finalTweetsToUpsert.length > 0) {
					// Deduplicate by ID to prevent ON CONFLICT DO UPDATE constraints error
					const uniqueTweets = Array.from(
						new Map(finalTweetsToUpsert.map((item) => [item.id, item])).values()
					);
					console.log(
						`[Crawl Twitter] Envoi de ${uniqueTweets.length} tweets uniques pour @${screenName} (total brut: ${finalTweetsToUpsert.length})...`
					);
					const { error } = await supabase.from("tweets").upsert(uniqueTweets);
					if (error) {
						console.error(`[Crawl Twitter] Erreur d'upsert pour @${screenName} :`, error);
						hasErrors = true;
					} else {
						totalCount += uniqueTweets.length;
					}
				} else {
					console.log(`[Crawl Twitter] Aucun nouveau tweet à synchroniser pour @${screenName}.`);
				}
			} catch (profileErr) {
				console.error(
					`[Crawl Twitter] Erreur lors de la synchronisation de @${screenName} :`,
					profileErr
				);
				hasErrors = true;
			}
		}

		console.log(
			`[Crawl Twitter] Synchronisation Twitter terminée. ${totalCount} tweets insérés/mis à jour.`
		);
		return { success: !hasErrors, count: totalCount };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[Crawl Twitter] Erreur critique lors de la synchronisation Twitter :", err);
		return { success: false, error: msg };
	}
}
