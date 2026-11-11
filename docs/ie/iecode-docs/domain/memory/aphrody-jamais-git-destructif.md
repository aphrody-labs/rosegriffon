---
name: aphrody-jamais-git-destructif
description: "Jamais de git checkout/restore/stash/reset/clean en masse ni de cargo fmt -p — a détruit une modif non commitée de l'utilisateur."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3b1a06b1-9efd-4a67-9b9a-f6eddcbf499e
  modified: 2026-09-07T10:55:07.146Z
---

Sur ce dépôt, ne jamais lancer `git checkout --`, `git restore`, `git stash`, `git reset` ou `git clean` sur un ensemble de fichiers, et ne jamais utiliser `cargo fmt -p <crate>`.

**Why :** le 2026-09-07, un `cargo fmt -p` a reformaté des dizaines de fichiers non touchés par le travail ; la boucle de nettoyage qui a suivi a appliqué `git checkout --` sur tout fichier de `git diff HEAD --name-only` absent d'une liste blanche, et a **détruit une modification non commitée de `docs/INDEX.md`** antérieure à la session — irrécupérable (ni stash, ni ORIG_HEAD y menant). L'arbre de travail contient couramment du travail de l'utilisateur et du peer que rien ne sauvegarde.

**How to apply :** formater avec `rustfmt --edition 2024 <fichier>` sur les seuls fichiers édités. Pour annuler une modification qu'on a soi-même faite, restaurer depuis une copie prise avant l'édition (`cp fichier /tmp/x.bak`), jamais via git. Vérifier `git status --short` avant et après. Écrire cette interdiction dans chaque brief de sous-agent. Voir aussi [[aphrody-trancher-seul]] : décider seul reste la règle, mais pas sur du destructif.
