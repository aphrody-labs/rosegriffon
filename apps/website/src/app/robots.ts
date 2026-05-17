export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://rosegriffon.fr";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/_next/", "/dashboard/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/admin/", "/_next/", "/dashboard/"],
      },
      {
        userAgent: "Googlebot-Image",
        allow: "/",
        disallow: ["/admin/", "/dashboard/"],
      },
      {
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
        allow: "/",
        disallow: ["/admin/", "/_next/", "/dashboard/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
