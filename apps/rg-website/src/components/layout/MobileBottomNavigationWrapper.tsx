"use client";

import { useIsMobile } from "@/hooks/use-mobile";

import { MobileBottomNavigation } from "./MobileBottomNavigation";

export function MobileBottomNavigationWrapper() {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return <MobileBottomNavigation />;
}
