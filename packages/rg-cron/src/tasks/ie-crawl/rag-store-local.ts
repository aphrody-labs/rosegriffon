/** @deprecated Compatibility shim while historical collectors are retired. */
export interface RagSource {
	sourceId: string;
	kind: string;
	raw: string;
	title: string;
	url: string;
	meta: Record<string, unknown>;
	[key: string]: unknown;
}

/** The semantic index was removed; collection callers now remain no-ops. */
export async function ingestSources(_sources: RagSource[]): Promise<{ chunks: number; sources: number; skipped: number; backend: string }> {
	return { chunks: 0, sources: 0, skipped: 0, backend: "retired" };
}
