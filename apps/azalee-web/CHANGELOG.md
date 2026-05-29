# Changelog Azalee

## 2026-02-06

### Conversion des assets PNG → WebP (`data/images/menu/`)

**Contexte** : Tous les fichiers PNG du répertoire `data/images/menu/` (environ 33 400 fichiers, 1.8 Go) ont été convertis en WebP pour réduire la taille des assets.

**Ce qui a changé** :

- Tous les fichiers `.png` dans `data/images/menu/200_icon/` et `data/images/menu/220_img/` ont été convertis en `.webp` (qualité 80)
- Les fichiers PNG originaux ont été supprimés après conversion réussie
- Les fichiers `.webp` pré-existants (notamment dans `220_img/telop_waza/fr/`) n'ont pas été touchés
- Réduction estimée : ~1.8 Go → ~600 Mo (environ -65%)

**Impact sur le code** :

- **Toutes les références à des images `.png` dans `data/images/menu/` doivent être mises à jour vers `.webp`**
- Cela concerne potentiellement :
  - Les composants React qui utilisent `<Image>` ou `<img>` avec des chemins vers `/menu/`
  - Les fichiers CSS/Tailwind avec `background-image` pointant vers ces assets
  - Les fichiers de données/config qui référencent des chemins d'images (inagle, JSON, etc.)
  - Les scripts de sync/crawl qui génèrent des chemins d'images

**Outil utilisé** : `cwebp -q 80` (package apt `webp`)
