// Builds legacy/achillea-web (Angular 21 + PrimeNG) with bun only, outside the repo.
//
//   bun docs/audits/achillea-parity/tools/build-legacy.ts [workdir]   (default C:/tmp/lgb)
//   LEGACY_DIST=<workdir>/web/dist/achillea-web/browser bun docs/audits/achillea-parity/tools/serve-legacy.ts 4300
//
// The legacy package used `workspace:*` / `catalog:` from its old monorepo:
// @achillea/types is replaced by packages/achillea-types, catalog versions by
// npm latest (TypeScript pinned to 5.9, required by Angular 21). The runtime
// config gets the Supabase URL/key from apps/rg-website/.env.local and the
// static server proxies /api to https://ranked.rosegriffon.fr/api.
import { $ } from "bun";

const repo = `${import.meta.dir}/../../../..`;
const work = process.argv[2] ?? "C:/tmp/lgb";
await $`rm -rf ${work}/web ${work}/types && mkdir -p ${work}`;
await $`cp -r ${repo}/legacy/achillea-web ${work}/web && cp -r ${repo}/packages/achillea-types ${work}/types`;

const types = await Bun.file(`${work}/types/package.json`).text();
await Bun.write(
  `${work}/types/package.json`,
  types.replace('"@rosegriffon/achillea-types"', '"@achillea/types"').replaceAll('"catalog:"', '"latest"'),
);
const pkg = await Bun.file(`${work}/web/package.json`).text();
await Bun.write(
  `${work}/web/package.json`,
  pkg
    .replace('"@achillea/types": "workspace:*"', '"@achillea/types": "file:../types"')
    .replace('"typescript": "catalog:"', '"typescript": "~5.9.3"')
    .replaceAll('"catalog:"', '"latest"'),
);

await $`bun install --ignore-scripts`.cwd(`${work}/web`);
await $`bun scripts/inject-env.ts`.cwd(`${work}/web`);
await $`bun --bun node_modules/@angular/cli/bin/ng.js build --configuration development`
  .cwd(`${work}/web`)
  .env({ ...process.env, NG_CLI_ANALYTICS: "false" });

const env = await Bun.file(`${repo}/apps/rg-website/.env.local`).text();
const read = (k: RegExp) => env.match(k)?.[1]?.replaceAll('"', "").trim() ?? "";
const supabaseUrl = read(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m);
const supabaseKey = read(/^NEXT_PUBLIC_SUPABASE_(?:PUBLISHABLE|ANON)_KEY=(.*)$/m);
await Bun.write(
  `${work}/web/dist/achillea-web/browser/achillea-config.js`,
  `globalThis.__ACHILLEA_CONFIG__ = Object.freeze(${JSON.stringify({
    apiBaseUrl: "",
    socketUrl: "",
    socketPath: "/socket.io",
    colyseusUrl: "",
    cdnBaseUrl: "",
    supabaseUrl,
    supabasePublishableKey: supabaseKey,
    supabaseJwksUrl: "",
    youtubeApiKey: "",
    youtubeChannelId: "",
  })});\n`,
);
console.log(`legacy build ready: ${work}/web/dist/achillea-web/browser`);
