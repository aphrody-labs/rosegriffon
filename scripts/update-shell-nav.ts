import { readFileSync, writeFileSync } from "node:fs";

// 1. Update routes.ts
let routesSrc = readFileSync("packages/rg-app-shell/src/config/routes.ts", "utf8");
if (!routesSrc.includes('"/play"')) {
  routesSrc = routesSrc.replace(
    'export const CHEMINS_RACINE = ["/news", "/settings", "/search", "/login"] as const;',
    'export const CHEMINS_RACINE = ["/news", "/settings", "/search", "/login", "/play"] as const;'
  );
  writeFileSync("packages/rg-app-shell/src/config/routes.ts", routesSrc);
  console.log("Updated routes.ts with /play");
}

// 2. Update navigation.ts
let navSrc = readFileSync("packages/rg-app-shell/src/config/navigation.ts", "utf8");
if (!navSrc.includes('path: "/play"')) {
  navSrc = navSrc.replace(
    '{ icon: "home", label: "nav.home", path: w("/") },',
    '{ icon: "home", label: "nav.home", path: w("/") },\n    { commonSprite: "justice", icon: "sports_esports", label: "nav.play", path: "/play" },'
  );
  writeFileSync("packages/rg-app-shell/src/config/navigation.ts", navSrc);
  console.log("Updated navigation.ts with /play");
}
