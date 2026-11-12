// SPDX-License-Identifier: Apache-2.0
/**
 * Planificateur autonome : le service `cron` de compose.yaml.
 *
 * Même registre et mêmes expressions que la planification en processus de `rg-core`
 * (`apps/rg-bot/src/core.ts`, `planifierTaches`), mais dans son propre conteneur : `rg-core`
 * tourne alors avec `RG_CORE_CRON=0`. `RG_CORE_CRON_EXCLURE` retire des tâches (défaut : `warm`).
 *
 * `GET /health` sur `RG_CRON_PORT` (défaut 8811) rend la liste planifiée et le dernier
 * résultat de chaque tâche ; c'est la sonde du HEALTHCHECK du conteneur.
 */
import { PLANIFICATIONS, REGISTRE_TACHES, lancerTache } from "./index";

interface Dernier {
  success: boolean;
  error?: string;
  finiLe: string;
}

const exclues = new Set(
  (Bun.env.RG_CORE_CRON_EXCLURE ?? "warm")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean),
);
const planifiees: string[] = [];
const derniers = new Map<string, Dernier>();
const enCours = new Set<string>();

for (const nom of Object.keys(REGISTRE_TACHES)) {
  const expression = (PLANIFICATIONS as Record<string, string | undefined>)[
    nom
  ];
  if (!expression || expression === "manuel" || exclues.has(nom)) continue;
  try {
    Bun.cron(expression, async () => {
      // Une exécution lente ne se superpose pas à la suivante.
      if (enCours.has(nom)) return;
      enCours.add(nom);
      try {
        const r = await lancerTache(nom, { origine: "planifie" }).catch(
          (err) => ({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        derniers.set(nom, {
          success: r.success,
          error: r.error,
          finiLe: new Date().toISOString(),
        });
        if (!r.success)
          console.error(`[rg-cron] ${nom} : ${r.error ?? "échec"}`);
      } finally {
        enCours.delete(nom);
      }
    });
    planifiees.push(`${nom} ${expression}`);
  } catch (err) {
    console.error(
      `[rg-cron] planification « ${nom} » (${expression}) refusée :`,
      err,
    );
  }
}
console.info(`[rg-cron] ${planifiees.length} tâche(s) planifiée(s)`);

const demarreLe = Date.now();
const serveur = Bun.serve({
  hostname: Bun.env.RG_CRON_HOST ?? "0.0.0.0",
  port: Number(Bun.env.RG_CRON_PORT ?? 8811),
  fetch(requete) {
    if (new URL(requete.url).pathname !== "/health")
      return new Response("not found", { status: 404 });
    return Response.json({
      status: planifiees.length > 0 ? "ok" : "idle",
      uptime: Math.round((Date.now() - demarreLe) / 1000),
      planifiees,
      enCours: [...enCours],
      derniers: Object.fromEntries(derniers),
    });
  },
});
console.info(
  `[rg-cron] santé sur http://${serveur.hostname}:${serveur.port}/health`,
);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    serveur.stop();
    process.exit(0);
  });
}
