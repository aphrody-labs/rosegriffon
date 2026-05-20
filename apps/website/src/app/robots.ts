export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://rosegriffon.fr";
  return {
    rules: [
      {
        allow: "/",
        disallow: ["/api/", "/admin/", "/_next/", "/dashboard/"],
        userAgent: "*",
      },
      {
        allow: "/",
        disallow: ["/api/", "/admin/", "/_next/", "/dashboard/"],
        userAgent: "Googlebot",
      },
      {
        allow: "/",
        disallow: ["/admin/", "/dashboard/"],
        userAgent: "Googlebot-Image",
      },
      {
        allow: "/",
        disallow: ["/admin/", "/_next/", "/dashboard/"],
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "Google-Extended",
          "CCBot",
          "Claude-Web",
          "FacebookBot",
          "OAI-SearchBot",
          "anthropic-ai",
          "cohere-ai",
          "Bytespider",
          "ImagesiftBot",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
