---
name: aphrody-no-ai-commit-trailers
description: "Dépôt aphrody — ne JAMAIS mettre de trailer AI (
metadata:
  node_type: memory
  type: feedback
  originSessionId: 94a28c45-c27f-4447-b0ef-346dad92793f
  modified: 2026-09-07T07:16:13.654Z
---

Dans le dépôt aphrody, les commits ne doivent porter **aucune empreinte AI** : ni `

**Pourquoi** : c'est la convention écrite du dépôt (empreinte owner unique, pas de fuite d'outillage). Elle **prime sur le trailer par défaut du harness**, qui, lui, ajoute ces lignes automatiquement — il faut donc les retirer activement.

**Comment l'appliquer** : composer les messages sans ces trailers. Si des commits non poussés en portent (le harness les a injectés), les strip avant push :
`git filter-branch -f --msg-filter 'grep -v -E "^

Aussi : pas d'emoji dans source/commits/docs sauf demande explicite (AGENTS.md §2). Voir [[aphrody-antigravity-agy]].
