import { joinApiUrl } from "@rosegriffon/achillea-core";
import { achilleaApiUrl } from "./client";

export { joinApiUrl };

/** Joint un chemin API avec l'URL de base Achilléa configurée */
export function apiUrl(path: string): string {
	const base = process.env["NEXT_PUBLIC_ACHILLEA_API_URL"] ?? "";
	return joinApiUrl(base, path);
}
