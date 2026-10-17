import { HttpInterceptorFn } from "@angular/common/http";
import { environment } from "../../../environments/environment";

const isApiPath = (url: string): boolean => {
	if (/^https?:\/\//i.test(url)) return false;
	return url.startsWith("/api/") || url.startsWith("api/");
};

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
	const base = environment.apiBaseUrl;
	if (!base || !isApiPath(req.url)) {
		return next(req);
	}
	const path = req.url.startsWith("/") ? req.url : `/${req.url}`;
	const rewritten = req.clone({ url: `${base.replace(/\/$/, "")}${path}` });
	return next(rewritten);
};
