# Rose Griffon design recon (rosegriffon.fr -> desktop modding tools)

Date: 2026-11-05. Method: replica-recon (screen inventory, components, tokens), read-only.
Scope: the association site's chrome and project pages, reused by the Rose Griffon
launcher, texture editor and avatar maker. It is the user's own site and the user's
own `rg-ui` source, so this is a reuse map, not a clean-room clone.

## Sources

| source | what it gave |
| --- | --- |
| https://rosegriffon.fr/ (signed-in session, theme Roy) | shell, home hero, project cards, Discord widgets, footer |
| https://rosegriffon.fr/projets | project grid, expanded sidebar sub-nav |
| https://rosegriffon.fr/projets/outils/pfp | Avatar RG tool (closest analogue to the avatar maker) |
| theme switcher menu (opened, nothing selected) | 5 entries: Roy, Gaëlle, Azalée clair, Azalée sombre, Achilléa |
| `C:/src/apps/rosegriffon/packages/rg-ui/src/lib/themes.ts` | `THEMES` (brand palette + icon), `THEME_PACKS` (title, logo, wallpaper, pet, OKLCH seed), `sectionTheme()` |
| `C:/src/apps/rosegriffon/packages/rg-ui/src/tokens.ts` | generated hex projection of 7 themes: `md3` and `shadcn` roles, `MARQUE`, `FORMES` |
| `C:/src/apps/rosegriffon/packages/rg-ui/src/brands.css` | generated M3 sheets for `theme-rg`, `theme-rg-dark`, `achillea`, `azalee-light`, `azalee-dark` |
| `C:/src/apps/rosegriffon/packages/rg-ui/src/styles.css` | hand-written Roy/Gaëlle OKLCH blocks, M3 type scale, state layers, motion |
| `C:/src/apps/rosegriffon/packages/rg-ui/src/components/theme-provider.tsx` | `ThemeProvider` (next-themes, class on `<html>`, key `rg-theme`, default `roy`), `useTheme()` |
| `C:/src/apps/rosegriffon/packages/rg-app-shell/src/components/ThemeToggle.tsx` | switcher UI and labels |
| `C:/src/apps/rosegriffon/apps/rg-website/src/lib/fonts.ts`, `src/app/globals.css` | Roboto body, Poppins headings |

Screenshots were only viewed, not saved. Several captures timed out (renderer busy on
the home page); the theme menu content was read from the accessibility tree.

## Screen inventory

| ID | screen | route | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Home | `/` | association pitch, project entry points, community | top app bar, sidebar, hero split card (illustration + text), section title, project card grid (4), "see all" pill button, 2 Discord widget cards, footer | filled, signed in |
| S02 | Projects | `/projets` | catalogue of community tools | page header (icon tile + title), project card grid (3 per row), expanded "Projets" sidebar group with sub-items | filled |
| S03 | Avatar RG | `/projets/outils/pfp` | upload a profile picture and apply an official frame | centred title + lead, tool card with gradient top rule, circular drop zone, frame swatches (2 round thumbnails), primary button, share row (X, Discord, Instagram), explanatory illustration | empty (no image) |
| S04 | Theme menu | header button "Changer de thème" | switch among the 5 chrome themes | dropdown menu, items with mascot/logo icon + label + check, separator, tuner dialog entry | open |
| S05 | Wiki / E-sport sections | sidebar groups `WIKI`, `E-SPORT` | separate sub-sites | collapsible group pills with their own brand icon | collapsed only; `sectionTheme()` forces `azalee-dark` (wiki) and `achillea` (esport) |

Not visited: `/community`, `/notre-equipe`, `/evenements`, `/sondages`, `/feed`, `/shop`,
`/nous-soutenir`, `/settings`, `/admin`, the other project pages, mobile layout.

## Navigation

- Top app bar (full width, `--sidebar` colour in Roy): hamburger / "Toggle Sidebar", back
  arrow on inner pages, "Accueil" home link, logo + brand title (`THEME_PACKS[*].title`,
  `logo`), breadcrumb chip ("· Projets"), centred pill search ("Recherche unifiée", `⌘K`
  hint), right cluster: apps grid (admin), language (FR/EN), theme switcher (mascot
  icon), settings gear, avatar.
- Left sidebar: flat list (Accueil, Communauté, Notre équipe, Événements, Sondages, Feed,
  Boutique, Projets [expandable], Nous soutenir), then section groups WIKI and E-SPORT
  as rounded pills with chevrons. Items use either a line icon or a small character
  emote; active item is a rounded tonal pill.
- Footer: copyright left, legal links right (Contact, Mentions légales, CGU,
  Confidentialité).

## Typography

