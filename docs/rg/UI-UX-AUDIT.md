# Audit UI/UX & Responsive — Rose Griffon + Azalée

> Date : 2026-06-03 · Périmètre : homepages RG & Azalée, layouts/navigation, `packages/ui`.
> Méthode : captures `bxc recon --profile fast --screenshot` (viewport ~780px, rendu pré-hydratation
> = skeletons) + audit statique du code (Tailwind, a11y, tokens). bxc `recon` n'expose pas de flag
> de largeur de viewport ; les jugements responsive s'appuient donc sur la lecture des breakpoints CSS.

## Sévérités

- **P0** — bloquant / visuellement cassé pour une part des utilisateurs.
- **P1** — défaut net (a11y, token cassé, flash de layout, hors-charte) à corriger vite.
- **P2** — amélioration / refonte plus lourde, documentée, non appliquée sans validation.

---

## 1. Homepage Rose Griffon (`apps/website/src/app/page.tsx`)

| # | Sév | Problème | Preuve | Reco |
|---|-----|----------|--------|------|
| RG-1 | **P1** | Titre de section « Rejoignez la communauté » en **dégradé violet** `from-indigo-600 via-purple-600 to-indigo-600`. C'est exactement l'AI-slop proscrit par le brief, et c'est **hors-charte** (RG = rouge `#C83C51` / or `#FECD50`). | `page.tsx:304` | Remplacer par un dégradé de marque rouge→or (`from-primary via-[#C83C51] to-[#FECD50]` ou simplement `text-foreground` + accent). **Corrigé.** |
| RG-2 | **P2** | Le bloc Discord est entièrement indigo (`bg-indigo-500/10`, `text-indigo-600`, badges indigo). Acceptable car c'est la couleur de marque Discord, mais l'accumulation avec RG-1 donnait une page « violette ». Une fois RG-1 corrigé, le bloc Discord reste cohérent (couleur de service). | `page.tsx:320-349` | Conserver le `#5865F2` du bouton (marque Discord) ; éventuellement neutraliser les badges en `bg-muted`. Reco P2. |
| RG-3 | **P2** | `FusionBlock` intro : titre `text-gray-900 dark:text-white` et corps `text-gray-700 dark:text-gray-300` codés en dur au lieu des tokens `text-foreground` / `text-muted-foreground`. Incohérent avec le reste du design-system. | `page.tsx:232,236` | Migrer vers tokens sémantiques. Reco P2. |
| RG-4 | **P2** | Skeletons de lazy-load (`ProjectsSection`, `DiscordBlock`) en `from-gray-100 to-gray-200` — gris neutre hors-thème, visible au chargement. | `page.tsx:30,36` | Utiliser `bg-muted` / `bg-surface-container`. Reco P2. |

La structure sémantique est **bonne** : skip-link présent, `<h1 class="sr-only">`, `aria-labelledby` sur chaque `MotionSection`, images `isPriority`. Pas d'overflow horizontal détecté dans le code (toutes les sections sont `max-w-7xl mx-auto px-4…` bornées).

---

## 2. Homepage Azalée (`apps/azalee/app/page.tsx`)

| # | Sév | Problème | Preuve | Reco |
|---|-----|----------|--------|------|
| AZ-1 | — | Page bien structurée : `LandingHero`, sections `AnimatedSection` avec `delay` staggered, JSON-LD WebSite + VideoGame, conteneur `max-w-[1800px] mx-auto`, divider décoratif `aria-hidden`. RAS majeur. | — | — |
| AZ-2 | **P2** | `LandingHero` / `AchilleaBanner` utilisent `sizes="100vw"` sur des images qui ne font jamais 100vw sur desktop (sidebar/rail présents) → léger sur-téléchargement (LCP). | `LandingHero.tsx:50`, `home/AchilleaBanner.tsx:128` | Affiner `sizes` (`(min-width:840px) calc(100vw - 360px), 100vw`). Reco P2. |
| AZ-3 | **P2** | `pb-20` codé en dur sur `#home-content` pour la bottom-nav, sans `env(safe-area-inset-bottom)` au niveau du contenu (le `MaterialBottomNav` gère `pb-safe` lui-même, donc OK, mais le contenu pourrait coller au-dessus sur encoche basse). | `app/page.tsx:172` | Vérifier le chevauchement sur device à encoche ; sinon RAS. Reco P2. |

Le rendu bxc d'Azalée est un skeleton brun (pré-hydratation Supabase + i18n), conforme à l'attendu pour une home server-fetch.

---

## 3. Navigation & Layouts

### 3.1 Website (`client-layout.tsx` + composants `layout/`)

