export default function robots() {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://rosegriffon.fr";
	return {
		rules: [
			{
				// /api/llm/* = contexte IA (CLAUDE.md/GEMINI.md/Grok) : explicitement autorisé (allow plus spécifique que disallow /api/).
				allow: ["/", "/api/llm/"],
				disallow: ["/api/", "/admin/", "/_next/", "/dashboard/"],
				userAgent: "*",
			},
			{
				allow: ["/", "/api/llm/"],
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
					// Crawlers IA explicitement autorisés (condition pour l'ingestion LLM)
					"GPTBot",
					"ChatGPT-User",
					"OAI-SearchBot",
					"ClaudeBot",
					"Claude-Web",
					"anthropic-ai",
					"Anthropic-AI",
					"Google-Extended",
					"PerplexityBot",
					"Perplexity-User",
					"CCBot",
					"Bytespider",
					"Amazonbot",
					"Applebot",
					"Applebot-Extended",
					"cohere-ai",
					"FacebookBot",
					"Meta-ExternalAgent",
					"ImagesiftBot",
				],
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
