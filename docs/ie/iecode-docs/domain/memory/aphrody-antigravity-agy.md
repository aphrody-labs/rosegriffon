---
name: aphrody-antigravity-agy
description: "État de la surface Gemini/Antigravity/agy d'aphrody — keyless, identité client, provisioning natif (2026-09-07)."
metadata:
  node_type: memory
  type: project
  originSessionId: 94a28c45-c27f-4447-b0ef-346dad92793f
  modified: 2026-09-07T07:16:02.139Z
---

Surface Google AI (Gemini/Antigravity/agy) réparée et câblée le 2026-09-07 (poussé sur `main`, commits `93677b16` refresh keyless, `1158fb06` identité client, `7b6059d9` provisioning agy, `c7e54229` docs).

Faits non triviaux, découverts en dumpant le token + en capturant la vraie requête d'`agy.exe` 1.1.27 (proxy local via l'override `CLOUD_CODE_URL`) :

- **Auth keyless** : le token OAuth (`gemini:antigravity` dans le Credential Manager Windows, champ `auth_method: consumer`) est maintenu par l'app Antigravity desktop, PAS par aphrody. `aphrody antigravity refresh` re-lit le store ; il ne fait un grant OAuth que si `APHRODY_ANTIGRAVITY_OAUTH_CLIENT_SECRET` est fourni (sinon Google renvoie `400 client_secret is missing`).
- **Identité client** requise pour `models`/`chat` : un compte consumer est refusé (`UNSUPPORTED_CLIENT`/403) sauf si aphrody envoie le `User-Agent` `antigravity/cli/<ver> (aidev_client; …; auth_method=…)` ET le body `loadCodeAssist` `{"metadata":{"ideType":"ANTIGRAVITY"}}`. Implémenté dans `crates/antigravity-sdk/src/endpoints.rs` (`antigravity_user_agent`, `load_code_assist_metadata`). Modèle défaut `chat` = `gemini-3-flash`.
- **`aphrody agy`** provisionne `~/.gemini/config/` avant de forwarder (`crates/cli/src/agy_provision.rs`) : MCP `aphrody-mcp` + skills `packages/yolo/skills` + persona dans un bloc marqué de `~/.gemini/{AGENTS,GEMINI}.md`. Vérif : `agy mcp list` doit montrer `aphrody stdio enabled`. `gemini` est un alias déprécié → forwarde vers `agy`.

Cookie jar Gemini web : `~/.aphrody/google-cookies.json` (hors repo, jamais commité), consommé côté bxc/`apps/web`, pas par le client keyless. Rapport de test : `~/.aphrody/gemini-test-report.md`.

Détails complets dans `CLAUDE.md` §7 (pitfalls antigravity/agy) et `AGENTS.md` §9.5. Voir aussi [[aphrody-no-ai-commit-trailers]].
