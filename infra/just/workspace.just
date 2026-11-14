# Workspace (local, light) recipes.

[group('workspace')]
[doc("Install workspace dependencies (no lifecycle scripts).")]
install:
    bun install --ignore-scripts

[group('workspace')]
[doc("Format workspace files with bun.")]
fmt:
    bun fmt

[group('workspace')]
[doc("Typecheck all workspace packages.")]
check:
    bun run typecheck

[group('workspace')]
[doc("Lint all workspace packages.")]
lint:
    bun run lint

[group('workspace')]
[doc("Run workspace test suite.")]
test:
    bun run test

[parallel]
[group('workspace')]
[doc("Full gate: check, lint, test in parallel, then workspace build.")]
ci: check lint test
    bun run build

[group('workspace')]
[doc("Single-file rg-core executable (scripts/compile.ts); extra args forwarded.")]
compile *args:
    bun scripts/compile.ts {{args}}

[group('workspace')]
[doc("Regenerate rg-ui theme packs and design tokens.")]
tokens:
    bun --cwd packages/rg-ui run themes