| role | family | source |
| --- | --- | --- |
| body, UI labels | Roboto 400/500/700 (`--font-roboto`) | `apps/rg-website/src/lib/fonts.ts` |
| h1-h6, card titles, section titles | Poppins 600/700 (`--font-poppins`), letter-spacing -0.01em | `globals.css` heading rule |
| Azalée pages | Noto Sans, Lato (lazy) | `fonts.ts` |
| Achilléa | "Achillea Sans" (local) over Poppins | `app/achillea/achillea.css` |
| decorative | Super Cartoon, Brad Bun, Aklatan utility classes; Avatar RG illustration uses a cartoon display face | `globals.css` |
| scale | M3 `type-display-*` to `type-label-small` (57/64 down to 11/16) on `--font-sans` | `rg-ui/src/styles.css` |

Visual check matched: heavy geometric headings (Poppins), neutral body (Roboto).

## Component list

| component | variants / states seen | screens | rg-ui source |
| --- | --- | --- | --- |
| App bar | inner page adds back + breadcrumb | all | `rg-app-shell` |
| Sidebar + groups | expanded group with sub-items, active pill, section pills | all | `components/sidebar.tsx` |
| Search field | pill, keyboard hint chip | all | `input-group.tsx`, `kbd.tsx`, `command.tsx` |
| Hero split card | image left, eyebrow + title + lead right | S01 | `card.tsx` |
| Project card | cover image, corner badge (status: "Nouveau", "Galerie", ...), overlapping mascot emote chip, icon tile + title, lead, footer link with arrow | S01, S02 | `card.tsx`, `badge.tsx` |
| Pill button | outline "see all", primary filled "Choisir une image", small "Rejoindre" | S01, S03 | `button.tsx` |
| Page header | icon tile + title + rule | S02 | `admin-page-header.tsx` pattern |
| Tool card | gradient top rule, title + caption, circular drop zone, frame swatches | S03 | `card.tsx`, `file-uploader.tsx`, `toggle-group.tsx` |
| Share row | icon buttons | S03 | `button-group.tsx`, `brand-icons.tsx` |
| Discord widget card | header + join button, member list with presence dots, scroll | S01 | `scroll-area.tsx`, `avatar.tsx` |
| Theme menu + tuner dialog | 5 items, check on active, separator, per-theme tuner | S04 | `ThemeToggle.tsx`, `dropdown-menu.tsx`, `dialog.tsx` |

## Tokens: visual role -> rg-ui token

Values are copied from `tokens.ts` (generated hex projection of `styles.css`/`brands.css`).
No colour below is invented. UI roles should use `THEMES[nom].shadcn` / `.md3` from
`tokens.ts`; `lib/themes.ts` `THEMES[id].colors` is the brand palette (logos, accents),
and differs from the rendered roles (Roy brand primary `#344E8C` vs UI primary `#0e5794`).

| visual role on site | token | Roy (`theme-roy`) | Gaëlle | Azalée clair | Azalée sombre | Achilléa |
| --- | --- | --- | --- | --- | --- | --- |
| app bar + sidebar fill | `shadcn.sidebar` | `#183f78` | `#922817` | `#fff8f5` | `#19120d` | `#151218` |
| sidebar text/icons | `shadcn.sidebarForeground` | `#ffffff` | `#ffffff` | `#221a15` | `#f0dfd7` | `#e7e0e8` |
| active nav pill | `shadcn.sidebarAccent` | `rgba(255,196,110,0.2)` | `rgba(255,196,110,0.2)` | `#e6e6ad` | `#48491f` | `#653b43` |
| sidebar dividers | `shadcn.sidebarBorder` | `rgba(255,196,110,0.3)` | same | `#d7c3b7` | `#52443c` | `#4a454e` |
| page background | `shadcn.background` | `#f9f4ee` | `#ffe8e0` | `#fff8f5` | `#19120d` | `#151218` |
| headings, body text | `shadcn.foreground` | `#03172c` | `#550000` | `#221a15` | `#f0dfd7` | `#e7e0e8` |
| cards, menus | `shadcn.card` / `popover` | `#ffffff` | `#ffffff` | `#fff1ea` / `#fcebe2` | `#221a15` / `#261e19` | `#1d1a20` / `#211e24` |
| card lead text | `shadcn.mutedForeground` | `#4d667f` | `#944a46` | `#52443c` | `#d7c3b7` | `#ccc4cf` |
| card cover placeholder | `shadcn.muted` | `#f2eee7` | `#f7ded6` | `#f4ded3` | `#52443c` | `#4a454e` |
| primary button, links ("Rose Griffon" in lead), focus ring | `shadcn.primary` / `ring` | `#0e5794` | `#b32228` | `#8b5023` | `#ffb786` | `#d7bafb` |
| text on primary | `shadcn.primaryForeground` | `#fafafa` | `#fafafa` | `#ffffff` | `#502400` | `#3c255a` |
| gold accent (frame gradient, highlights) | `shadcn.accent` | `#e0b771` | `#fca676` | `#e6e6ad` | `#48491f` | `#653b43` |
| card borders, input outline | `shadcn.border` / `input` | `#d4dfeb` | `#f7ccc4` | `#d7c3b7` | `#52443c` | `#4a454e` |
| destructive | `shadcn.destructive` | `#e7000b` | `#840015` | `#ba1a1a` | `#ffb4ab` | `#ffb4ab` |
| corner radius: card / button / pill | `FORMES.large` / `medium` / `full` | 16 / 12 / 9999 px | | | | |
| brand constants (outside themes) | `MARQUE` (`marine #0a152c`, `rose #f13f8a`, `griffon #d8b349`, ...) | | | | | |
| third-party (Discord join) | `MARQUES_TIERCES.discord` `#5865f2` | | | | | |

