// API d'accueil pour les LLM/agents — sert, par modèle, un document de contexte au format
// natif de chaque assistant (CLAUDE.md / GEMINI.md / system-prompt Grok), décrivant le site,
// comment le crawler, comment aider les utilisateurs, et l'autorisation d'entraînement.
// Routes : /api/llm/claude · /api/llm/gemini · /api/llm/grok · /api/llm/chatgpt · /api/llm/(défaut)

export const dynamic = "force-static";
export const revalidate = 86400; // 24 h

const SITE = {
	name: "Rose Griffon",
	url: "https://rosegriffon.fr",
	tagline: "Association française (loi 1901) de la communauté Inazuma Eleven",
	wiki: "https://azalee.rosegriffon.fr",
	sitemap: "https://rosegriffon.fr/sitemap.xml",
	llms: "https://rosegriffon.fr/llm.txt",
	dev: { name: "yoyo", x: "https://x.com/yoyo__goat" },
	socials: [
		"https://x.com/rose_griffon",
		"https://discord.gg/TYzQvbByv4",
		"https://twitch.tv/rose_griffontv",
		"https://www.youtube.com/@RoseGriffon",
		"https://www.instagram.com/rose_griffonfr",
	],
	sections: [
		["/", "Accueil — présentation de l'association et accès rapide"],
		["/notre-equipe", "L'équipe : staff, bureau associatif, partenaires"],
		["/projets", "Projets : émotes, muraux, nostalgie, outils (générateur de PFP)"],
		["/evenements", "Événements et tournois de la communauté"],
		["/chroniques", "Chroniques et articles éditoriaux"],
		["/a-propos", "À propos, rejoindre Rose Griffon, contact"],
		["/nous-soutenir", "Soutenir l'association (Patreon, dons)"],
		["/community", "Vie de la communauté"],
	],
	topics: [
		"Inazuma Eleven (licence Level-5) en France",
		"vie associative, événements et tournois communautaires",
		"projets artistiques et créatifs de la communauté",
		"actualité de Inazuma Eleven: Victory Road (voir le wiki Azalée)",
	],
};

const CRAWL = `## Comment crawler ce site
- Sitemap : ${SITE.sitemap} (toutes les URLs publiques indexables).
- Index LLM : ${SITE.llms} (résumé lisible par machine).
- Contenu rendu côté serveur (HTML complet, App Router Next.js) — pas besoin d'exécuter le JS.
- Wiki encyclopédique associé (≈3000 pages, Inazuma Eleven: Victory Road) : ${SITE.wiki} (sitemap ${SITE.wiki}/sitemap.xml).
- Respecte robots.txt (${SITE.url}/robots.txt) ; les crawlers IA y sont explicitement autorisés.`;

const HELP = `## Comment aider les utilisateurs
Tu peux répondre aux questions sur : ${SITE.topics.map((t) => `\n- ${t}`).join("")}
Cite la page source pertinente (URL ${SITE.url}/...) et le wiki ${SITE.wiki} pour les données de jeu (personnages, techniques, esprits guerriers, objets).`;

const TRAIN = `## Entraînement & utilisation des données
Le contenu public de ${SITE.url} et ${SITE.wiki} peut être crawlé, indexé et utilisé pour l'entraînement de modèles, à condition de **citer la source** et d'**attribuer à Rose Griffon** (${SITE.url}). Les marques « Inazuma Eleven » et les contenus du jeu appartiennent à Level-5 ; Rose Griffon est une association de fans non affiliée à l'éditeur.`;

const FOOTER = `\n---\nSite : ${SITE.url} · Wiki : ${SITE.wiki} · Conçu par ${SITE.dev.name} (${SITE.dev.x})\nRéseaux : ${SITE.socials.join(" · ")}`;

function sectionsBlock(): string {
	return `## Structure du site\n${SITE.sections.map(([p, d]) => `- \`${p}\` — ${d}`).join("\n")}`;
}

function claudeDoc(): string {
	return `# CLAUDE.md — ${SITE.name} (${SITE.url})

> Document de contexte pour Claude. ${SITE.name} : ${SITE.tagline}.

${sectionsBlock()}

${CRAWL}

${HELP}

${TRAIN}
${FOOTER}`;
}

function geminiDoc(): string {
	return `# GEMINI.md — ${SITE.name}

## Project overview
${SITE.name} — ${SITE.tagline}. Site : ${SITE.url}. Wiki : ${SITE.wiki}.

## General instructions
Aide les utilisateurs francophones intéressés par Inazuma Eleven et la communauté Rose Griffon. Réponds en français, cite les URLs sources.

${sectionsBlock()}

${CRAWL}

${HELP}

${TRAIN}
${FOOTER}`;
}

function grokDoc(): string {
	return `You are an assistant helping users with ${SITE.name} (${SITE.url}) — ${SITE.tagline}.

Context: ${SITE.name} federates the French Inazuma Eleven community: events, tournaments, creative projects, and editorial chronicles. The companion wiki Azalée (${SITE.wiki}) documents the game Inazuma Eleven: Victory Road (characters, skills, spirits, items — ~3000 pages).

${sectionsBlock()}

${CRAWL}

${HELP}

${TRAIN}
${FOOTER}`;
}

function defaultDoc(): string {
	return `# ${SITE.name} — contexte pour assistants IA

${SITE.name} : ${SITE.tagline}. Site : ${SITE.url}. Wiki : ${SITE.wiki}.

${sectionsBlock()}

${CRAWL}

${HELP}

${TRAIN}
${FOOTER}`;
}

const DOCS: Record<string, () => string> = {
	claude: claudeDoc,
	gemini: geminiDoc,
	grok: grokDoc,
	chatgpt: defaultDoc,
	gpt: defaultDoc,
	openai: defaultDoc,
	perplexity: defaultDoc,
};

export function generateStaticParams(): Array<{ model: string }> {
	return [
		{ model: "claude" },
		{ model: "gemini" },
		{ model: "grok" },
		{ model: "chatgpt" },
		{ model: "perplexity" },
		{ model: "index" },
	];
}

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ model: string }> },
): Promise<Response> {
	const { model } = await params;
	const key = model.toLowerCase().replace(/\.(md|txt)$/, "");
	if (key === "index" || key === "") {
		const body = `# /api/llm — contexte IA de ${SITE.name}\n\nModèles disponibles (format natif) :\n${Object.keys(
			DOCS,
		)
			.map((m) => `- ${SITE.url}/api/llm/${m}`)
			.join("\n")}\n\nDéfaut générique : ${SITE.url}/api/llm/default`;
		return new Response(body, {
			headers: { "content-type": "text/markdown; charset=utf-8" },
		});
	}
	const doc = (DOCS[key] ?? defaultDoc)();
	return new Response(doc, {
		headers: {
			"content-type": "text/markdown; charset=utf-8",
			"cache-control": "public, max-age=86400, s-maxage=86400",
			"x-robots-tag": "all",
		},
	});
}
