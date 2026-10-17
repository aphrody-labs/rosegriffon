import { PatreonIcon } from "@rosegriffon/ui";
import { getPgPool } from "@rosegriffon/db/pg";

/** Les extraits Patreon arrivent sans espace entre paragraphes : on la rétablit. */
const aerer = (texte: string) => texte.replace(/([!?.…])(?=[A-ZÀ-ÖØ-Þ])/g, (_m, p) => p + " ");

interface PostPack {
  patreon_post_id: string;
  title: string;
  url: string | null;
  published_at: Date | string;
  content_excerpt: string | null;
}

const URL_PATREON = "https://www.patreon.com/RoseGriffon";

/**
 * Les packs personnage sont distribués aux mécènes du niveau Evans : le contenu
 * vient des posts publiés sur Patreon (`patreon_post_events`), pas d'un catalogue.
 */
async function lirePacks(): Promise<PostPack[]> {
  const { rows } = await getPgPool().query<PostPack>(
    `SELECT patreon_post_id, title, url, published_at, content_excerpt
       FROM patreon_post_events
      WHERE title ~* '(pack|box) personnage'
      ORDER BY published_at DESC
      LIMIT 6`,
  );
  return rows;
}

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

export async function PacksPatreon() {
  const packs = await lirePacks().catch(() => []);
  return (
    <section aria-labelledby="packs-titre" className="rounded-3xl border-2 border-rg-or/40 bg-rg-marine p-6 text-white">
      <h2 id="packs-titre" className="flex items-center gap-3 text-xl font-extrabold">
        <PatreonIcon className="size-6 text-rg-or" aria-hidden />
        Les packs personnage, via Patreon
      </h2>
      <p className="mt-2 max-w-prose text-sm text-white/80">
        Chaque mois, un personnage d'Inazuma Eleven est illustré par l'équipe : un print A5 et un sticker, un marque-page
        et un grand badge. Les packs sont envoyés aux mécènes du niveau Evans ; pas de vente à l'unité pour l'instant.
      </p>
      {packs.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {packs.map(pack => (
            <li key={pack.patreon_post_id} className="rounded-2xl border border-rg-or/30 bg-white/5 p-4">
              <a
                href={pack.url ?? URL_PATREON}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-rg-or underline-offset-4 hover:underline"
              >
                {pack.title}
              </a>
              <p className="text-xs text-white/60">{date.format(new Date(pack.published_at))}</p>
              {pack.content_excerpt && (
                <p className="mt-2 line-clamp-3 text-sm text-white/80">{aerer(pack.content_excerpt)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <a
        href={URL_PATREON}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-rg-or px-4 text-sm font-semibold text-rg-marine hover:bg-rg-or/90"
      >
        Voir le Patreon
      </a>
    </section>
  );
}
