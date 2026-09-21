/** Les recherches web live sont retirées avec le moteur de crawl. */
export interface RagWebDoc {
	title: string;
	url: string;
	markdown: string;
	rank: number;
}

export interface RagWebOptions {
	maxResults?: number;
}

export async function ragWebSearch(_query: string, _options: RagWebOptions = {}): Promise<RagWebDoc[]> {
	return [];
}
