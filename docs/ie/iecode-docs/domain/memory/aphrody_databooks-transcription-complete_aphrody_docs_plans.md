---
source_file: C:\Users\aphro\aphrody\docs\plans\databooks-transcription-complete.md
imported_at: 2026-09-09T02:59:12.195Z
---

<!-- SPDX-License-Identifier: Apache-2.0 -->

# Plan — transcription complète du fonds databooks et dépôt intégral

> État mesuré le 2026-09-08 par `aphrody ocr dbfr survey --include-hidden`,
> après le dépôt du lot 22 : **370 fiches, 14 233 planches, 13 720 avec une
> image, 13 336 transcrites, 384 restantes**. Le chiffre de 147 obtenu plus tôt
> était faux : `dbfr list` ne voyait que les 200 premières fiches sur 370, la
> pagination manquait. Toute valeur de ce document vient d'une commande, jamais
> d'une estimation.

## 1. Résultat visé

Zéro planche portant une image sans transcription, et chaque transcription
présente à la fois dans le corpus local (`~/.aphrody/ocr/results.db`) et dans la
base du site via `POST /api/databooks/:id/transcription`.

Une planche **sans image** n'est pas dans le périmètre : l'OCR ne peut rien en
faire. Elles sont comptées à part (`plates` moins `withImage`) et ne doivent
jamais gonfler un pourcentage d'avancement.

## 2. La boucle, en quatre commandes

```text
dbfr fetch-all   API  -> var/ocr-lots/<id>/NNNN.jpg   (planches manquantes)
ocr batch        images -> JSONL + dépôt SQLite au fil de l'eau
ocr audit        refuse un lot porteur d'un défaut bloquant
dbfr push --apply  corpus SQLite -> API, mode merge
```

Le nom de fichier `NNNN.ext` est le seul lien entre une image et sa planche :
`fetch` l'écrit, `push` le relit. Pas de table de correspondance à côté, donc
rien qui puisse diverger.

## 3. Étapes

| #   | Étape            | Commande                                                                                                                 | Preuve attendue                                            |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 1   | Mesurer          | `aphrody ocr dbfr survey --include-hidden --top 40`                                                                      | fiches à trou, nombre exact de planches restantes          |
| 2   | Rapatrier        | `aphrody ocr dbfr fetch-all --dir var/ocr-lots --include-hidden`                                                         | un dossier par fiche, `failed: []`                         |
| 3   | Lire             | `aphrody ocr batch var/ocr-lots/<id> --out var/ocr-lots/<id>.jsonl --model dots-ocr --max-tokens 2048 --raw --skip-done` | `N/N page(s) read`, 0 failed                               |
| 4   | Auditer          | `aphrody ocr audit var/ocr-lots/<id>.jsonl`                                                                              | sortie « no blocking defect », code 0                      |
| 5   | Vérifier à blanc | `aphrody ocr dbfr push <id> --lot var/ocr-lots/<id>`                                                                     | nombre de planches prêtes, refus détaillés                 |
| 6   | Déposer          | `… --apply`                                                                                                              | réponse API `deposees`, `ignorees: 0`, `pagesInconnues: 0` |
| 7   | Re-mesurer       | `aphrody ocr dbfr pages <id>`                                                                                            | `missing` en baisse du nombre déposé                       |

L'étape 4 n'est pas facultative. Un modèle de vision peut boucler sur une
phrase jusqu'à épuiser son budget de tokens : c'est du texte, donc rien dans le
résultat ne paraît anormal. L'audit est ce qui le voit.

## 4. Coût mesuré, pas supposé

Sur cette machine (RTX 4070, dots.ocr Q8_0, un processus par page) :

- **10,0 s/planche** en moyenne sur le lot 22 (75 planches en 785 s).
- **1,6 Mo/planche** de scan (123 Mo pour 75 planches).

D'où, pour les 384 planches restantes : **environ 1 h 4 min de GPU** et
**~630 Mo** sur disque. Le mode `--server` (llama-server résident) ne compte pas
comme accélération tant que le blocage documenté dans `ocr_cmd.rs` n'est pas
compris : mesuré, aucune page ne se termine.

## 5. Ordre de traitement

Les fiches par nombre de planches manquantes décroissant, telles que `survey`
les classe. Au 2026-09-08, après le lot 22 :

| Fiche | Manquantes  | Titre                                          |
| ----- | ----------- | ---------------------------------------------- |
| 5     | 68          | Dragon Ball Landmark                           |
| 28    | 67          | Dragon Ball Illustration Book - Akira Toriyama |
| 36    | 59          | Dragon Ball: Adventure Special                 |
| 29    | 54          | Dragon Ball Anime Illustration Collection      |
| 312   | 42          | DBZ TV Special 1 : Bardock                     |
| 362   | 29          | Saikyō Jump Septembre 2023                     |
| 126   | 13          | V Jump Décembre 1995                           |
| …     | 1-5 chacune | une cinquantaine de Saikyō Jump                |

La longue traîne (fiches à une ou deux planches) se traite en un seul passage :
`fetch-all` puis une boucle `batch`/`push` par dossier.

## 6. Règles que le dépôt ne doit pas casser

- **Seules les pages de statut `text` partent.** `no-text`, `unreadable`,
  `needs-review`, `processing-error` sont comptées et rapportées, jamais
  envoyées : l'API lit une chaîne vide comme « rien à dire », donc une lecture
  ratée y deviendrait une transcription achevée.
- **`merge` par défaut.** Il ne touche que les planches citées ; `--replace`
  supprime les absentes et reste réservé à une reprise intégrale.
- **Un dépôt est idempotent.** Relancer une étape ne duplique rien : la clé du
  corpus local est `(page_id, empreinte de l'image)` et l'API remplace le texte
  de la planche citée.
- **Chaque dépôt écrit une révision** côté site (`wiki_revisions`), donc reste
  consultable et réversible.
- **Rien ne se télécharge implicitement pendant l'OCR** : les poids passent par
  `aphrody model pull` et leurs empreintes épinglées.

## 7. Ce qui reste ouvert

- **Le taux de planches sans texte est une donnée, pas un défaut.** Le lot 22 a
  rendu 5 planches muettes sur 75 : ce sont des pages d'illustration. Une fiche
  qui rendrait une majorité de muettes doit être regardée à l'œil avant dépôt,
  pas re-passée à l'aveugle avec un autre modèle.
- **Langue.** Le lot 22 est l'édition chinoise de Hong Kong ; dots.ocr l'a lue.
  Aucun contrôle de langue n'est fait à l'entrée : si une fiche doit être
  française, c'est une règle de relecture, pas d'OCR.
- **Le mode `--server`** reste inutilisable (voir §4) ; le résoudre diviserait
  le temps de chargement du modèle par le nombre de pages.
- **PP-OCRv5** (`aphrody ocr ppocr`) donne géométrie et scores mais pas de
  structure ; il n'est pas encore branché sur le chemin de dépôt databooks.
