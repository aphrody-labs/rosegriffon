# achillea-web

Front **Angular 21** (SPA statique, nginx VPS) du monorepo Achillea — UI du tableau de bord
(clans, tournois, ranked, casts…). Consomme l'API du bot via le proxy nginx (`/api/*`).

Ce workspace fait partie du monorepo : voir le **[README racine](../../README.md)** pour le
démarrage, les scripts, la configuration et le déploiement.

```bash
bun run --filter achillea-web dev     # serveur de dev (ng serve)
bun run --filter achillea-web build   # build prod (dist/achillea-web/browser)
```

- Déploiement (nginx VPS) : [README racine](../../README.md#déploiement).
- Détail ranked/canvas : [docs/ranking.md](docs/ranking.md).
