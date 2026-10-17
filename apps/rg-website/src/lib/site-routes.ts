import type { MetadataRoute } from "next";

// Routes publiques réelles (hors auth/dashboard/admin/profil). Les chemins doivent exister
// — un sitemap qui pointe vers des 404 dégrade le crawl. Priorités/fréquences indicatives.
//
// N'y figurent que des pages indexables qui répondent 200 sans redirection :
// `/search` est `noindex` (cf. `app/search/page.tsx`) et n'a rien à y faire,
// pas plus que `/chroniques` (redirigée vers `/news` par next.config).
export const ROUTES_SITEMAP: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/a-propos", priority: 0.7, changeFrequency: "monthly" },
  { path: "/a-propos/rejoindre-rg", priority: 0.7, changeFrequency: "monthly" },
  { path: "/a-propos/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/projets", priority: 0.8, changeFrequency: "weekly" },
  { path: "/projets/nostalgie", priority: 0.7, changeFrequency: "monthly" },
  { path: "/projets/emotes", priority: 0.6, changeFrequency: "monthly" },
  { path: "/projets/muraux", priority: 0.6, changeFrequency: "monthly" },
  { path: "/projets/outils/pfp", priority: 0.6, changeFrequency: "monthly" },
  { path: "/evenements", priority: 0.8, changeFrequency: "weekly" },
  { path: "/news", priority: 0.9, changeFrequency: "daily" },
  { path: "/community", priority: 0.8, changeFrequency: "weekly" },
  { path: "/shop", priority: 0.7, changeFrequency: "weekly" },
  { path: "/feed", priority: 0.5, changeFrequency: "hourly" },
  { path: "/notre-equipe", priority: 0.8, changeFrequency: "weekly" },
  { path: "/sondages", priority: 0.6, changeFrequency: "weekly" },
  { path: "/iergday", priority: 0.7, changeFrequency: "daily" },
  // Ces quatre pages publiques manquaient : aucune n'était annoncée nulle part.
  { path: "/rose-griffon-tv", priority: 0.7, changeFrequency: "daily" },
  { path: "/emotes-showcase", priority: 0.6, changeFrequency: "monthly" },
  { path: "/epita-map", priority: 0.4, changeFrequency: "yearly" },
  { path: "/design-system", priority: 0.3, changeFrequency: "monthly" },
  { path: "/achillea", priority: 0.8, changeFrequency: "weekly" },
  { path: "/achillea/clans", priority: 0.7, changeFrequency: "daily" },
  { path: "/achillea/casts", priority: 0.6, changeFrequency: "weekly" },
  { path: "/achillea/leagues/astral", priority: 0.7, changeFrequency: "weekly" },
  { path: "/achillea/guide", priority: 0.6, changeFrequency: "monthly" },
  { path: "/achillea/tournaments", priority: 0.8, changeFrequency: "daily" },
  { path: "/achillea/tournaments/circuit/ranking", priority: 0.7, changeFrequency: "daily" },
  { path: "/achillea/ranked", priority: 0.7, changeFrequency: "weekly" },
  { path: "/achillea/ranked/leaderboard", priority: 0.7, changeFrequency: "daily" },
  { path: "/achillea/ranked/tiers", priority: 0.5, changeFrequency: "monthly" },
  { path: "/nous-soutenir", priority: 0.7, changeFrequency: "monthly" },
  { path: "/charte-engagements", priority: 0.4, changeFrequency: "yearly" },
  { path: "/cellule-de-mediation", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/cgu", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/confidentialite", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/mentions-legales", priority: 0.3, changeFrequency: "yearly" },
];