| # | Sév | Problème | Preuve | Reco |
|---|-----|----------|--------|------|
| NAV-1 | **P1** | **Token couleur cassé** : l'indicateur actif de la bottom-nav utilise `shadow-[0_2px_8px_rgba(var(--primary),0.5)]`. Or `--primary` est un `oklch(...)` (ou hex selon thème), pas un triplet RGB → `rgba(oklch(…),0.5)` est **invalide** ⇒ l'ombre ne s'affiche jamais (échec silencieux). | `MobileBottomNavigation.tsx:70,101` | Remplacer par `shadow-[0_2px_8px_color-mix(in_oklab,var(--primary)_50%,transparent)]` ou un `shadow-primary/50`. **Corrigé.** |
| NAV-2 | **P1** | **Flash de layout (CLS) SSR→client** : `useBreakpoint()` renvoie `"compact"` au premier rendu serveur. Sur desktop, le premier paint affiche donc le **layout mobile** (Header mobile + bottom-nav), puis bascule en desktop après hydratation. | `use-mobile.ts:32`, consommé par `client-layout.tsx:87` & `Shell.tsx:456` | Idéalement : SSR du breakpoint via cookie (déjà fait pour `defaultOpen` côté Azalée) ou rendu CSS-only des deux variantes. Reco P2 (changement structurel) — documenté. |
| NAV-3 | **P1** | **Cibles tactiles < 44px** dans le Header mobile : boutons thème / user / admin en `size-9` (36px) ; `LiveStatus`/`ThemeToggle` idem. WCAG 2.5.5 recommande ≥ 44px. (Azalée utilise `size-12` = 48px : conforme.) | `Header.tsx:93` ; `button.tsx` `size:"icon" = size-9` | Passer les icônes du header mobile à `size-11`/`h-11`. **Corrigé** (header mobile RG porté à `size-10`+ zone tactile, voir commit). |
| NAV-4 | **P1** | **Absence de landmark `<nav>`** pour la navigation principale desktop : le `Sidebar` partagé rend un `<div data-slot="sidebar">`, et `WebsiteNavigationRail`/`AzaleeNavigationRail` reposent sur `NavigationRail` (pas de `<nav>`/`role="navigation"`). Les bottom-navs, elles, utilisent bien `<nav>`. Un lecteur d'écran desktop n'a aucun landmark de navigation. | `app-sidebar.tsx`, `sidebar.tsx:237`, `NavigationRail` | Ajouter `aria-label` + rôle nav au niveau app (wrapper autour des liens) ou sur `NavigationRail`. **Corrigé** côté `NavigationRail` (role+aria-label) + reco pour la sidebar. |
| NAV-5 | **P2** | Double source de vérité de la sidebar : `useSidebarStore` (zustand) **et** `SidebarProvider open/onOpenChange`. `SidebarWrapper` calcule `isCompact/isMedium/isExpanded` sans les utiliser (variables mortes). Risque de désync. | `client-layout.tsx:60-79` | Nettoyer les variables inutilisées, unifier la source d'état. Reco P2. |
| NAV-6 | **P2** | `MobileBottomNavigationWrapper.tsx` (utilise `useIsMobile`) **n'est plus utilisé** : `client-layout` rend directement `<MobileBottomNavigation/>` sous `isCompact`. Fichier mort. | `MobileBottomNavigationWrapper.tsx` | Supprimer le wrapper orphelin. Reco P2. |
| NAV-7 | **P2** | `CustomSidebarTrigger` positionné `fixed top-[26px] left-[214px]` (valeur magique liée à `ml-[224px]`). Fragile si la largeur sidebar change (`SIDEBAR_WIDTH=16rem=256px` ≠ 224px utilisé dans l'inset). Incohérence de largeurs. | `client-layout.tsx:36,124` ; `sidebar.tsx:21` | Aligner sur une variable unique de largeur. Reco P2. |

### 3.2 Azalée (`Shell.tsx`)

| # | Sév | Problème | Preuve | Reco |
|---|-----|----------|--------|------|
| AZS-1 | — | Shell **exemplaire** : top-bar desktop sticky `z-[60]`, header mobile MD3 avec `pt-safe`, bottom-nav `pb-safe`, cibles `size-12`, `aria-expanded`, `aria-current`, haptics, scroll-to-top sur item actif. Référence inter-sites. | `Shell.tsx`, `MaterialBottomNav.tsx` | — |
| AZS-2 | **P2** | `DesktopTopBar` à `z-[60]` vs sidebar `z-50` vs nav-rail `z-50` : valeurs z magiques dispersées, à centraliser en tokens. | `Shell.tsx:333` | Échelle de z documentée. Reco P2. |
| AZS-3 | **P2** | `AzaleeNavigationRail` (medium) et `MaterialBottomNav` (compact) ne sont jamais affichés en même temps (breakpoints exclusifs) → **pas** de doublon de nav. Bon point, à préserver. | `Shell.tsx:527,572` | — |

---

## 4. Package UI partagé (`packages/ui/src/components/`)

| # | Sév | Problème | Preuve | Reco |
|---|-----|----------|--------|------|
| UI-1 | **P1** | **Token cassé** : variant `outline` de `SidebarMenuButton` → `shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` et `hover:shadow-[…hsl(var(--sidebar-accent))]`. Or `--sidebar-border`/`--sidebar-accent` valent `rgba(255,255,255,0.2)` / hex → `hsl(rgba(...))` **invalide** ⇒ bordure-ombre absente. Utilisé par `SidebarSearch` (website) et l'éditeur news (azalée). | `sidebar.tsx:492` | Remplacer par `shadow-[0_0_0_1px_var(--sidebar-border)]` (la var contient déjà une couleur complète). **Corrigé.** |
| UI-2 | **P1** | `SidebarRail` : `shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` (même bug). | `sidebar.tsx:492`/rail | **Corrigé** en même temps. |
| UI-3 | **P2** | `buttonVariants` : `size:"icon" = size-9` (36px) et `default = h-9`. Sous le seuil tactile 44px sur mobile. Les call-sites mobiles devraient utiliser une taille ≥44 ; envisager un `size:"icon-lg"` (`size-11`). | `button.tsx` | Ajouter une taille tactile. Reco P2. |
| UI-4 | **P2** | `Sidebar` ne pose pas de landmark `<nav>` (cf. NAV-4). Composant générique → changement à évaluer pour ne pas casser les autres usages (menus non-nav). | `sidebar.tsx` | Exposer un prop `asNav`/wrapper côté app. Reco P2. |

| UI-5 | **P2** | Hors périmètre nav mais détecté : `FilterChips.tsx:70` (wiki Azalée) référence `rgba(var(--md-sys-color-primary-rgb),0.5)` — ce token **n'existe pas** ⇒ `drop-shadow` cassé. | `apps/azalee/components/wiki/FilterChips.tsx:70` | Soit définir `--md-sys-color-primary-rgb`, soit `color-mix(in oklab, var(--md-sys-color-primary) 50%, transparent)`. Reco P2. |

Cohérence générale du package : bonne (focus-visible `ring-[3px]`, `motion-safe:`, `disabled:opacity-50`, tokens sémantiques). Les seuls défauts réels sont les **wrappers de couleur cassés** (UI-1/UI-2) et l'absence de variante tactile.

---

## 5. Cohérence inter-sites

- **Breakpoints** : les deux apps partagent `useBreakpoint` (`packages/ui`), bien : compact <600 / medium <840 / expanded <1200 / large. Cohérent.
- **Pattern de nav adaptatif identique** : compact = bottom-nav, medium = rail, expanded = sidebar. Très cohérent.
- **Divergence de qualité a11y/tactile** : Azalée est en avance (MD3, `size-12`, `pt-safe`/`pb-safe`, `aria-current`). Le website RG accuse un retard sur les cibles tactiles du header mobile (NAV-3) et les tokens couleur (NAV-1). → aligner RG sur le standard Azalée.
- **Charte** : Azalée respecte strictement ses tokens MD3 ; le website RG laisse fuiter du violet (RG-1) et des `gray-*` codés en dur (RG-3). À harmoniser sur rouge/or.
- **Footers** : tous deux solides (focus-visible, cibles `p-2.5`/`p-3` ≈ 40-44px, libellés `aria-label`). Le footer Azalée distingue Azalée/Association — plus riche. RAS bloquant.

---

## 6. Corrections appliquées (ce passage)

| Réf | Fichier | Correctif |
|-----|---------|-----------|
| RG-1 | `apps/website/src/app/page.tsx` | Dégradé violet → dégradé de marque rouge/or. |
| NAV-1 | `apps/website/src/components/layout/MobileBottomNavigation.tsx` | `rgba(var(--primary),…)` cassé → `color-mix(in oklab, var(--primary) 50%, transparent)`. |
| NAV-3 | `apps/website/src/components/layout/Header.tsx` | Cibles tactiles header mobile portées à ≥44px. |
| NAV-4 | `apps/azalee/components/navigation/AzaleeNavigationRail.tsx` + `apps/website/src/components/layout/WebsiteNavigationRail.tsx` | `role`/`aria-label` de navigation sur le rail. |
| UI-1/UI-2 | `packages/ui/src/components/sidebar.tsx` | `hsl(var(--sidebar-border/accent))` cassé → `var(--sidebar-border/accent)`. |

## 7. Reco P2 non appliquées (à valider)

NAV-2 (SSR breakpoint anti-CLS), NAV-5/6/7 (dette d'état sidebar, fichier mort, valeurs magiques), RG-2/3/4 (tokens home), AZ-2/3 (`sizes`, safe-area), AZS-2 (échelle z), UI-3/4 (variante tactile, landmark sidebar).
