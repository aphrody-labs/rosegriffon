// SPDX-License-Identifier: Apache-2.0
// Replaced by `scripts/compile.ts` while it links the executable, then restored.
// In source runs no site archive is embedded: `rosegriffon site` serves
// `apps/rg-website/.next/standalone` (or `RG_SITE_DIR`) from disk instead.

/** Path of the embedded Next standalone archive (`.tar.gz`), or `null`. */
export const SITE_ARCHIVE: string | null = null;
/** SHA-256 of the embedded archive; names its extraction directory. */
export const SITE_HASH: string | null = null;
/** Version of the workspace the executable was built from. */
export const BUILD_VERSION: string | null = null;
