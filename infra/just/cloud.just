# Cloud, Turborepo, Cloudflare Workers, and Vercel recipes.

[private]
_wrangler-edge *args:
    wrangler {{args}} --config infra/cloudflare/edge/wrangler.jsonc

[group('cloud')]
[doc("Run Turborepo typecheck and lint across the monorepo.")]
turbo-check:
    turbo run typecheck lint

[group('cloud')]
[doc("Run Turborepo build across the monorepo.")]
turbo-build *args:
    turbo run build {{args}}

[group('cloud')]
[doc("Deploy Cloudflare edge and maintenance workers via wrangler.")]
cf-deploy:
    wrangler deploy --config infra/cloudflare/edge/wrangler.jsonc
    wrangler deploy --config infra/cloudflare/maintenance/wrangler.jsonc

[group('cloud')]
[doc("Verify Cloudflare edge worker and production health endpoints.")]
cf-health:
    bun -e "for (const [k, u] of [['edge','https://rosegriffon.fr/health'],['api','https://api.rosegriffon.fr/health']]) { const t=performance.now(); const r=await fetch(u); console.log(k, r.status, ((performance.now()-t)/1000).toFixed(3)+'s'); if (!r.ok) process.exit(1); }"

[group('cloud')]
[doc("Manual Vercel failover build (capped at 1 build/week due to Hobby plan limits).")]
vercel-build-once *args:
    bun scripts/vercel-failover.ts {{args}}
