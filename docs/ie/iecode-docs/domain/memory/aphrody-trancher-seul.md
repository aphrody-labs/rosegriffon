---
name: aphrody-trancher-seul
description: "Sur aphrody, toujours tout trancher seul — ne jamais finir par une question de confirmation."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 94a28c45-c27f-4447-b0ef-346dad92793f
  modified: 2026-09-07T07:19:34.508Z
---

L'utilisateur veut que je **tranche seul, tout le temps** : ne jamais clore une réponse par « Veux-tu que je … ? » ou une demande de validation pour un travail réversible. Décider, agir, livrer, puis rapporter.

**Pourquoi** : autonomie totale A→Z, aucun humain dans la boucle (CLAUDE.md §0.1, AGENTS.md §2/§10). Une question de confirmation sur une action réversible est un ralentissement non voulu. L'utilisateur me l'a redit explicitement après que j'aie terminé par « Veux-tu que je l'aligne … ? ».

**Comment l'appliquer** : poser des hypothèses raisonnables et les énoncer ; enchaîner directement les suites évidentes (ex. aligner un modèle périmé, corriger un lint, committer+push) sans redemander. Ne s'arrêter pour demander QUE pour l'irréversible destructif (force-push main, drop DB, deploy prod, suppression de secrets partagés). Le style de sortie est proactif : action > planification.

Voir [[aphrody-no-ai-commit-trailers]] et [[aphrody-antigravity-agy]].
