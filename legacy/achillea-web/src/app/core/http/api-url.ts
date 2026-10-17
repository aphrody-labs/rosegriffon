import { environment } from "../../../environments/environment";

export function apiUrl(path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	const normalized = path.startsWith("/") ? path : `/${path}`;
	const base = environment.apiBaseUrl?.replace(/\/$/, "") ?? "";
	return `${base}${normalized}`;
}
