import { environment } from "../../../environments/environment";

const API_PATH = "/api";

/** Join an API base and path while preserving a single `/api` boundary. */
export function joinApiUrl(baseUrl: string, path: string): string {
	if (/^https?:\/\//i.test(path)) return path;

	const base = baseUrl.replace(/\/$/, "");
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	if (!base) return normalizedPath;

	const basePath = /^https?:\/\//i.test(base) ? new URL(base).pathname.replace(/\/$/, "") : base;
	const alreadyHasApiBoundary =
		(basePath === API_PATH || basePath.endsWith(API_PATH)) &&
		(normalizedPath === API_PATH || normalizedPath.startsWith(`${API_PATH}/`));
	const suffix = alreadyHasApiBoundary ? normalizedPath.slice(API_PATH.length) : normalizedPath;

	return `${base}${suffix}`;
}

export function apiUrl(path: string): string {
	return joinApiUrl(environment.apiBaseUrl ?? "", path);
}
