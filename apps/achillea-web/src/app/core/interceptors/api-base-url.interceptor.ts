import { HttpInterceptorFn } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import { joinApiUrl } from "../http/api-url";

const isApiPath = (url: string): boolean => {
	if (/^https?:\/\//i.test(url)) return false;
	return url.startsWith("/api/") || url.startsWith("api/");
};

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
	const base = environment.apiBaseUrl;
	if (!base || !isApiPath(req.url)) {
		return next(req);
	}
	const rewritten = req.clone({ url: joinApiUrl(base, req.url) });
	return next(rewritten);
};
