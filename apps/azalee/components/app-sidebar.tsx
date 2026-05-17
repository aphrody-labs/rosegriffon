"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useLanguage } from "@/components/providers/language-provider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { dashboardItems, type NavItem, navigationItems } from "@/config/navigation";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { iconMap } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "./providers/AuthProvider";
import { CommonSpriteIcon } from "./ui/CommonSpriteIcon";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { isAdmin } = useAuth();
  const { state: _state } = useSidebar();
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const currentNavItems = isDashboard ? dashboardItems : navigationItems;
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const filteredNavItems = currentNavItems.filter((item) => {
    if (item.adminOnly) return isAdmin;
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="border-none bg-surface" variant="sidebar" {...props}>
      <div className="absolute inset-0 bg-surface -z-10" />

      {/* NAVIGATION CONTENT */}
      <SidebarContent className="py-4 bg-surface">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mounted &&
                filteredNavItems.map((item) => (
                  <NavItemWithAnimation key={item.path} item={item} pathname={pathname} />
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

function NavItemWithAnimation({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <div className="w-full">
      <RecursiveNavItem item={item} pathname={pathname} />
    </div>
  );
}

function NavIcon({
  item,
  isActive,
  isCollapsed,
  depth,
}: {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  depth: number;
}) {
  const { t } = useLanguage();
  const LucideIcon = iconMap[item.icon];

  if (item.imageUrl) {
    return (
      <div className="relative size-full">
        <Image
          src={item.imageUrl}
          alt={t(item.label)}
          fill
          className={cn(
            "object-contain",
            isActive
              ? "opacity-100"
              : "opacity-70 grayscale group-hover:grayscale-0 group-hover:opacity-100",
          )}
        />
      </div>
    );
  }

  if (item.commonSprite) {
    return (
      <CommonSpriteIcon
        name={item.commonSprite as SpriteCommonKey}
        scale={isCollapsed && depth === 0 ? 0.35 : 0.3}
        className={cn(
          isActive
            ? "opacity-100"
            : "opacity-70 grayscale group-hover:grayscale-0 group-hover:opacity-100",
        )}
      />
    );
  }

  if (LucideIcon) {
    return (
      <LucideIcon
        size={isCollapsed && depth === 0 ? 24 : 20}
        fill={isActive ? "currentColor" : "none"}
        aria-hidden="true"
      />
    );
  }

  return null;
}

function RecursiveNavItem({
  item,
  pathname,
  depth = 0,
}: {
  item: NavItem;
  pathname: string;
  depth?: number;
}) {
  const { t } = useLanguage();
  const isActive =
    pathname === item.path || item.children?.some((child) => pathname.startsWith(child.path));
  const [isOpen, setIsOpen] = React.useState(isActive || !!item.defaultOpen);
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  const buttonClass = cn(
    "relative overflow-hidden w-full transition-all duration-200 group",
    "rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-hidden",
    isCollapsed && depth === 0
      ? "h-[56px] flex-col justify-center px-1 gap-1"
      : "h-11 px-4 gap-3 justify-start",
    isActive
      ? "bg-secondary-container text-on-secondary-container font-bold"
      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest",
  );

  const iconClass = cn(
    "flex items-center justify-center transition-transform duration-200",
    isCollapsed && depth === 0 ? "size-6" : "size-5",
    isActive && !item.imageUrl && !item.commonSprite && "scale-110",
    "group-hover:scale-110",
  );

  const itemContent = (
    <>
      <div className={iconClass}>
        <NavIcon item={item} isActive={!!isActive} isCollapsed={isCollapsed} depth={depth} />
      </div>

      {(!isCollapsed || depth > 0) && (
        <span
          className={cn(
            "whitespace-nowrap transition-all duration-300 font-medium truncate flex-1 text-sm",
            isActive ? "font-bold" : "",
          )}
        >
          {t(item.label)}
        </span>
      )}

      {item.children && (!isCollapsed || depth > 0) && (
        <ChevronRight
          size={18}
          className={cn(
            "ml-auto text-on-surface-variant/50 transition-transform duration-200",
            isOpen ? "rotate-90" : "",
          )}
          aria-hidden="true"
        />
      )}
    </>
  );

  if (item.children && !isCollapsed) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <SidebarMenuItem>
          <div className="flex items-center w-full">
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={t(item.label)}
              className={cn(buttonClass, "flex-1 min-w-0 !pr-0")}
            >
              <Link href={item.path}>
                <div className={iconClass}>
                  <NavIcon
                    item={item}
                    isActive={!!isActive}
                    isCollapsed={isCollapsed}
                    depth={depth}
                  />
                </div>
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-300 font-medium truncate flex-1 text-sm",
                    isActive ? "font-bold" : "",
                  )}
                >
                  {t(item.label)}
                </span>
              </Link>
            </SidebarMenuButton>
            <CollapsibleTrigger asChild>
              <button className="size-9 flex items-center justify-center rounded-lg text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors shrink-0">
                <ChevronRight
                  size={18}
                  className={cn("transition-transform duration-200", isOpen ? "rotate-90" : "")}
                  aria-hidden="true"
                />
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <SidebarMenu className="mt-1 ml-4 border-l-2 border-outline-variant/20 pl-2 space-y-1">
              {item.children.map((child) => (
                <RecursiveNavItem
                  key={child.path}
                  item={child}
                  pathname={pathname}
                  depth={depth + 1}
                />
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={t(item.label)}
        className={buttonClass}
      >
        <Link href={item.path}>{itemContent}</Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
