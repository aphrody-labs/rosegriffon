import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://rosegriffon.fr";
  const currentDate = new Date();

  return [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/projets/nostalgie`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/association`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/apropos`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/evenements`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: currentDate,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/llm.txt`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.1,
    },
  ];
}
