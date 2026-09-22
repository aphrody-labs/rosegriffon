/**
 * Cache for loaded JSON files to prevent redundant disk I/O
 */
const fileCache = new Map<string, any>();

/**
 * Asynchronously load a JSON file with caching.
 * Extraction-only helper: durable runtime reads use PostgreSQL projections.
 * @param path Absolute path to the file
 * @returns Parsed JSON object or null if not found/error
 */
export async function loadJsonAsync<T>(path: string | null): Promise<T | null> {
	if (!path) return null;
	if (fileCache.has(path)) {
		return fileCache.get(path) as T;
	}

	const bunFile = Bun.file(path);
	if (!(await bunFile.exists())) {
		return null;
	}

	try {
		const data = (await bunFile.json()) as T;

		fileCache.set(path, data);
		return data;
	} catch (error) {
		console.error(`[AsyncLoader] Failed to parse ${path}`, error);
		return null;
	}
}

/**
 * Helper to measure execution time
 */
export async function measureTime<T>(label: string, fn: () => Promise<T>): Promise<T> {
	const start = performance.now();
	const result = await fn();
	const end = performance.now();
	console.log(`[Perf] ${label}: ${(end - start).toFixed(2)}ms`);
	return result;
}
