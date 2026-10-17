"use client";

/**
 * Banque de personnages : choisir le portrait d'un personnage du jeu comme avatar.
 *
 * Tout vient de la base (`inagle_characters`, via `chercherBanque`) et du CDN qui décode les
 * portraits du jeu. États explicites : chargement, erreur avec reprise, aucun résultat.
 */

import { cdnOrigin } from "@rosegriffon/assets";
import { Button } from "@rosegriffon/ui/button";
import { Input } from "@rosegriffon/ui/input";
import { NativeSelect, NativeSelectOption } from "@rosegriffon/ui/native-select";
import { Skeleton } from "@rosegriffon/ui/skeleton";
import { cn } from "@rosegriffon/ui/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { codeDepuisUrl, urlPortrait } from "@/lib/avatar-jeu/banque";

import { chercherBanque, choisirPortrait, type ResultatBanque } from "../avatar-jeu-actions";

const CDN = cdnOrigin(process.env.NEXT_PUBLIC_CDN_ORIGIN);
const SQUELETTES = Array.from({ length: 12 }, (_, i) => i);

export function BanquePortraits({
  avatarUrl,
  onSaved,
}: {
  avatarUrl: string | null;
  onSaved: () => void;
}) {
  const idRecherche = useId();
  const idSerie = useId();
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [serie, setSerie] = useState("");
  const [page, setPage] = useState(0);
  const [essai, setEssai] = useState(0);
  const [resultat, setResultat] = useState<ResultatBanque | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [choix, setChoix] = useState<{ code: string; nom: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const actuel = codeDepuisUrl(avatarUrl);

  // Recherche différée : une requête par pause de frappe, pas par touche.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(saisie);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    void chercherBanque({ q, serie, page })
      .then(r => {
        if (annule) return;
        if ("error" in r) {
          setErreur(r.error);
        } else {
          setErreur(null);
          setResultat(r);
        }
      })
      .catch(() => {
        if (!annule) setErreur("La banque de personnages est injoignable.");
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [q, serie, page, essai]);

  const valider = async () => {
    if (!choix) return;
    setEnvoi(true);
    const r = await choisirPortrait(choix.code).catch(() => ({ error: "Enregistrement impossible." }));
    setEnvoi(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(`Avatar : ${choix.nom}.`);
    onSaved();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor={idRecherche} className="sr-only">
            Rechercher un personnage par nom
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id={idRecherche}
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Nom du personnage"
            value={saisie}
            onChange={e => setSaisie(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor={idSerie} className="sr-only">
            Filtrer par jeu
          </label>
          <NativeSelect
            id={idSerie}
            value={serie}
            onChange={e => {
              setSerie(e.target.value);
              setPage(0);
            }}
            className="h-11"
            disabled={!resultat}
          >
            <NativeSelectOption value="">Tous les jeux</NativeSelectOption>
            {resultat?.series.map(s => (
              <NativeSelectOption key={s.nom} value={s.nom}>
                {s.nom} ({s.total})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {erreur
          ? ""
          : resultat
            ? `${resultat.total} personnage${resultat.total > 1 ? "s" : ""} — page ${resultat.page + 1} sur ${resultat.pages}`
            : "Chargement de la banque…"}
      </p>

      {erreur ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p>{erreur}</p>
          <Button variant="outline" className="h-11" onClick={() => setEssai(n => n + 1)}>
            Réessayer
          </Button>
        </div>
      ) : !resultat && chargement ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden>
          {SQUELETTES.map(i => (
            <li key={i}>
              <Skeleton className="aspect-square w-full rounded-lg" />
            </li>
          ))}
        </ul>
      ) : resultat && resultat.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucun personnage ne correspond à cette recherche.
        </p>
      ) : (
        <ul
          className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", chargement && "opacity-60 transition-opacity")}
          aria-busy={chargement}
        >
          {resultat?.items.map(p => {
            const selectionne = choix?.code === p.code;
            return (
              <li key={p.code}>
                <button
                  type="button"
                  aria-pressed={selectionne}
                  onClick={() => setChoix({ code: p.code, nom: p.nom })}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-center gap-1 rounded-lg border bg-card p-1.5 text-center transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden",
                    selectionne ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/50",
                  )}
                >
                  {/* Portrait du jeu décodé à la demande par le CDN. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlPortrait(CDN, p.code, 160)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={160}
                    height={160}
                    className="aspect-square w-full rounded-md bg-muted object-cover"
                  />
                  <span className="line-clamp-2 min-h-8 w-full text-xs leading-4 break-words text-foreground">
                    {p.nom}
                  </span>
                  {p.code === actuel && <span className="text-[0.7rem] font-medium text-primary">Actuel</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {resultat && resultat.pages > 1 && (
        <nav className="flex items-center justify-between gap-2" aria-label="Pages de la banque">
          <Button variant="outline" className="h-11 min-w-11" disabled={chargement || resultat.page === 0} onClick={() => setPage(resultat.page - 1)}>
            <ChevronLeft aria-hidden />
            <span className="sr-only sm:not-sr-only">Précédent</span>
          </Button>
          <span className="text-sm text-muted-foreground">
            {resultat.page + 1} / {resultat.pages}
          </span>
          <Button variant="outline" className="h-11 min-w-11" disabled={chargement || resultat.page >= resultat.pages - 1} onClick={() => setPage(resultat.page + 1)}>
            <span className="sr-only sm:not-sr-only">Suivant</span>
            <ChevronRight aria-hidden />
          </Button>
        </nav>
      )}

      <div className="sticky bottom-0 -mx-1 bg-background/95 px-1 py-2 backdrop-blur">
        <Button className="h-11 w-full" disabled={!choix || envoi} onClick={valider}>
          {envoi && <Loader2 className="animate-spin" aria-hidden />}
          {choix ? `Utiliser le portrait de ${choix.nom}` : "Choisis un personnage"}
        </Button>
      </div>
    </div>
  );
}
