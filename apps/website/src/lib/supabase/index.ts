// Cache helpers
export { cachedQuery } from "./cache";
export { createClient } from "./client";
export {
  createAdminClient,
  createClient as createServerClient,
} from "./server";

// Query optimizations
// Query optimizations removed

// Performance monitoring
export type { RequestMetrics } from "./performance";
export {
  getRequestMetrics,
  logRequestMetric,
  N1QueryDetector,
  suggestOptimizations,
  traceQuery,
} from "./performance";
