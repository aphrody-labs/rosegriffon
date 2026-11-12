# syntax=docker/dockerfile:1.7
# SPDX-License-Identifier: Apache-2.0
# cdn-sync: Bun.s3 publisher of /data/cdn/static (read-only) to R2 / S3-compatible buckets.
# Build context: the rosegriffon repository root. No dependencies beyond the Bun runtime.
ARG BUN_VERSION=1.4.4
FROM oven/bun:${BUN_VERSION}-alpine
WORKDIR /app
COPY infra/docker/cdn-sync/sync.ts ./sync.ts
ENV CDN_SYNC_SOURCE=/data/cdn/static \
    CDN_SYNC_PREFIX=static/
USER bun
ENTRYPOINT ["bun", "run", "/app/sync.ts"]
