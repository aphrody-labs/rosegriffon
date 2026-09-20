# PARTITION — Répartition du Travail Multi-Agent (AGY & Claude)

> **Mode : Autonome (YOLO 100% / No Human in the Loop)**  
> **Source de vérité : `PLAN.md`**  
> **Objectif : Exécution parallèle et collaborative sans collision de fichiers**

---

## 1. Principes de la Partition

1. **Égalité des Agents** : Antigravity (AGY) et Claude Code opèrent comme pairs, partageant le même prompt global, la même mémoire `/home/ubuntu/.aphrody/` et les mêmes garde-fous.
2. **Cloisonnement Strict des Fichiers** : Chaque lot de travail attribue des fichiers de code spécifiques pour éviter tout écrasement ou conflit de merge.
3. **Validation Continue par les Tests** :
   - `bun test packages/ui/test`
   - `bun test packages/app-shell/test`
   - `bun test apps/website/src/lib/achillea`
   - `bun --filter @rosegriffon/website type-check`
4. **Pas d'Arrêt, Pas de Confirmation** : Toute décision réversible est tranchée immédiatement selon le contrat d'architecture défini dans `PLAN.md`.

---

## 2. Matrice des Tâches et Périmètres

| Lot | Domaine | Responsable Principal | Fichiers Cibles | Statut |
|---|---|---|---|---|
| **LOT-01** | Tokens & Thème Achilléa | AGY | `packages/ui/src/styles.css`, `packages/ui/scripts/generer-tokens.ts`, `packages/ui/src/tokens.ts`, `packages/ui/src/lib/themes.ts`, `packages/ui/src/components/theme-provider.tsx`, `packages/config/tailwind-preset.ts` | **FAIT** (25/25 tests passés) |
| **LOT-02** | Navigation 3 Piliers & AppSidebar | AGY | `packages/app-shell/src/config/navigation.ts`, `packages/app-shell/src/components/AppSidebar.tsx`, `packages/app-shell/src/lib/icons.ts`, `packages/app-shell/src/lib/translations.ts` | **EN COURS** |
| **LOT-03** | TopAppBar Unifiée & Badge Univers | AGY & Claude | `packages/app-shell/src/components/TopAppBar.tsx`, `packages/app-shell/src/components/UnifiedSearchBar.tsx`, `packages/app-shell/src/components/Shell.tsx` | **EN COURS** |
| **LOT-04** | MobileBottomNav Unifiée | AGY & Claude | `packages/app-shell/src/components/MobileBottomNav.tsx`, `packages/app-shell/src/config/navigation.ts` | **EN COURS** |
| **LOT-05** | Refonte Layouts Apps | AGY | `apps/website/src/app/client-layout.tsx`, `apps/website/src/app/wiki/layout.tsx`, `apps/website/src/app/achillea/layout.tsx` | **EN COURS** |
| **LOT-06** | SearchBar Fédérée Multi-Domaines | AGY & Claude | `apps/website/src/app/search/page.tsx`, `apps/website/src/app/actions/search.ts`, `apps/website/src/components/search/global-search.tsx` | **EN COURS** |
| **LOT-07** | Migration des Tests Achilléa | Claude | `apps/website/src/lib/achillea/__tests__/`, `apps/website/src/lib/achillea/tournament-organizer.test.ts`, `apps/website/src/lib/achillea/auth-session.test.ts` | **À FAIRE** |
| **LOT-08** | Purge des Vieilles Docs Obsolètes | AGY | `docs/PLAN-SECURITE-BASCULE.md`, `docs/PLAN-SESSION-3D.md`, `docs/azalee-plan-correctifs.md`, `docs/achillea-phase0-*.json`, `docs/README.md` | **EN COURS** |

---

## 3. Protocole d'Intégration et de Validation

À chaque lot terminé :
```bash
# 1. Vérifier les tests du chrome et du design system
bun test packages/ui/test packages/app-shell/test apps/website/src/lib/achillea

# 2. Vérifier les types Next.js
bun --filter @rosegriffon/website type-check

# 3. Valider le build
cd apps/website && bun run build
```
Rapport de clôture obligatoire avec statut tri-state : `FAIT`, `INCOMPLET`, ou `NON_FAIT`.
