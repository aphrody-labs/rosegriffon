# Contrats du tableau de bord admin (audit du 25 septembre 2026)

## Constat vérifié dans le code

| Domaine | Source de vérité | Couverture du dashboard constatée | Écart |
| --- | --- | --- | --- |
| Auth | `@rosegriffon/auth`, `resolveProfile`, Better Auth | `app/admin/layout.tsx` protège les pages; `lib/api-auth.ts` protège les routes API admin | L'action `settings/actions.ts` utilisait une lecture directe du rôle et acceptait n'importe quelle clé; elle utilise désormais la résolution commune et une liste de clés publiques. |
| Paramètres RG | table PostgreSQL `public.settings` (`packages/db/src/types.gen.ts`) | `/admin/settings` affiche un éditeur visuel; `app/page.tsx` consomme trois clés d'introduction | Plusieurs champs visuels RG TV, Azalée et communauté sont enregistrés mais aucun consommateur serveur de ces clés n'a été trouvé. Les présenter comme opérationnels est prématuré. |
| Paramètres Achilléa | `GET /api/public/achillea/info` lit quatre clés `home_achillea_*` | L'onglet Achilléa ne montre qu'un aperçu, sans champs de réglage | Les quatre clés réellement utilisées sont exposées par `GET /api/admin/config/public` pour un futur formulaire typé. |
| Bot RG | `@rosegriffon/types/bot`, `lib/bot/reglages`, `/api/admin/bot/reglages` | API GET/PATCH/DELETE avec schéma strict et garde admin | Configuré par guilde, distinct de la table `settings` du site. |
| API, DB et packages | `apps/api`, `packages/db`, `packages/types` et autres packages | Menus admin spécialisés, sans contrat unifié de découverte | Aucune preuve que chaque endpoint, table, type ou paramètre d'infrastructure soit configurable depuis le dashboard. Un accès générique serait dangereux pour l'auth, les secrets et l'intégrité des données. |

## Tranche livrée

`lib/admin-settings-contract.ts` définit sept paramètres publics avec libellé, type et consommateur prouvé. `GET /api/admin/config/public` retourne uniquement ces clés et leur valeur courante après contrôle Better Auth + rôle admin. L'action d'écriture refuse les clés non répertoriées et les URL non HTTPS; son journal ne contient plus la valeur. Aucun secret ni OAuth token n'entre dans ce contrat.

## À poursuivre

Raccorder les champs visuels à de vrais consommateurs ou retirer leur promesse de sauvegarde, puis bâtir les formulaires métier par domaine sur les schémas existants. Tester chaque écriture avec une session admin et une session non admin, sur une base de test, avant toute déclaration de couverture complète.
