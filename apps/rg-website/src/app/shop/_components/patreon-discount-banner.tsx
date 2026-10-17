import { PatreonIcon } from "@rosegriffon/ui";
import Link from "next/link";

import { PATRON_DISCOUNT_PERCENT, getPatronDiscount } from "@/lib/patreon/discount";
import { getServerUser } from "@/lib/auth-helpers";
import { texteSansDecor } from "@/lib/typographie";

const LIEN = "font-semibold underline decoration-rg-or decoration-2 underline-offset-4 hover:text-rg-or";

export async function PatreonDiscountBanner() {
  let userId: string | null = null;
  try {
    const user = await getServerUser();
    userId = user?.id ?? null;
  } catch {
    // Not logged in
  }

  if (!userId) {
    return (
      <aside aria-live="polite" className="rounded-2xl border-2 border-rg-or/40 bg-rg-marine p-4 text-white">
        <p className="flex items-start gap-3 text-sm">
          <PatreonIcon className="mt-0.5 size-5 shrink-0 text-rg-or" aria-hidden />
          <span>
            <strong className="font-extrabold text-rg-or">
              -{PATRON_DISCOUNT_PERCENT}% pour les mécènes Patreon
            </strong>{" "}
            sur toute la boutique. Connecte-toi : la remise s'applique seule au paiement. Pas encore mécène ?{" "}
            <Link href="/nous-soutenir" className={LIEN}>
              Voir les paliers
            </Link>
            .
          </span>
        </p>
      </aside>
    );
  }

  const discount = await getPatronDiscount(userId);
  if (!discount.active) {
    return (
      <aside aria-live="polite" className="rounded-2xl border-2 border-rg-or/40 bg-rg-marine p-4 text-white">
        <p className="flex items-start gap-3 text-sm">
          <PatreonIcon className="mt-0.5 size-5 shrink-0 text-rg-or" aria-hidden />
          <span>
            Aucun abonnement Patreon actif n'est lié à ton compte. Les mécènes ont{" "}
            <strong className="font-extrabold text-rg-or">-{PATRON_DISCOUNT_PERCENT}% sur la boutique</strong> :{" "}
            <Link href="/nous-soutenir" className={LIEN}>
              voir les paliers
            </Link>
            .
          </span>
        </p>
      </aside>
    );
  }

  const tier = texteSansDecor(discount.tierTitles[0] ?? "") || "Mécène";
  return (
    <aside aria-live="polite" className="rounded-2xl border-2 border-rg-or bg-rg-marine p-4 text-white">
      <p className="flex items-center gap-3 text-sm">
        <PatreonIcon className="size-5 shrink-0 text-rg-or" aria-hidden />
        <span>
          <strong className="font-extrabold text-rg-or">{tier}</strong> : ta remise de{" "}
          <strong className="font-extrabold text-white">-{discount.percent}%</strong> sera appliquée au paiement. Merci
          pour ton soutien.
        </span>
      </p>
    </aside>
  );
}
