import { getPgPool } from "@rosegriffon/db/pg";
import { Button } from "@rosegriffon/ui";

import { Check, ExternalLink } from "@/lib/icons-config";
import { texteSansDecor } from "@/lib/typographie";

const PATREON_URL = "https://patreon.com/RoseGriffon";

/**
 * Avantages annoncés par l'équipe dans les posts Patreon (packs personnage
 * mensuels, badge RG pour les nouveaux abonnés, propositions de fresque).
 * Les paliers eux-mêmes — nom, prix, nombre de mécènes — viennent de la base.
 */
const AVANTAGES: Record<string, string[]> = {
  evans: [
    "Pack personnage mensuel : print A5 et sticker, marque-page, grand badge holographique",
    "Badge Rose Griffon personnalisé pour les nouveaux abonnés, dans leur premier colis",
    "Propositions de personnages pour la fresque collaborative des abonnés",
  ],
};

interface PalierBase {
  titre: string;
  montant_cents: string;
  mecenes: number;
}

async function lirePaliers(): Promise<PalierBase[]> {
  const { rows } = await getPgPool().query<PalierBase>(
    `SELECT t.titre, t.montant_cents, count(*)::int AS mecenes
       FROM patreon_memberships m,
            LATERAL unnest(m.tier_titles, m.tier_amounts_cents) AS t(titre, montant_cents)
      WHERE m.patron_status = 'active_patron' AND t.montant_cents::bigint > 0
      GROUP BY 1, 2
      ORDER BY t.montant_cents::bigint`,
  );
  return rows;
}

function formatPrix(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €/mois`;
}

export async function PublicTiers() {
  const paliers = await lirePaliers().catch(() => []);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {paliers.map(palier => {
          const nom = texteSansDecor(palier.titre);
          const avantages = AVANTAGES[nom.split(/\s+/).at(-1)?.toLowerCase() ?? ""] ?? [];
          return (
            <div
              key={palier.titre}
              className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 text-card-foreground"
            >
              <h3 className="text-lg font-bold text-foreground">{nom}</h3>
              <p className="mt-1 mb-4 text-2xl font-bold text-primary">{formatPrix(Number(palier.montant_cents))}</p>
              {avantages.length > 0 && (
                <ul className="space-y-2 text-sm text-foreground/85">
                  {avantages.map(avantage => (
                    <li key={avantage} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span>{avantage}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                {palier.mecenes} mécène{palier.mecenes > 1 ? "s" : ""} actuellement
              </p>
              <div className="mt-auto pt-6">
                <Button asChild size="lg" className="h-auto min-h-12 w-full rounded-full px-4 py-3 whitespace-normal">
                  <a href={PATREON_URL} target="_blank" rel="noopener noreferrer">
                    Choisir {nom}
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {paliers.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Les paliers sont affichés sur la page Patreon de l'association.
        </p>
      )}

      <div className="flex justify-center">
        <Button asChild variant="outline" size="lg" className="rounded-full">
          <a href={PATREON_URL} target="_blank" rel="noopener noreferrer">
            Voir tous les paliers sur Patreon
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  );
}
