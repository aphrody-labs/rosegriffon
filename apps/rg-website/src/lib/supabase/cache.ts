import { unstable_cache } from "next/cache";
import { cache } from "react";

/**
 * Wrapper pour mettre en cache les résultats de requêtes Supabase.
 * Utilise unstable_cache de Next.js pour le cache persistant (Data Cache)
 * et React cache pour la déduplication par requête.
 */
export const cachedQuery = <T>(
	queryFn: () => Promise<T>,
	keys: string[],
	tags: string[] = [],
	revalidate: number = 3600 // 1 heure par défaut
) =>
	cache(
		unstable_cache(queryFn, keys, {
			tags,
			revalidate,
		})
	);

/**
 * Exemple d'utilisation :
 *
 * export const getCachedArticles = cachedQuery(
 *   async () => getPublicArticles(),
 *   ['public-articles'],
 *   ['articles'],
 *   60 * 15 // 15 minutes
 * );
 */
