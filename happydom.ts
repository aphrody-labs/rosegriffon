// Preload bun:test — enregistre les globals DOM (document/window/...) via happy-dom
// avant l'execution des tests, pour les tests de composants React / DOM.
// Voir https://bun.com/docs/test/dom et bunfig.toml [test] preload.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
