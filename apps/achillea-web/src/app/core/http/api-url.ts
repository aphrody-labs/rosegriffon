import { joinApiUrl } from "@rosegriffon/achillea-core";

import { environment } from "../../../environments/environment";

/** Jointure base + chemin — règle partagée, définie dans `@core/http`. */
export { joinApiUrl };

export function apiUrl(path: string): string {
	return joinApiUrl(environment.apiBaseUrl ?? "", path);
}
