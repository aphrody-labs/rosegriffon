import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://rosegriffon.fr";
  const currentDate = new Date();

  return [
    {
      changeFrequency: "weekly",
      lastModified: currentDate,
      priority: 1,
      url: baseUrl,
    },
    {
      changeFrequency: "monthly",
      lastModified: currentDate,
      priority: 0.9,
      url: `${baseUrl}/projets/nostalgie`,
    },
    {
      changeFrequency: "monthly",
      lastModified: currentDate,
      priority: 0.8,
      url: `${baseUrl}/association`,
    },
    {
      changeFrequency: "monthly",
      lastModified: currentDate,
      priority: 0.7,
      url: `${baseUrl}/apropos`,
    },
    {
      changeFrequency: "weekly",
      lastModified: currentDate,
      priority: 0.8,
      url: `${baseUrl}/evenements`,
    },
    {
      changeFrequency: "yearly",
      lastModified: currentDate,
      priority: 0.5,
      url: `${baseUrl}/contact`,
    },
    {
      changeFrequency: "weekly",
      lastModified: currentDate,
      priority: 0.1,
      url: `${baseUrl}/llm.txt`,
    },
  ];
}
