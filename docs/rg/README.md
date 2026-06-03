# Documentation — monorepo Rose Griffon

Index unifié de la documentation du dépôt. Les docs sont regroupées par domaine.
Convention : `*.md` est gitignoré sauf `docs/**` — c'est ici que vit toute la doc partagée.

> Le `CLAUDE.md` racine reste la source de vérité pour les **conventions** (commits FR,
> Bun obligatoire, pièges critiques). Cet index ne le duplique pas — il l'aiguille.

## Feuilles de route & plans

| Doc | Portée |
|-----|--------|
| [PLAN.md](PLAN.md) | Roadmap maître : état (✅/⏳) par application et package, prochaines étapes. |
| [IECODE-INAGLE-PLAN.md](IECODE-INAGLE-PLAN.md) | Plan assets & données iecode + inagle (CDN, trous de données, roadmap priorisée). |
| [SEO-PLAN.md](SEO-PLAN.md) | Plan SEO website + azalee + marque personnelle « yoyo ». |

## Architecture & cartographie

| Doc | Portée |
|-----|--------|
| [REPO_MAP.md](REPO_MAP.md) | Cartographie du monorepo : applications, packages, dépendances croisées. **Référence structurelle.** |
| [database.md](database.md) | Architecture base de données & cache hybride (Supabase Cloud ↔ miroir SQLite embarqué). |

## Données & wiki (Azalée)

| Doc | Portée |
|-----|--------|
| [inagle.md](inagle.md) | Package `@rose-griffon/inagle` : parser binaire CPK/G4TX, API, pipeline de données. |
| [wiki-filters.md](wiki-filters.md) | Filtres & détails du wiki ; contournement des colonnes NULL `inagle_skills` (category/element FR). |

## Déploiement & opérations

| Doc | Portée |
|-----|--------|
| [deploy.md](deploy.md) | Guide de déploiement (website → Vercel manuel, azalee → VPS self-host, cron systemd). |

## Audits

| Doc | Portée |
|-----|--------|
| [UI-UX-AUDIT.md](UI-UX-AUDIT.md) | Audit UI/UX & responsive (website + azalee + package UI). |
| [asset-audit/](asset-audit/) | Snapshots d'audit assets 2026-06-03 (tables `inagle_*`, CDN, références UI) — détail de [IECODE-INAGLE-PLAN.md](IECODE-INAGLE-PLAN.md). |

## Intégration écosystème

| Doc | Portée |
|-----|--------|
| [achillea.md](achillea.md) | Intégration d'Achillea (3e site) dans l'écosystème RG (API/CDN/SEO/cross-site). |

## Outils

| Doc | Portée |
|-----|--------|
| [tools/README.md](tools/README.md) | Outils communautaires Azalée (comparateur, équipe aléatoire, traducteur) + captures. |

## Référence externe (auto-générée — ne pas éditer à la main)

Le cron `external-docs` (`packages/cron/src/tasks/ie-crawl/external-docs.ts`) crawle ces
documentations externes pour le RAG/LLM et les régénère dans `docs/reference/`. Toute édition
manuelle y sera écrasée.

| Doc | Source |
|-----|--------|
| [reference/awesome-markdown.md](reference/awesome-markdown.md) | `github.com/mundimark/awesome-markdown`. |
| [reference/bun-markdown.md](reference/bun-markdown.md) | `github.com/oven-sh/bun` (`docs/runtime/markdown.mdx`). |
