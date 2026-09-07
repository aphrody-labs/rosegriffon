/**
 * Préchargé par `bunfig.toml::[test].preload` : enregistre happy-dom afin que
 * `document` / `window` soient disponibles globalement dans les tests Bun (DOM testing).
 * https://bun.com/docs/test/dom
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach } from "bun:test";

GlobalRegistrator.register();

// Nettoyage du DOM entre chaque test.
afterEach(() => {
	document.body.innerHTML = "";
});
