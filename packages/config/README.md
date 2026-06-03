# @rose-griffon/config

Presets de configuration partagés du monorepo rose-griffon : `tsconfig` (base / bun / nextjs),
preset `oxlint`, preset Tailwind. Consommé en interne via `workspace:*`.

```jsonc
// tsconfig.json
{ "extends": "@rose-griffon/config/tsconfig-bun.json" }
```
