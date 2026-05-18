import { Backpack, BadgeCheck, ScanSearch, Swords, User, Users, Zap } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { AdminPageHeader as DashboardPageHeader } from "@rg/ui";
import { ElementChartLoader } from "./ElementChartLoader";
import { Card, CardContent, CardTitle } from "@rg/ui";
import { apiClient } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/server";

export default async function DatabasePage() {
  const supabase = await createClient();

  // Fetch real counts concurrently
  const [characters, skills, teams, items, keshinsCount] = await Promise.all([
    apiClient.inagle.getAllCharacters(),
    apiClient.inagle.getSkills(),
    apiClient.inagle.getTeams(),
    apiClient.inagle.getItems(),
    supabase
      .from("inagle_keshins_clean")
      .select("*", { count: "exact", head: true })
      .not("asset_code", "ilike", "wa%")
      .not("asset_code", "ilike", "wkt%")
      .then((res: any) => res.count || 0),
  ]);

  // Fetch Element Stats directly from DB for speed
  const { data: charElements } = await supabase
    .from("inagle_characters")
    .select("element");

  const elementCounts: Record<string, number> = {};
  (charElements || []).forEach((c: any) => {
    const el = c.element || "Inconnu";
    elementCounts[el] = (elementCounts[el] || 0) + 1;
  });

  const elementStats = Object.entries(elementCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const entities: Array<{
    name: string;
    count: number;
    icon: React.ComponentType<{
      size?: number;
      className?: string;
      fill?: string;
      "aria-hidden"?: boolean;
    }>;
    color: string;
    textColor: string;
    href: string;
  }> = [
    {
      name: "Joueurs",
      count: characters.length,
      icon: User,
      color: "bg-primary",
      textColor: "text-on-primary",
      href: "/dashboard/database/inagle_characters",
    },
    {
      name: "Techniques",
      count: skills.length,
      icon: Zap,
      color: "bg-secondary",
      textColor: "text-on-secondary",
      href: "/dashboard/database/inagle_skills",
    },
    {
      name: "Équipes",
      count: teams.length,
      icon: Users,
      color: "bg-tertiary",
      textColor: "text-on-tertiary",
      href: "/dashboard/database/inagle_teams",
    },
    {
      name: "Objets",
      count: items.length,
      icon: Backpack,
      color: "bg-emerald-500",
      textColor: "text-white",
      href: "/dashboard/database/inagle_items",
    },
    {
      name: "Keshins",
      count: keshinsCount,
      icon: Swords,
      color: "bg-amber-500",
      textColor: "text-white",
      href: "/dashboard/database/inagle_keshins_clean",
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 pb-24 sm:pb-8">
      <DashboardPageHeader
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Base de données" },
        ]}
        title="Base de données"
        subtitle="Accès brut aux tables Wiki"
        icon="database"
        actions={
          <div className="flex gap-2">
            <Link
              href="/dashboard/database/images"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest text-sm font-bold transition-all"
            >
              <ScanSearch size={16} aria-hidden="true" />
              Validation images
            </Link>
            <Link
              href="/dashboard/database/verification"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest text-sm font-bold transition-all"
            >
              <BadgeCheck size={16} aria-hidden="true" />
              Verification
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        {entities.map((entity, i) => (
          <Link key={i} href={entity.href}>
            <Card className="h-full rounded-[24px] sm:rounded-[32px] border-none shadow-sm hover:shadow-xl transition-all duration-500 bg-surface-container-low overflow-hidden group hover:-translate-y-1">
              <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center gap-3 sm:gap-4 h-full justify-center">
                <div
                  className={`size-12 sm:size-16 rounded-[20px] sm:rounded-[24px] ${entity.color} ${entity.textColor} flex items-center justify-center shadow-md transition-transform group-hover:scale-105 duration-500`}
                >
                  <entity.icon size={28} fill="currentColor" aria-hidden={true} />
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  <CardTitle className="font-black font-sans text-sm sm:text-lg uppercase tracking-tighter">
                    {entity.name}
                  </CardTitle>
                  {entity.count > 0 && (
                    <div className="text-xl sm:text-2xl font-black text-on-surface tracking-tighter">
                      {entity.count.toLocaleString()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <ElementChartLoader data={elementStats} />
      </div>
    </div>
  );
}
