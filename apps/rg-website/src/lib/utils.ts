/**
 * Re-export depuis @rosegriffon/ui — backward-compat pour les imports existants.
 * Source canonique = packages/rg-ui/src/lib/utils.ts
 *
 * ⚠ RÉEXPORT NOMMÉ, DEPUIS LE MODULE PUR. `export * from "@rosegriffon/ui"`
 * réexportait le baril entier : l'optimiseur de barils de Next ne voit pas les
 * noms demandés à travers un `export *`, si bien que tout fichier client qui
 * importait `cn` d'ici tirait les ~90 composants du paquet, recharts compris
 * (accueil : ~2,9 Mo de JS brut, audit du 5/11/2026).
 */
export { cn } from "@rosegriffon/ui/lib/utils";
