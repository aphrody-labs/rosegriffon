"use client";

import { tournamentStateLabel } from "@rosegriffon/achillea-core";
import type { TournamentListItem, TournamentState } from "@rosegriffon/achillea-types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/components/providers/language-provider";

/** Phrase de l'encart vide de l'accueil quand des tournois terminés existent. */
export function RecentTournamentsNote() {
  const { t } = useLanguage();
  return <p>{t("achillea.home.recent.note")}</p>;
}

/** Derniers tournois terminés, données de `GET /tournaments?states=Finished`. */
export function RecentTournamentsList({ tournaments }: { tournaments: readonly TournamentListItem[] }) {
  const { t } = useLanguage();
  return (
    <ul className="achillea-home__other-events" aria-label={t("achillea.home.recent.label")}>
      {tournaments.map(tournament => (
        <li key={tournament.id}>
          <Link href={`/achillea/tournaments/${tournament.id}`}>
            <span>{tournament.name}</span>
            <small>{tournamentStateLabel((tournament.status ?? "Finished") as TournamentState)}</small>
            <ArrowRight aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
