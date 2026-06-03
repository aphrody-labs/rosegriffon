# Audit CDN — `cdn.rosegriffon.fr` (2026-06-03)

Méthode : `curl -sI` sur un échantillon représentatif des URLs **réellement résolues** par
`apps/azalee/src/lib/images/utils.ts` (le résolveur central) + les assets `public/` du website.
Distinction stricte **vérifié 404** vs **supposé**.

## Constat majeur (VÉRIFIÉ) — le CDN ne sert RIEN

L'hôte répond (DNS `cdn.rosegriffon.fr` → `51.77.147.152`, `server: nginx`, HTTP/2, en-têtes
`cache-control: immutable`), mais **toutes** les URLs testées renvoient **404**, y compris la racine.

| URL testée | Code |
|---|---|
| `https://cdn.rosegriffon.fr/` | 404 |
| `https://cdn.rosegriffon.fr/favicon.ico` | 404 |
| `https://cdn.rosegriffon.fr/robots.txt` | 404 |
| `https://cdn.rosegriffon.fr/_next/static/` | 404 |
| `https://cdn.rosegriffon.fr/public/RG_Logo_V2.5.webp` | 404 |
| `https://cdn.rosegriffon.fr/dx11/` | 404 |
| `https://cdn.rosegriffon.fr/dx11/menu/icon_chr/face/c06038020_l_c06038020_1_l00.png` | 404 |
| `https://cdn.rosegriffon.fr/dx11/menu/220_img/telop_waza/fr/rhd10010_rhd10010.png` | 404 |
| `https://cdn.rosegriffon.fr/dx11/menu/200_icon/02_icon_item/btl_re000001.png` | 404 |
| `https://cdn.rosegriffon.fr/dx11/menu/icon_chr/aura_fs/k000290_l_k000290_l00.png` | 404 |
| `https://cdn.rosegriffon.fr/static/azalee/menu/` | 404 |
| `https://cdn.rosegriffon.fr/menu/200_icon/01_icon_emblem/em0001_em0001.png` | 404 |

→ **nginx tourne mais l'alias `/dx11/` pointait vers le mauvais chemin.**

**Cause racine réelle (VÉRIFIÉE 2026-06-03, corrigé)** : la conf nginx du vhost existait bien
ET contenait un bloc `location ^~ /dx11/`, mais son `alias` pointait vers un chemin
`…/steamcmd/…` **inexistant** au lieu du dump réel
`/home/ubuntu/.local/share/Steam/iecode/inazuma/data/dx11/`. Ce n'était donc **ni** une conf
perdue, **ni** des fichiers jamais synchronisés (les 40 471 PNG / 3.7 Go étaient déjà sur
l'hôte) : juste un mauvais chemin d'alias. Le correctif est un **one-liner** (re-pointer
l'`alias` + `nginx -t` + `systemctl reload nginx`), **pas** un rsync de 3.7 Go.
Conf corrigée versionnée dans `infra/nginx/cdn.rosegriffon.conf` (anti-dérive).
Vérif live : `curl -sI .../dx11/menu/icon_chr/face/c01000010_l_c01000010_1_l00.png` → **200**
(`image/png`, 26 848 o).

## Source des assets EXISTE bien (VÉRIFIÉ) — dump local non publié

Le dump iecode est présent **sur le VPS de build** :
`/home/ubuntu/.local/share/Steam/iecode/inazuma/data/dx11/` — **40 471 fichiers**, **3.7 Go**
(symlinké depuis `packages/inagle/data/dx11`). Échantillons confirmés sur disque :

- `icon_chr/face/c01000010_l_c01000010_1_l00.png` ✅ (le pattern visage du résolveur matche)
- `icon_chr/aura_fs/k000290_l_k000290_l00.png` ✅ (pattern aura matche)
- `220_img/telop_waza/fr/a000010_a000010.png` … (310 fichiers ; codes `a*`/`k*`, **pas** `rhd*`)
- `200_icon/02_icon_item/icon_item02_btl_re000001.png` (préfixe `icon_itemNN_` requis)

→ Le contenu existe ET était déjà sur l'hôte CDN ; il n'était **pas servi** à cause d'un
**alias nginx mal pointé** (`…/steamcmd/…` au lieu de `…/iecode/inazuma/data/dx11/`). Ce
n'est donc pas un problème de synchro de fichiers ni d'extraction, mais une simple correction
de chemin d'alias (corrigée 2026-06-03).

## Légacy mort (VÉRIFIÉ)

L'ancien stockage Supabase Storage référencé par 1002 lignes `inagle_skills.image_url`
(`/storage/v1/object/public/menu/…`) renvoie **400** (bucket désactivé/supprimé) :

- `https://isbkaeltubqittywibeh.supabase.co/storage/v1/object/public/menu/220_img/telop_waza/fr/rhd10010_0.webp` → 400

## Ce qui MARCHE (VÉRIFIÉ) — assets servis depuis l'origine

- `azalee.rosegriffon.fr/rarity/normal.webp`, `/spirit_type/fire.webp`, `/ievr.webp` → **200**
  (les `public/` propres d'azalee sont servis par l'origine Vercel, pas par le CDN).
- `rosegriffon.fr/azale.webp`, `www.rosegriffon.fr/RG_Logo_V2.5.webp` → 200/308
  (le website sert son `public/` depuis l'origine ; `NEXT_PUBLIC_CDN_URL` n'est visiblement
  pas actif en prod, donc le CDN cassé n'impacte pas le website).

## Verdict (état initial — pré-correctif)

| Surface | État (au moment de l'audit) | Sévérité |
|---|---|---|
| Images de jeu azalee (faces, telop skills, items, keshins/souls/auras, miximax, menu) | **100 % cassées** — `cdn.rosegriffon.fr/dx11/menu/**` → 404 (alias mal pointé) | **P0** |
| Légacy Supabase Storage menu | mort (400) | P0 (déjà contourné par le rewrite, mais cible morte aussi) |
| `public/` website | OK (origine) | — |
| `public/` azalee (UI : rarity/element/move/emote/…) | OK (origine) | — |

Fallback alors en place quand l'image jeu 404 : `/ievr.webp` (existe) → l'UI ne crashait pas mais
**aucune** vignette de perso/technique/objet/keshin ne s'affichait en prod.

## Re-run après correctif (VÉRIFIÉ 2026-06-03)

Cause unique = `alias` nginx du bloc `/dx11/` pointant vers `…/steamcmd/…` (inexistant) au lieu de
`…/iecode/inazuma/data/dx11/` (dump réel). Correctif = **one-liner** (re-pointer l'alias +
`nginx -t` + `reload`), **pas** un rsync de 3.7 Go : les 40 471 PNG étaient déjà sur l'hôte.

| URL re-testée | Code |
|---|---|
| `…/dx11/menu/icon_chr/face/c01000010_l_c01000010_1_l00.png` | **200** (`image/png`, 26 848 o) |
| `…/dx11/menu/200_icon/01_icon_emblem/em010001_em010001.png` | **200** |

→ Surface « images de jeu azalee » : **débloquée**. Conf corrigée versionnée dans
`infra/nginx/cdn.rosegriffon.conf`.
