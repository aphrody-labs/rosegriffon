/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { XClient, XSession, type Tweet } from "@aphrody-code/x";
import { createSupabaseServiceClient } from "@rose-griffon/db/service";

export async function crawlTwitter(): Promise<{
	success: boolean;
	count?: number;
	error?: string;
}> {
	console.log("[Crawl Twitter] Démarrage de la synchronisation des tweets de @Azalee_IE...");

	try {
		// 1. Initialiser le client X
		const session = XSession.loadOrEnv();
		const client = new XClient(session);

		// 2. Résoudre l'utilisateur Azalee_IE
		console.log("[Crawl Twitter] Résolution du profil @Azalee_IE...");
		const user = await client.userByScreenName("Azalee_IE");
		if (!user.id) {
			throw new Error("Impossible de résoudre l'ID de @Azalee_IE");
		}
		console.log(`[Crawl Twitter] ID résolu : ${user.id} (${user.name})`);

		// 3. Récupérer les tweets récents (40 tweets)
		console.log("[Crawl Twitter] Récupération des tweets récents...");
		const timeline = await client.userTweets(user.id, 40);
		const fetchedTweets = timeline.tweets || [];
		console.log(`[Crawl Twitter] ${fetchedTweets.length} tweets récupérés depuis l'API.`);

		// 4. Filtrer les Retweets (RTs)
		const nonRetweets = fetchedTweets.filter((t) => {
			// Un retweet commence souvent par "RT @" dans legacy.full_text
			return !t.text.startsWith("RT @");
		});
		console.log(`[Crawl Twitter] ${nonRetweets.length} tweets restants après filtrage des RTs.`);

		// 5. Initialiser Supabase
		const supabase = createSupabaseServiceClient();

		// 6. Identifier les conversations et reconstruire les threads
		// Regrouper les tweets récupérés par conversation_id
		const conversations = new Map<string, Tweet[]>();
		for (const t of nonRetweets) {
			const convId = t.conversation_id || t.id;
			if (!conversations.has(convId)) {
				conversations.set(convId, []);
			}
			conversations.get(convId)!.push(t);
		}

		const finalTweetsToUpsert: any[] = [];

		for (const [convId, group] of conversations.entries()) {
			// Trier le groupe par ID croissant (ordre chronologique du thread)
			group.sort((a, b) => a.id.localeCompare(b.id));

			// Vérifier si c'est un thread de l'utilisateur ou une réponse à un tiers.
			// Si le head de la conversation (id === convId) est dans notre groupe, c'est forcément un thread d'Azalee_IE.
			let isUserThread = group.some((t) => t.id === convId);

			// Si le head n'est pas dans le groupe (tweet posté plus tôt ou non présent dans les 40 derniers),
			// on vérifie en base de données ou via l'API.
			if (!isUserThread && group.length > 0) {
				// A. Vérification en base de données
				const { data: dbHead } = await supabase
					.from("tweets")
					.select("author_username")
					.eq("id", convId)
					.maybeSingle();

				if (dbHead) {
					isUserThread = dbHead.author_username?.toLowerCase() === "azalee_ie";
				} else {
					// B. Vérification via l'API X
					try {
						console.log(
							`[Crawl Twitter] Vérification de l'origine de la conversation ${convId}...`
						);
						const headTweet = await client.getTweet(convId);
						if (headTweet) {
							isUserThread = headTweet.author.username.toLowerCase() === "azalee_ie";
						}
					} catch (apiErr) {
						console.warn(
							`[Crawl Twitter] Impossible de récupérer le tweet d'origine ${convId} :`,
							apiErr
						);
					}
				}
			}

			// Si ce n'est pas un thread d'Azalee_IE, alors les tweets avec in_reply_to_status_id sont des réponses/commentaires
			// à des tiers. On filtre ces derniers.
			const filteredGroup = group.filter((t) => {
				if (!t.in_reply_to_status_id) {
					return true; // Tweet d'origine, on garde
				}
				return isUserThread; // Si c'est le thread de l'utilisateur, on garde. Sinon (réponse à autrui), on filtre.
			});

			if (filteredGroup.length === 0) continue;

			// Déterminer les infos de thread
			const isThread = isUserThread && filteredGroup.length > 1;

			for (const t of filteredGroup) {
				const createdAtIso = t.created_at
					? new Date(t.created_at).toISOString()
					: new Date().toISOString();

				// Extraire les médias de t
				const tMedia = (t.media || []).map((m: any) => ({
					id: m.id,
					type: m.type,
					url: m.url,
					original_url: m.url,
				}));

				// Collecter l'union de tous les médias du thread (en mettant ceux de t en premier)
				const allThreadMedia: any[] = [];
				const seenMediaUrls = new Set<string>();

				for (const m of tMedia) {
					if (m.url) {
						allThreadMedia.push(m);
						seenMediaUrls.add(m.url);
					}
				}

				for (const item of filteredGroup) {
					if (item.id === t.id) continue;
					const itemMedia = (item.media || []).map((m: any) => ({
						id: m.id,
						type: m.type,
						url: m.url,
						original_url: m.url,
					}));
					for (const m of itemMedia) {
						if (m.url && !seenMediaUrls.has(m.url)) {
							allThreadMedia.push(m);
							seenMediaUrls.add(m.url);
						}
					}
				}

				// Préparer l'objet pour la base de données
				const tweetRow = {
					id: t.id,
					author_id: t.author_id || user.id,
					author_name: t.author.name || user.name,
					author_username: t.author.username || "Azalee_IE",
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
						media: (item.media || []).map((m: any) => ({
							url: m.url,
						})),
					})),
					updated_at: new Date().toISOString(),
				};

				finalTweetsToUpsert.push(tweetRow);
			}
		}

		if (finalTweetsToUpsert.length === 0) {
			console.log("[Crawl Twitter] Aucun nouveau tweet à synchroniser.");
			return { success: true, count: 0 };
		}

		console.log(`[Crawl Twitter] Envoi de ${finalTweetsToUpsert.length} tweets vers Supabase...`);
		const { error } = await supabase.from("tweets").upsert(finalTweetsToUpsert);

		if (error) {
			throw error;
		}

		console.log(
			`[Crawl Twitter] Synchronisation complétée avec succès (${finalTweetsToUpsert.length} tweets insérés/mis à jour).`
		);
		return { success: true, count: finalTweetsToUpsert.length };
	} catch (err: any) {
		console.error("[Crawl Twitter] Erreur critique lors de la synchronisation Twitter :", err);
		return { success: false, error: err.message || String(err) };
	}
}
