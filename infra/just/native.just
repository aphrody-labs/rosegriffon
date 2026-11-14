# Unified YAML/JSON/C23 LLVM contract & native shared ABI recipes.

[group('native')]
[doc("Regenerate JSON, C23, TS, and Rust artifacts from contract/stack.yml.")]
contract:
    bun run contract:sync

[group('native')]
[doc("Verify generated contract artifacts have no drift against contract/stack.yml.")]
contract-check:
    bun run contract:check

[group('native')]
[doc("Compile freestanding Pure C23 LLVM rg_contract DLL + ThinLTO archive.")]
c-build *args:
    bun run c:build {{args}}

[group('native')]
[doc("Build and run Pure C23 LLVM rg_contract unit tests.")]
c-test:
    bun run c:test
