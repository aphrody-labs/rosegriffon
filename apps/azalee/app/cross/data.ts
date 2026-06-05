// Données crawlées du site officiel https://www.inazuma-cross.jp/ (bxc mirror).
// Source canonique : apps/azalee/data/inazuma-cross.json (tracké, sans PII).
// La traduction FR (champs *Fr) est faite manuellement — le site officiel n'a pas de version FR.
import raw from "@/data/inazuma-cross.json";

export interface CrossNews {
	date: string;
	titleJa: string;
	titleFr: string;
	url: string;
	tag: string;
}

export interface CrossCharacter {
	position: string;
	tagJa: string;
	nameJa: string;
	nameFr: string;
	skills: string[];
}

export interface CrossData {
	site: {
		title: string;
		titleRomaji: string;
		subtitle: string;
		description: string;
		ogImage: string;
	};
	status: {
		phase: string;
		phaseLabelJa: string;
		serviceStart: string;
		serviceStartLabelJa: string;
		note: string;
	};
	spec: {
		title: string;
		genre: string;
		genreFr: string;
		platforms: string;
		pricing: string;
		pricingFr: string;
		releaseDate: string;
		developers: string[];
		copyright: string;
	};
	introduction: { headingJa: string; storyJa: string; storyFr: string };
	protagonist: {
		nameJa: string;
		nameReadingJa: string;
		nameRomaji: string;
		descriptionJa: string;
		descriptionFr: string;
		image: string;
	};
	news: CrossNews[];
	rewards: { headingJa: string; headingFr: string; noteFr: string; images: string[] };
	samuraiBlue2026: {
		titleJa: string;
		titleFr: string;
		url: string;
		eventPeriod: string;
		descriptionFr: string;
		limitedCharacters: CrossCharacter[];
		designNoteFr: string;
	};
	movies: { headingJa: string; youtube: { id: string; labelFr: string }[] };
	links: Record<string, string | string[]>;
	images: Record<string, string | string[]>;
	localImages: {
		keyVisual: string;
		firstView: string;
		logo: string;
		protagonist: string;
		samuraiBlue: string;
		ogp: string;
		systemScreenshots: string[];
	};
}

export const crossData = raw as unknown as CrossData;
