import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { App } from "./app/app";
import * as fr from "@angular/common/locales/fr";
import { registerLocaleData } from "@angular/common";

registerLocaleData(fr.default);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
