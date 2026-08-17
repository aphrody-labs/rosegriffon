export default function robots() {
	// Host canonique (apex, sans www) — cohérent avec le `metadataBase` du layout et
	// la redirection 301 www → apex de next.config. Évite que la directive Sitemap
	// pointe vers une URL redirigée.
	const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://rosegriffon.fr").replace(
		"://www.",
		"://",
	);
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
				// Mediapartners-Google = robot d'AdSense. Il lit le contenu de la page
				// pour choisir les annonces ; sans autorisation explicite il ne reste que
				// du remplissage générique, et le revenu s'effondre sans message d'erreur.
				allow: "/",
				disallow: ["/api/", "/admin/", "/_next/", "/dashboard/"],
				userAgent: "Mediapartners-Google",
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
