import { useLanguage } from "@/components/providers/language-provider";
import { getSkillCategoryIconUrl } from "@/lib/images";
import { FilterChips } from "../FilterChips";
import { RarityFilterChips } from "./RarityFilterChips";
import { TeamFilter } from './TeamFilter';
import type { TeamOption } from './TeamFilter';

interface CharacterFiltersProps {
  teams?: TeamOption[];
}

export function CharacterFilters({ teams = [] }: CharacterFiltersProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4 md:space-y-0 md:flex md:flex-wrap md:items-start md:gap-8 pb-4">
      {/* Mobile: horizontal scroll row for icon filters */}
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:contents scrollbar-none">
        {/* Element */}
        <section className="space-y-2 md:space-y-3 shrink-0">
          <h4 className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-wider px-1">
            {t("wiki.filters.element")}
          </h4>
          <FilterChips
            paramName="element"
            className="flex gap-1.5 md:gap-2"
            hideLabel
            options={[
              { commonSprite: "fire", label: t("wiki.elements.fire"), value: "Fire" },
              { commonSprite: "wind", label: t("wiki.elements.wind"), value: "Wind" },
              { commonSprite: "forest", label: t("wiki.elements.forest"), value: "Forest" },
              { commonSprite: "mountain", label: t("wiki.elements.mountain"), value: "Mountain" },
            ]}
          />
        </section>

        {/* Position */}
        <section className="space-y-2 md:space-y-3 shrink-0">
          <h4 className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-wider px-1">
            {t("wiki.filters.position")}
          </h4>
          <FilterChips
            paramName="position"
            className="flex gap-1.5 md:gap-2"
            hideLabel
            options={[
              {
                imageIcon: getSkillCategoryIconUrl("gardien"),
                label: t("wiki.positions.gk"),
                value: "GK",
              },
              {
                imageIcon: getSkillCategoryIconUrl("defense"),
                label: t("wiki.positions.df"),
                value: "DF",
              },
              {
                imageIcon: getSkillCategoryIconUrl("dribble"),
                label: t("wiki.positions.mf"),
                value: "MF",
              },
              {
                imageIcon: getSkillCategoryIconUrl("tir"),
                label: t("wiki.positions.fw"),
                value: "FW",
              },
            ]}
          />
        </section>

        {/* Gender */}
        <section className="space-y-2 md:space-y-3 shrink-0">
          <h4 className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-wider px-1">
            {t("wiki.filters.gender")}
          </h4>
          <FilterChips
            paramName="gender"
            className="flex gap-1.5 md:gap-2"
            hideLabel
            options={[
              { commonSprite: "boy", label: t("wiki.genders.male"), value: "1" },
              { commonSprite: "girl", label: t("wiki.genders.female"), value: "2" },
            ]}
          />
        </section>

        {/* Playstyle */}
        <section className="space-y-2 md:space-y-3 shrink-0">
          <h4 className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-wider px-1">
            {t("wiki.filters.playstyle")}
          </h4>
          <FilterChips
            paramName="playstyle"
            className="flex gap-1.5 md:gap-2"
            hideLabel
            options={[
              { commonSprite: "justice", label: "Justice", value: "Justice" },
              { commonSprite: "lien", label: t("wiki.playstyles.bond"), value: "Bond" },
              { commonSprite: "contre", label: t("wiki.playstyles.counter"), value: "Counter" },
              { commonSprite: "breche", label: t("wiki.playstyles.breach"), value: "Breach" },
              {
                commonSprite: "jeu_violent",
                label: t("wiki.playstyles.rough_play"),
                value: "Rough Play",
              },
              { commonSprite: "tension", label: "Tension", value: "Tension" },
            ]}
          />
        </section>
      </div>

      {/* Rarity — full width row on mobile */}
      <section className="space-y-2 md:space-y-3">
        <h4 className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-wider px-1">
          {t("wiki.filters.rarity")}
        </h4>
        <RarityFilterChips />
      </section>

      {/* Rôle — joueur / coordinateur */}
      <section className="space-y-2 md:space-y-3 shrink-0">
        <h4 className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-wider px-1">
          Rôle
        </h4>
        <FilterChips
          paramName="role"
          className="flex gap-1.5 md:gap-2"
          options={[
            { label: "Coordinateur", value: "Coordinator" },
            { label: "Entraîneur", value: "Coach" },
          ]}
        />
      </section>

      {/* Series — chips row, scrollable on mobile */}
      <section className="space-y-2 md:space-y-3">
        <h4 className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-wider px-1">
          Série
        </h4>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
          <FilterChips
            paramName="series"
            className="flex gap-1.5 md:gap-2 md:flex-wrap"
            options={[
              { label: "Victory Road", value: "Victory Road" },
              { label: "Ares", value: "Ares" },
              { label: "Orion", value: "Orion" },
              { label: "GO", value: "Inazuma Eleven GO" },
              { label: "Chrono Stone", value: "Chrono Stone" },
              { label: "Galaxy", value: "Galaxy" },
              { label: "IE3", value: "Inazuma Eleven 3" },
              { label: "IE2", value: "Inazuma Eleven 2" },
              { label: "IE1", value: "Inazuma Eleven" },
            ]}
          />
        </div>
      </section>

      {/* Team Filter — hidden on mobile */}
      {teams.length > 0 && (
        <section className="hidden md:block space-y-3 min-w-[240px]">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2 px-1">
            {t("wiki.filters.team")}
          </h4>
          <TeamFilter teams={teams} />
        </section>
      )}
    </div>
  );
}
