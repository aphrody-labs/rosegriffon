---
name: bxc-contract-mesure
description: "Contrat réel de bxc (binaire + cdylib) mesuré le 2026-09-07 — crt-static, spawn_blocking, scrape qui ne termine pas."
metadata:
  node_type: memory
  type: project
  originSessionId: 3b1a06b1-9efd-4a67-9b9a-f6eddcbf499e
  modified: 2026-09-07T10:54:57.444Z
---

Contrat bxc mesuré par exécution le 2026-09-07, pas lu dans une doc. Détail complet : `docs/research/bxc-contract-2026-09-07.md`.

- `bxc_rust_bridge.dll` exporte **17** symboles `bxc_*` (pas 10) et est **/MD** alors qu'aphrody force `+crt-static` ⇒ chargement `libloading` au runtime obligatoire, jamais de link statique ; libérer uniquement via `bxc_free_string` (jamais mimalloc), et `bxc_tree_destroy` pour un `*mut DomTree` (les deux ne sont pas interchangeables).
- Chaque symbole réseau du cdylib construit son propre runtime tokio puis `block_on` ⇒ appel depuis un thread tokio = panic ⇒ **`spawn_blocking` obligatoire**. Aucun `catch_unwind` côté bxc : un panic traversant `extern "C"` est UB.
- `bxc recon` est la **seule** sous-commande à contrat d'exit fiable (EXIT=0). Sur échec elle sort **65** et ignore le profil demandé (escalade static→max, coût maximal). `--help` sort **1** : ne pas lire un exit non nul comme « binaire absent ».
- **`bxc scrape` ne termine jamais** (EXIT=124 mesuré à 300 s) alors qu'il a déjà écrit son Markdown. Cause racine **non établie** — pistes éliminées : client Redis global de Bun, `Browser.close()`, `Target.closeTarget`. Le hang n'apparaît que via `src/cli/index.ts`, pas en appelant `scrape.ts::main()` directement. Tout appelant doit streamer stdout et tuer le process, ou préférer `recon`.

Voir [[aphrody-jamais-git-destructif]].
