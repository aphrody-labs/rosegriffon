# 🎨 Badge & Chip - Material Design 3

> Composants modernisés pour Azalee (Inazuma Eleven Victory Road)

## 🚀 Démarrage rapide

### Installation

Les composants sont déjà installés et prêts à l'emploi.

### Import

```tsx
import { Badge, Chip, ElementBadge, PositionChip } from "@/components/ui";
```

### Usage basique

```tsx
// Badge
<Badge variant="large" color="error">3</Badge>

// Chip
<Chip variant="filter" selected={isSelected} onClick={toggle}>
  Attaque
</Chip>

// Badge Inazuma
<ElementBadge element="feu" />
<PositionBadge position="gardien" />
```

---

## 📦 Composants disponibles

### Badge

Indicateurs visuels pour notifications et statuts

- ✨ 3 variantes: `large`, `small`, `inline`
- 🎨 4 couleurs: `error`, `primary`, `secondary`, `tertiary`
- 📍 5 positions: standalone + 4 coins
- 🎬 Animations: apparition + pulse

### Chip

Éléments interactifs pour filtres et tags

- ✨ 6 variantes MD3: `assist`, `filter`, `input`, `suggestion`, `elevated`, `filled`
- 📏 3 tailles: `sm` (24px), `md` (32px), `lg` (40px)
- 🖼️ Support icônes et avatars
- ✅ État sélectionné pour filtres
- ❌ Fermeture pour tags

### Variantes Inazuma Eleven

- 🔥 **ElementBadge** - Éléments (Feu, Forêt, etc.)
- ⚽ **PositionBadge** - Positions (AT, DF, GB, etc.)
- ⭐ **RarityBadge** - Rareté (Commun, Légendaire, etc.)
- 📊 **StatBadge** - Statistiques (TP, VIT, etc.)
- 🎯 **ElementChip** - Filtres d'éléments
- 🎯 **PositionChip** - Filtres de positions
- 👕 **TeamChip** - Tags d'équipes

---

## 📚 Documentation

| Fichier                                                  | Description                              |
| -------------------------------------------------------- | ---------------------------------------- |
| [BADGE-CHIP-README.fr.md](./BADGE-CHIP-README.fr.md)     | 🇫🇷 Guide utilisateur complet en français |
| [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)               | ⚡ Référence rapide (cheat sheet)        |
| [badge-chip-examples.md](./badge-chip-examples.md)       | 📖 Exemples détaillés avec code          |
| [README-BADGE-CHIP.md](./README-BADGE-CHIP.md)           | 🔧 Guide technique d'intégration         |
| [IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md) | 📋 Résumé de l'implémentation            |
| [CHANGELOG-BADGE-CHIP.md](./CHANGELOG-BADGE-CHIP.md)     | 📝 Historique des versions               |

---

## 🎨 Démos interactives

Lancer le serveur de développement:

```bash
cd apps/azalee
pnpm dev
```

Puis visiter:

- **`/badge-chip-demo`** - Composants de base
- **`/inazuma-badges-demo`** - Variantes Inazuma Eleven

---

## 🧪 Tests

Lancer les tests unitaires:

```bash
cd apps/azalee
pnpm test badge-chip
```

Coverage:

- ✅ Toutes les variantes
- ✅ États (selected, disabled)
- ✅ Interactions (click, close)
- ✅ Accessibilité (ARIA, keyboard)

---

## 💡 Exemples rapides

### Badge sur icône

```tsx
<div className="relative">
	<button>
		<BellIcon />
	</button>
	<Badge variant="large" position="top-right" color="error">
		5
	</Badge>
</div>
```

### Filter chips

```tsx
<ChipGroup>
	<Chip variant="filter" selected={filters.attaque} onClick={toggle}>
		Attaque
	</Chip>
	<Chip variant="filter" selected={filters.defense} onClick={toggle}>
		Défense
	</Chip>
</ChipGroup>
```

### Carte de personnage

```tsx
<div className="character-card">
	<h3>Mark Evans</h3>

	<div className="badges">
		<PositionBadge position="gardien" />
		<ElementBadge element="montagne" showIcon />
		<RarityBadge rarity="legendaire" />
	</div>

	<div className="stats">
		<StatBadge stat="tp" value={150} />
		<StatBadge stat="garde" value={98} />
	</div>
</div>
```

---

## 🎯 Material Design 3

Ces composants respectent les spécifications MD3:

- ✅ Couleurs via tokens `var(--md-sys-color-*)`
- ✅ Motion: `emphasized-decelerate` easing
- ✅ State layers: 8% hover, 12% active, 38% disabled
- ✅ Élévations: shadows MD3 standards
- ✅ Typography: classes `type-*`
- ✅ Corners: `rounded-full`

---

## 📊 Performance

- **Bundle size**: ~5.5KB (gzipped)
- **Tree-shaking**: Automatique
- **Animations**: CSS natives
- **Optimisations**: Classes Tailwind purgées

---

## ♿ Accessibilité

### Badge

- Utilise `<span>` sémantique
- Support dark mode
- Respecte `prefers-reduced-motion`

### Chip

- Support clavier complet
- Focus ring MD3
- ARIA labels
- État disabled conforme

---

## 🗂️ Structure des fichiers

```
components/ui/
├── badge.tsx                         # Composant Badge ⭐
├── chip.tsx                          # Composant Chip ⭐
├── inazuma-variants.tsx              # Variantes Inazuma ⭐
├── index.ts                          # Exports centralisés
├── badge-chip-examples.md            # Documentation complète
├── README-BADGE-CHIP.md              # Guide technique
├── BADGE-CHIP-README.fr.md           # Guide utilisateur FR
├── IMPLEMENTATION-SUMMARY.md         # Résumé implémentation
├── CHANGELOG-BADGE-CHIP.md           # Changelog
├── QUICK-REFERENCE.md                # Cheat sheet
├── README.md                         # Ce fichier
└── __tests__/
    └── badge-chip.test.tsx           # Tests unitaires
```

---

## 🔗 Liens utiles

- [Material Design 3 - Badges](https://m3.material.io/components/badges/overview)
- [Material Design 3 - Chips](https://m3.material.io/components/chips/overview)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/)

---

## 🆘 Support

1. **Documentation**: Consulter les fichiers `.md`
2. **Démos**: Visiter `/badge-chip-demo` et `/inazuma-badges-demo`
3. **Tests**: Lancer `pnpm test badge-chip`
4. **Issues**: Vérifier `app/globals.css` pour les tokens MD3

---

## 📝 Licence

Fait partie du projet Rose Griffon (Azalee).

---

**Version**: 1.0.0
**Date**: 2026-01-20
**Auteur**: Rose Griffon Team
**Projet**: Azalee - Inazuma Eleven Victory Road
