/** Retired semantic-search compatibility boundary. No index or service is started. */
export async function runRagSync(): Promise<{ success: boolean }> {
	return { success: true };
}

export async function ingestWikiCorpus(): Promise<{ success: boolean }> {
	return { success: true };
}

export interface RetiredRagResult { score: number; title: string; type: string; url: string; date: string; text: string }

export async function queryRag(_question: string): Promise<RetiredRagResult[]> {
	return [];
}

export async function ragGroundedQuery(_question: string, _options?: unknown): Promise<{ sources: RetiredRagResult[] }> {
	return { sources: [] };
}
