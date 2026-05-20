"use client";

import { useIsMobile } from "@rosegriffon/ui";

import { MobileBottomNavigation } from "./MobileBottomNavigation";

export function MobileBottomNavigationWrapper() {
  const isMobile = useIsMobile();

  if (!isMobile) {return null;}

  return <MobileBottomNavigation />;
}
