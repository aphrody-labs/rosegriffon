"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/providers/language-provider";
import { dashboardItems, navigationItems } from "@/config/navigation";
import { iconMap } from "@/lib/icons";
import { NavigationRail, NavigationRailItem } from "@rosegriffon/ui";
import { useAuth } from "@/components/providers/AuthProvider";

export function AzaleeNavigationRail() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const isDashboard = pathname.startsWith("/dashboard");
  const currentNavItems = isDashboard ? dashboardItems : navigationItems;

  const filteredNavItems = currentNavItems.filter((item) => {
    if (item.adminOnly) {return isAdmin;}
    return true;
  });

  return (
    <NavigationRail className="fixed left-0 top-14 bottom-0 z-50 border-r border-outline-variant/10 hidden md:flex lg:hidden">
      {filteredNavItems.map((item) => {
        const LucideIcon = iconMap[item.icon];
        const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));

        return (
          <Link key={item.path} href={item.path} passHref legacyBehavior>
            <NavigationRailItem
              active={isActive}
              icon={LucideIcon ? <LucideIcon size={24} /> : null}
              label={t(item.label)}
            />
          </Link>
        );
      })}
    </NavigationRail>
  );
}
