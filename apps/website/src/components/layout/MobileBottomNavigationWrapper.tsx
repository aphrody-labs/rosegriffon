"use client";

import { useIsMobile } from "@rose-griffon/ui";

import { MobileBottomNavigation } from "./MobileBottomNavigation";

export function MobileBottomNavigationWrapper() {
  const isMobile = useIsMobile();

  if (!isMobile) {return null;}

  return <MobileBottomNavigation />;
}
