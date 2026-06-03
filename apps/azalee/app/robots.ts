import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = "https://azalee.rosegriffon.fr";

	return {
		rules: [
			{
				// /api/llm/* = contexte IA (CLAUDE.md/GEMINI.md/Grok) : autorisé (allow plus spécifique que disallow /api/).
				allow: ["/", "/api/llm/"],
				disallow: ["/dashboard/", "/api/", "/auth/", "/login", "/settings"],
				userAgent: "*",
			},
			{
				// Crawlers IA explicitement autorisés (condition pour l'ingestion LLM)
				allow: ["/", "/api/llm/"],
				disallow: ["/dashboard/", "/api/", "/auth/", "/login", "/settings"],
				userAgent: [
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
