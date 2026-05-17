export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { SkillFilterBar } from "@/components/wiki/filters/SkillFilterBar";
import { MoveCard } from "@/components/wiki/MoveCard";
import { WikiPagination } from "@/components/wiki/WikiPagination";
import { WikiSearchToolbar } from "@/components/wiki/WikiSearchToolbar";
import { getSkillCategoryIconUrl } from "@/lib/images";
import { parseSearchParams } from "@/lib/validations";
import { wikiService } from "@/lib/wiki-service";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const rawParams = await searchParams;
  const { q, type: category, element, page } = parseSearchParams(rawParams);

  let title = "Techniques Spéciales";
  const filters: string[] = [];

  if (category) {
    const catLabel = CATEGORY_FILTERS.find((c) => c.value === category)?.label;
    if (catLabel) filters.push(catLabel);
  }
  if (element) {
    const elemLabel = ELEMENT_FILTERS.find(
      (e) => e.value.toLowerCase() === element.toString().toLowerCase(),
    )?.label;
    if (elemLabel) filters.push(elemLabel);
  }
  if (q) filters.push(`"${q}"`);

  if (filters.length > 0) {
    title += ` : ${filters.join(" ")}`;
  }

  const pageNum = page ? parseInt(page.toString(), 10) : 1;
  if (pageNum > 1) title += ` (Page ${pageNum})`;

  return {
    title: `${title} | Inazuma Eleven Victory Road - Azalée`,
    description: `Base de données des techniques spéciales (Hissatsu)${filters.length > 0 ? ` filtrée par ${filters.join(", ")}` : ""}. Puissance, tension et effets.`,
    alternates: {
      canonical: `/skill${rawParams ? `?${new URLSearchParams(rawParams as Record<string, string>).toString()}` : ""}`,
    },
  };
}

const ITEMS_PER_PAGE = 60;

const CATEGORY_FILTERS: Array<{ value: string; label: string; imageIcon?: string }> = [
  { value: "", label: "Tout" },
  { value: "shoot", label: "Tir", imageIcon: getSkillCategoryIconUrl("tir") },
  { value: "block", label: "Défense", imageIcon: getSkillCategoryIconUrl("defense") },
  { value: "dribble", label: "Dribble", imageIcon: getSkillCategoryIconUrl("dribble") },
  { value: "catch", label: "Arrêt", imageIcon: getSkillCategoryIconUrl("gardien") },
];

const ELEMENT_FILTERS = [
  { value: "", label: "Tous", icon: "blur_on" },
  { value: "Fire", label: "Feu", commonSprite: "fire" as const },
  { value: "Wind", label: "Vent", commonSprite: "wind" as const },
  { value: "Forest", label: "Forêt", commonSprite: "forest" as const },
  { value: "Mountain", label: "Montagne", commonSprite: "mountain" as const },
  { value: "Void", label: "Néant", icon: "blur_on" },
];

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const rawParams = await searchParams;
  const params = parseSearchParams(rawParams);
  const {
    q,
    page,
    type: category,
    element,
    has_video,
    show_aura,
    overdrive,
    sort,
    power_min,
    power_max,
  } = params;

  const pageNumber = page ? parseInt(page.toString(), 10) : 1;

  // Data First: Fetch paginated from DB
  const { data: skills, total } = await wikiService.getSkillsList({
    q: q?.toString(),
    category: category?.toString(),
    element: element?.toString(),
    has_video: has_video?.toString(),
    show_aura: show_aura?.toString(),
    overdrive: overdrive?.toString(),
    sort: sort?.toString(),
    power_min: power_min?.toString(),
    power_max: power_max?.toString(),
    page: pageNumber,
    limit: ITEMS_PER_PAGE,
  });

  // Re-map for UI
  const categoryCounts = CATEGORY_FILTERS.map((f) => ({ ...f, count: 0 })); // Counts disabled for perf
  const elementCounts = ELEMENT_FILTERS.map((f) => ({ ...f, count: 0 }));

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Techniques Spéciales - Inazuma Eleven: Victory Road",
    description: `${total.toLocaleString("fr-FR")} techniques spéciales (Hissatsu) avec puissance, tension et vidéos.`,
    url: "https://azalee.rosegriffon.fr/skill",
    isPartOf: { "@type": "WebSite", name: "Azalée", url: "https://azalee.rosegriffon.fr" },
    numberOfItems: total,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: skills.slice(0, 10).map((s: any, i: number) => ({
        "@type": "ListItem",
        position: (pageNumber - 1) * ITEMS_PER_PAGE + i + 1,
        url: `https://azalee.rosegriffon.fr/skill/${s.skillId}`,
        name: s.name_FR || s.name_EN || "Technique",
      })),
    },
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <div className="space-y-4">
        <WikiSearchToolbar placeholder="Rechercher une technique..." showFilters={false} />
        <SkillFilterBar
          currentCategory={category || ""}
          currentElement={element || ""}
          currentHasVideo={has_video || ""}
          currentShowAura={show_aura || ""}
          currentOverdrive={overdrive || ""}
          currentSort={sort || ""}
          currentPowerMin={power_min || ""}
          currentPowerMax={power_max || ""}
          categories={categoryCounts}
          elements={elementCounts}
        />
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant px-1 uppercase tracking-wider">
        <span>{total.toLocaleString("fr-FR")} techniques</span>
        <span>
          Page {pageNumber} sur {Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))}
        </span>
      </div>

      {skills.length > 0 ? (
        <FadeInStagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {skills.map((skill: any) => (
            <FadeInItem key={skill.skillId} className="h-full">
              <MoveCard
                id={skill.skillId}
                name={skill.name_FR || skill.name_EN || "Inconnu"}
                category={skill.categoryName?.fr || "Spécial"}
                powerMin={skill.power_min}
                powerMax={skill.power_max}
                tensionCost={skill.consumeTp}
                element={skill.elementName?.fr}
                videoUrl={skill.videoUrl || undefined}
                posterUrl={skill.posterUrl || undefined}
                imageUrl={skill.image}
                shop={skill.shop || undefined}
                className="h-full"
              />
            </FadeInItem>
          ))}
        </FadeInStagger>
      ) : (
        <div className="py-20 text-center rounded-[32px] border border-outline-variant bg-surface-container-low border-dashed">
          <p className="text-on-surface-variant italic">Aucune technique trouvée.</p>
        </div>
      )}

      <WikiPagination totalItems={total} itemsPerPage={ITEMS_PER_PAGE} currentPage={pageNumber} />
    </div>
  );
}
