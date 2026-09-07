import {
	ApplicationConfig,
	importProvidersFrom,
	LOCALE_ID,
	provideBrowserGlobalErrorListeners,
	provideZoneChangeDetection,
} from "@angular/core";
import {
	provideRouter,
	withComponentInputBinding,
	withInMemoryScrolling,
	withPreloading,
	PreloadAllModules,
} from "@angular/router";

import { routes } from "./app.routes";
import { providePrimeNG } from "primeng/config";
import Aura from "@primeuix/themes/aura";
import { definePreset } from "@primeuix/themes";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { apiBaseUrlInterceptor } from "./core/interceptors/api-base-url.interceptor";
import { MessageService } from "primeng/api";
import { provideLottieOptions } from "ngx-lottie";
import player from "lottie-web";
import { provideTranslateService } from "@ngx-translate/core";
import { provideTranslateHttpLoader } from "@ngx-translate/http-loader";

const myPreset = definePreset(Aura, {
	semantic: {
		colorScheme: {
			light: {
				primary: {
					50: "#eee8ff",
					100: "#e0d4ff",
					200: "#c0a4ff",
					300: "#a675ff",
					400: "#9039ff",
					500: "#6d00ce",
					600: "#5900ab",
					700: "#450086",
					800: "#310063",
					900: "#210046",
					950: "#13002d",
				},
				surface: {
					0: "#d3d3d3",
					50: "#d3d3d3",
					100: "#c6c6c6",
					200: "#aeaeae",
					300: "#969696",
					400: "#7f7f7f",
					500: "#6a6a6a",
					600: "#555555",
					700: "#404040",
					800: "#2c2c2c",
					900: "#191919",
					950: "#0e0e0e",
				},
			},
			dark: {
				primary: {
					50: "#eee8ff",
					100: "#e0d4ff",
					200: "#c0a4ff",
					300: "#a675ff",
					400: "#9039ff",
					500: "#6d00ce",
					600: "#5900ab",
					700: "#450086",
					800: "#310063",
					900: "#210046",
					950: "#13002d",
				},
				surface: {
					50: "#f1f1f1",
					100: "#e2e2e2",
					200: "#c6c6c6",
					300: "#ababab",
					400: "#939393",
					500: "#797979",
					600: "#616161",
					700: "#494949",
					800: "#323232",
					900: "#1e1e1e",
					950: "#131313",
				},
			},
		},
	},
});

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(
			routes,
			withComponentInputBinding(),
			withPreloading(PreloadAllModules),
			withInMemoryScrolling({
				scrollPositionRestoration: "top",
				anchorScrolling: "enabled",
			})
		),
		providePrimeNG({
			theme: {
				preset: myPreset,
				options: {
					darkModeSelector: ".p-dark",
				},
			},
		}),
		provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
		MessageService,
		provideLottieOptions({
			player: () => player,
		}),
		{ provide: LOCALE_ID, useValue: "fr-FR" },
		provideTranslateService({
			fallbackLang: "fr",
			loader: provideTranslateHttpLoader({
				prefix: "/assets/i18n/",
				suffix: ".json",
			}),
		}),
	],
};