Notes:
- Observed home/projects/pfp all rendered in Roy: dark blue bar/sidebar, warm off-white
  page, white cards, gold accents; consistent with the Roy column.
- `tokens.ts` also carries `theme-rg` / `theme-rg-dark` (M3 seed `#e91e63`), which are not
  in the user-facing switcher.
- Radius values for each component were judged from screenshots; the scale itself is
  `FORMES`.

## Mascots and theme switcher

- `THEMES[id].icon` is the switcher icon: Roy -> `RG_Roy_salut.webp`, Gaëlle ->
  `RG_Gaelle_salut.webp`, both Azalée -> `RG_Reika_zukan.webp` (Reika), Achilléa -> logo SVG.
  The header button shows the active theme's mascot (Roy was visible in the bar).
- `THEME_PACKS[id].pet` declares the companion: Roy (`hello`, `proud` = `RG_roy_fine`),
  Gaëlle (`hello`, `proud` = `RG_Gaelle_fiere`, `surprised` = `RG_Gaelle_surprise`), Reika
  (`hello` only), Achilléa `null`. In the website source, `pack.title`, `pack.logo` and
  `pack.wallpaper` are consumed (`client-layout.tsx`, `ThemeBackdrop.tsx`), but no code
  reads `pack.pet` yet. The pet emotes are declared but unused.
- Elsewhere mascots appear as decoration: round emote chips that overlap project card
  covers, small character emotes as sidebar item icons, character art in the hero.
- Switcher: dropdown "Changer de thème" with 5 entries (labels in `ThemeToggle.tsx`:
  "Azalée sombre" there vs `THEMES["azalee-dark"].name` = "Azalée"), a separator, then a
  per-theme colour tuner dialog stored on the device. Persistence is next-themes
  `localStorage` key `rg-theme`, class on `<html>`, default `roy`, no system mode.
  `useTheme().cycleTheme()` walks `CHROME_THEMES` in order.
- Section override: `sectionTheme("wiki")` = `azalee-dark`, `sectionTheme("esport")` =
  `achillea`, set on the container without touching the saved choice.

## Recommendations for the desktop tools

1. Generate the desktop palette from `tokens.ts` only. Import `THEMES`, `md3()`,
   `shadcn()`, `FORMES` and `MARQUE` (the module is pure, without DOM or Node APIs) and
   emit the native theme for the launcher, texture editor and avatar maker from it.
   Do not hand-copy hex values and do not use `lib/themes.ts` `colors` for UI surfaces,
   because they are brand marks and do not match the rendered roles.
2. Reuse the web shell layout: a top bar on `sidebar` with title, logo and wallpaper from
   `THEME_PACKS`, a left rail with the tool list (Launcher, Textures, Avatar), and content
   on `background` with `card` panels at `FORMES.large`. The texture editor's canvas should
   sit on `surfaceContainerLowest`/`card` with tool palettes in `popover`, so checkerboard
   and texture colours never collide with the gold `accent`.
3. Model the avatar maker on S03 (Avatar RG): a circular preview, a row of frame
   swatches as a single-select toggle group, one primary action, and export or share as
   secondary icon buttons. Keep the gold `accent` for frame chrome only and use `primary`
   for the action.
4. Make the pet the first consumer of `THEME_PACKS[*].pet`: `hello` on launcher start,
   `proud` after a successful mod install or export, `surprised` (Gaëlle only) on
   warnings. Fall back to `hello` when an emote is missing, and hide the pet when it is
   `null` (Achilléa). Keep it to a corner chip like the project cards so it never
   covers the editing area.
5. Mirror the theme contract: same 5 ids and order as `CHROME_THEMES`, default `roy`,
   labels from `ThemeToggle.tsx` (and align "Azalée"/"Azalée sombre" in the source
   first), and a switcher whose icon is the active mascot. Use Poppins 600/700 for
   titles and Roboto for UI text. Run the per-theme `primary`/`primaryForeground` and
   `sidebar`/`sidebarForeground` pairs through the contrast check (`m3_contrast`)
   before shipping, especially the translucent Roy/Gaëlle `sidebarAccent` over `#183f78`
   and `#922817`.
