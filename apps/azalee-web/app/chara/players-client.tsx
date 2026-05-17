"use client";

import { ArrowLeftRight, Eye, EyeOff, Gamepad2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/components/providers/language-provider";
import { FadeInItem } from "@/components/ui/fade-in";
import { BaseCharacterTable } from "@/components/wiki/BaseCharacterTable";
import { CharacterFilters } from "@/components/wiki/filters/CharacterFilters";
import type { TeamOption } from "@/components/wiki/filters/TeamFilter";
import { WikiPagination } from "@/components/wiki/WikiPagination";
import { WikiSearchToolbar } from "@/components/wiki/WikiSearchToolbar";
import { FilterTransitionContext, useFilterTransition } from "@/lib/hooks/use-filter-navigation";
import { cn } from "@/lib/utils";

interface PlayersClientProps {
  paginatedCharacters: any[];
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  allVariantsCount: number;
  teams?: TeamOption[];
  showIncomplete?: boolean;
  showControllable?: boolean;
}

export function PlayersClient({
  paginatedCharacters,
  totalItems,
  itemsPerPage,
  currentPage,
  teams,
  showIncomplete = false,
  showControllable = false,
}: PlayersClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterTransition = useFilterTransition();
  const isPending = filterTransition.isPending;
  const startIndex = (currentPage - 1) * itemsPerPage;

  const toggleIncomplete = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (showIncomplete) {
      params.delete("status");
    } else {
      params.set("status", "all");
    }
    params.delete("page");
    filterTransition.startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  };

  const toggleControllable = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (showControllable) {
      params.delete("status");
    } else {
      params.set("status", "jouable");
    }
    params.delete("page");
    filterTransition.startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <FilterTransitionContext.Provider value={filterTransition}>
      <div className="space-y-6">
        <div className="space-y-4">
          <WikiSearchToolbar
            placeholder={t("wiki.players.search_placeholder")}
            filterKeys={["element", "position", "rarity", "gender", "playstyle", "series", "team", "role"]}
            showFilters={false}
          />
          <CharacterFilters teams={teams} />
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs font-medium text-on-surface-variant px-1">
          <span className="tabular-nums uppercase tracking-wider">
            {isPending ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
            {totalItems.toLocaleString("fr-FR")} personnage{totalItems !== 1 ? "s" : ""}
          </span>
          <button
            onClick={toggleIncomplete}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] md:text-xs font-medium normal-case tracking-normal transition-all duration-200",
              showIncomplete
                ? "bg-tertiary-container text-on-tertiary-container"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest",
              isPending && "opacity-50 pointer-events-none",
            )}
          >
            {showIncomplete ? (
              <Eye size={13} aria-hidden="true" />
            ) : (
              <EyeOff size={13} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {showIncomplete ? "Tous affichés" : "Incomplets masqués"}
            </span>
            <span className="sm:hidden">{showIncomplete ? "Tous" : "Incomplets"}</span>
          </button>
          <button
            onClick={toggleControllable}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] md:text-xs font-medium normal-case tracking-normal transition-all duration-200",
              showControllable
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest",
              isPending && "opacity-50 pointer-events-none",
            )}
          >
            <Gamepad2 size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Jouables</span>
          </button>
          <Link
            href="/tools/compare"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-all normal-case tracking-normal ml-auto"
          >
            <ArrowLeftRight size={13} aria-hidden="true" />
            <span className="text-[11px] md:text-xs font-bold">Comparer</span>
          </Link>
        </div>

        {/* Content area with loading overlay */}
        <div className="relative">
          {isPending && (
            <div className="absolute inset-0 z-10 flex items-start justify-center pt-32 bg-surface/60 backdrop-blur-[1px] rounded-2xl transition-opacity duration-150 animate-in fade-in">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-high shadow-level-2">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-xs font-medium text-on-surface-variant">Chargement...</span>
              </div>
            </div>
          )}

          {paginatedCharacters.length > 0 ? (
            <div className={cn("transition-opacity duration-200", isPending && "opacity-40")}>
              <FadeInItem>
                <BaseCharacterTable characters={paginatedCharacters} startIndex={startIndex} />
              </FadeInItem>

              <WikiPagination
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                perPageOptions={[50, 200]}
              />
            </div>
          ) : (
            <div className="py-20 text-center rounded-[32px] border border-outline-variant bg-surface-container-low border-dashed">
              <p className="text-on-surface-variant italic">{t("wiki.players.no_results")}</p>
            </div>
          )}
        </div>
      </div>
    </FilterTransitionContext.Provider>
  );
}
