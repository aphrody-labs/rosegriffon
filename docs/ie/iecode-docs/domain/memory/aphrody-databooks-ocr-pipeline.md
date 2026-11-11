---
name: aphrody-databooks-ocr-pipeline
description: "État du pipeline OCR databooks (dragonballfr.com) — pont natif aphrody↔shenron, autopilot, point fixe du corpus"
metadata:
  node_type: memory
  type: project
  originSessionId: a399bf75-2c50-49a4-8fa4-fb9bb8d600a4
  modified: 2026-09-08T19:59:45.375Z
---

Pipeline OCR natif pour transcrire le corpus databooks de dragonballfr.com et
le pousser en DB de production, sans humain dans la boucle (conforme
CLAUDE.md §0.1).

**Deux ponts** (voir `plugins/aphrody/skills/dbfr-databooks/SKILL.md` et
`plugins/aphrody/skills/shenron-databooks-bridge/SKILL.md`) :

- `aphrody ocr dbfr` — HTTP direct vers `dragonballfr.com/api/databooks/*`
  (token `$DBFR_TOKEN`/`$SHENRON_ADMIN_TOKEN`, dans `.env` local).
- `aphrody ocr shenron` — bridge natif vers le checkout `shenron` frère
  (`$SHENRON_ROOT` ou auto-découverte), réutilise le juge `classerDefaut` de
  shenron en plus du contrat aphrody (`content_score`, `is_page_furniture`,
  `drop_noise_blocks`).

**Orchestrateur** : `scripts/databooks-autopilot.sh [lot-root] [max-iter]` —
fetch-all → VLM (dots.ocr) → PP-OCR (fallback) → audit → ingest local → push
prod, boucle jusqu'à point fixe (missing stable). **Toujours lancer avec le
binaire `debug` ou un binaire release rebuild avec `--features ocr`** — un
release build sans la feature ne fait _pas_ échouer proprement, la
sous-commande `ocr` disparaît et clap route vers le repli A2A (piège CLAUDE.md
§7 vérifié à nouveau le 2026-09-08).

**Bug corrigé (commit `fc07d85b`, 2026-09-08)** : l'audit aphrody
(`crates/aphrody-ocr-core/src/audit.rs`) était aveugle aux boucles de
génération bloquée en CJK (`split_whitespace()` ne voit rien en japonais sans
espaces) et n'avait aucune détection de contamination par alphabet étranger
(cyrillique/arabe/thaï/hangul). Corrigé par un scan caractère-par-caractère
(seuil shenron : 4-40 caractères, sinon faux positifs sur l'emphase chinoise
légitime type 非常非常非常). 23 planches fautives déjà déposées ont été
annulées (`text: null`, réversible) sur 6 databooks (5, 22, 36, 126, 354, 362).

**État du corpus au 2026-09-08, 21h19** : point fixe confirmé après
`autopilot` (2 itérations, ~3,5 min, 0 nouvelle planche à chaque fetch-all) —
370 records, 14233 planches, 13720 avec image, **13592 transcrites**, **128
manquantes**, stables. Concentrées sur 4 lots (114/128) :

- **Lot 29** (43 manquantes) — scans 17 Mo/planche, hors de portée du VLM
  (272s/planche mesuré) ; le size-gate (`OVERSIZED_KIB=4096` dans
  `databooks-transcribe-all.sh`) les évite délibérément. Nécessiterait un
  redimensionnement d'image avant nouvel essai — **non fait, optionnel**.
  Voir [[aphrody-no-ai-commit-trailers]].
- **Lot 312** (40), **36** (19), **362** (7) — reste dispersé sur d'anciens
  Saikyō/V Jump (1-5 chacun).
- Aucun des deux moteurs (VLM, PP-OCR) n'en tire de texte exploitable — probable
  illustration pure ou dégradation trop forte. Considérer comme vrai point
  fixe, pas un blocage à débloquer sans intervention (ex. resize lot 29).

Les deux VPS (`vps`=aphrody, `dbfr`=shenron) sont synchronisés sur ce commit.
