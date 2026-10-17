import Link from "next/link";

import { comptesDuFiltre, GROUPES, MARQUES, parametresDuFiltre, RESEAUX, TOUS_LES_COMPTES } from "@/lib/feed/comptes";
import type { FiltreFil } from "@/lib/feed/comptes";

import { BadgeReseau } from "./marque";

const PUCE =
  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none";
const INACTIVE = "border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high";
const ACTIVE = "border-primary bg-primary text-on-primary";

function lien(filtre: FiltreFil): string {
  const p = parametresDuFiltre(filtre);
  return p ? `/feed?${p}` : "/feed";
}

function Puce({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={actif ? "page" : undefined} className={`${PUCE} ${actif ? ACTIVE : INACTIVE}`}>
      {children}
    </Link>
  );
}

/**
 * Filtres par réseau, par groupe et par compte : de simples liens (rendus côté serveur, utilisables
 * sans JavaScript, partageables). Changer de réseau ou de groupe retire le compte choisi.
 */
export function Filtres({ filtre }: { filtre: FiltreFil }) {
  const comptes = comptesDuFiltre({ reseau: filtre.reseau, groupe: filtre.groupe });
  return (
    <div className="space-y-2">
      <nav aria-label="Réseaux" className="flex flex-wrap gap-2">
        <Puce href={lien({ groupe: filtre.groupe })} actif={!filtre.reseau}>
          Tous les réseaux
        </Puce>
        {RESEAUX.map(r => (
          <Puce key={r} href={lien({ reseau: r, groupe: filtre.groupe })} actif={filtre.reseau === r}>
            <BadgeReseau reseau={r} taille={18} />
            {MARQUES[r].nom}
          </Puce>
        ))}
      </nav>
      <nav aria-label="Groupes" className="flex flex-wrap gap-2">
        <Puce href={lien({ reseau: filtre.reseau })} actif={!filtre.groupe}>
          Tous les groupes
        </Puce>
        {GROUPES.map(g => (
          <Puce key={g} href={lien({ reseau: filtre.reseau, groupe: g })} actif={filtre.groupe === g}>
            {g}
          </Puce>
        ))}
      </nav>
      <details className="group rounded-2xl border border-outline-variant bg-surface-container-low" open={!!filtre.compte}>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 text-sm font-medium text-on-surface">
          <span>Comptes ({comptes.length || TOUS_LES_COMPTES.length})</span>
          {filtre.compte && (
            <Link
              href={lien({ reseau: filtre.reseau, groupe: filtre.groupe })}
              className="flex min-h-11 items-center text-primary hover:underline"
            >
              Voir tous les comptes
            </Link>
          )}
        </summary>
        <ul className="flex flex-wrap gap-2 px-3 pb-3">
          {comptes.map(c => (
            <li key={`${c.reseau}:${c.pseudo}`}>
              <Puce
                href={lien({ compte: c.pseudo, reseau: c.reseau })}
                actif={filtre.compte?.toLowerCase() === c.pseudo.toLowerCase() && filtre.reseau === c.reseau}
              >
                <BadgeReseau reseau={c.reseau} taille={18} />
                {c.nom}
              </Puce>
            </li>
          ))}
          {comptes.length === 0 && <li className="p-2 text-sm text-on-surface-variant">Aucun compte pour ce filtre.</li>}
        </ul>
      </details>
    </div>
  );
}
