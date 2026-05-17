/**
 * Middleware pour optimiser les requêtes récurrentes
 * Ajoute automatiquement du caching et du batching
 */

interface RequestMetrics {
  endpoint: string;
  startTime: number;
  duration: number;
  cached: boolean;
}

const requestMetrics: RequestMetrics[] = [];

/**
 * Logger les performances des requêtes
 */
export function logRequestMetric(endpoint: string, startTime: number, cached: boolean = false) {
  const duration = Date.now() - startTime;
  requestMetrics.push({ endpoint, startTime, duration, cached });

  if (duration > 500) {
    console.warn(`⚠️ Slow query detected: ${endpoint} took ${duration}ms`);
  }

  // Garder seulement les 100 dernières requêtes
  if (requestMetrics.length > 100) {
    requestMetrics.shift();
  }
}

/**
 * Obtenir les statistiques de performance
 */
export function getRequestMetrics() {
  const total = requestMetrics.length;
  const avgDuration = requestMetrics.reduce((acc, m) => acc + m.duration, 0) / total;
  const cachedCount = requestMetrics.filter((m) => m.cached).length;
  const cacheHitRate = (cachedCount / total) * 100;

  return {
    total,
    avgDuration: Math.round(avgDuration),
    cachedCount,
    cacheHitRate: Math.round(cacheHitRate),
  };
}

/**
 * Wrapper pour tracer les requêtes
 */
export async function traceQuery<T>(
  name: string,
  fn: () => Promise<T>,
  cached: boolean = false
): Promise<T> {
  const startTime = Date.now();
  const result = await fn();
  logRequestMetric(name, startTime, cached);
  return result;
}

/**
 * Détecteur de requêtes N+1 (pattern dangereux)
 * À utiliser en développement
 */
export class N1QueryDetector {
  private static queries: Map<string, number> = new Map();
  private static threshold = 5;

  static reset() {
    N1QueryDetector.queries.clear();
  }

  static recordQuery(endpoint: string) {
    const count = N1QueryDetector.queries.get(endpoint) ?? 0;
    N1QueryDetector.queries.set(endpoint, count + 1);

    if (count + 1 > N1QueryDetector.threshold) {
      console.warn(`⚠️ Possible N+1 query pattern detected: ${endpoint} called ${count + 1} times`);
    }
  }

  static getReport() {
    return Array.from(N1QueryDetector.queries.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }
}

/**
 * Suggest optimizations based on query patterns
 */
export function suggestOptimizations() {
  const metrics = getRequestMetrics();
  const report = N1QueryDetector.getReport();

  const suggestions: string[] = [];

  if (metrics.cacheHitRate < 30) {
    suggestions.push("💡 Cache hit rate est bas. Augmentez les durées de revalidation.");
  }

  if (metrics.avgDuration > 300) {
    suggestions.push("💡 Requêtes moyennes lentes. Utilisez le batching ou les indexes DB.");
  }

  report.forEach(({ endpoint, count }) => {
    if (count > 10) {
      suggestions.push(`💡 "${endpoint}" appelé ${count} fois. Utilisez fetchBatch() ou cache.`);
    }
  });

  return suggestions;
}

export type { RequestMetrics };
