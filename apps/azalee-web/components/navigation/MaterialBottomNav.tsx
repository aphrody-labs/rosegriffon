"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/providers/language-provider";
import { mobileNavItems } from "@/config/navigation";
import { haptic } from "@/lib/haptics";
import { iconMap } from "@/lib/icons";
import { cn } from "@/lib/utils";

function NavItem({
  label,
  path,
  icon,
  isActive,
}: {
  label: string;
  path: string;
  icon: string;
  isActive: boolean;
}) {
  const { t } = useLanguage();
  const LucideIcon = iconMap[icon];
  return (
    <Link
      href={path}
      aria-current={isActive ? "page" : undefined}
      onClick={(e) => {
        if (isActive) {
          e.preventDefault();
          window.scrollTo({ behavior: "smooth", top: 0 });
          haptic("light");
        } else {
          haptic("light");
        }
      }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1",
        "flex-1 h-full min-w-0",
        "cursor-pointer select-none",
      )}
    >
      {/* Active pill */}
      <div
        className={cn(
          "absolute inset-0 m-auto w-16 h-8 rounded-full bg-secondary-container",
          "transition-all duration-300 motion-emphasized-decelerate",
          isActive ? "opacity-100 scale-100" : "opacity-0 scale-50",
        )}
      />

      {/* Icon */}
      {LucideIcon && (
        <LucideIcon
          size={24}
          className={cn(
            "relative z-10 transition-colors duration-200",
            isActive ? "text-on-secondary-container" : "text-on-surface-variant",
          )}
          fill={isActive ? "currentColor" : "none"}
          aria-hidden="true"
        />
      )}

      {/* Label */}
      <span
        className={cn(
          "relative z-10 type-label-medium text-center whitespace-nowrap transition-colors duration-200",
          isActive ? "text-on-surface" : "text-on-surface-variant",
        )}
      >
        {t(label)}
      </span>
    </Link>
  );
}

function FABAction({ label, path, icon }: { label: string; path: string; icon: string }) {
  const { t } = useLanguage();
  const LucideIcon = iconMap[icon];
  return (
    <Link
      href={path}
      className={cn(
        "relative flex items-center justify-center",
        "-mt-5 size-14 rounded-full",
        "bg-primary text-on-primary",
        "shadow-lg",
        "transition-all duration-200 motion-standard",
        "hover:shadow-xl hover:scale-105",
        "active:scale-95 active:shadow-md",
        "z-20",
      )}
    >
      {LucideIcon && (
        <LucideIcon size={28} className="relative z-10" fill="currentColor" aria-hidden="true" />
      )}
      <span className="sr-only">{t(label)}</span>
    </Link>
  );
}

export function MaterialBottomNav() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");

  const dashboardMobileItems = [
    { icon: "dashboard", label: "nav.dashboard.overview", path: "/dashboard" },
    {
      icon: "article",
      label: "nav.dashboard.content.news",
      path: "/dashboard/news",
    },
    {
      icon: "add",
      isAction: true,
      label: "nav.dashboard.add",
      path: "/dashboard/news/new",
    },
    { icon: "group", label: "nav.dashboard.users", path: "/dashboard/users" },
    {
      icon: "settings",
      label: "nav.dashboard.settings",
      path: "/dashboard/settings",
    },
  ];

  const items = isDashboard ? dashboardMobileItems : mobileNavItems;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "h-20 pb-safe",
        "bg-surface-container/85 backdrop-blur-xl",
        "border-t border-outline-variant/5",
        "md:hidden",
      )}
    >
      <div className="flex items-center justify-around h-full px-2">
        {items.map((item) => {
          const activePaths = "activePaths" in item ? item.activePaths : undefined;
          const isActive = activePaths
            ? activePaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
            : pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));

          if ("isAction" in item && item.isAction) {
            return (
              <FABAction key={item.path} label={item.label} path={item.path} icon={item.icon} />
            );
          }

          return (
            <NavItem
              key={item.path}
              label={item.label}
              path={item.path}
              icon={item.icon}
              isActive={isActive}
            />
          );
        })}
      </div>
    </nav>
  );
}
