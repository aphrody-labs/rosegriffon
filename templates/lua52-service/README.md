# @rosegriffon/lua52-template

Production-grade sovereign template for Lua 5.2 service development in Bun and Rust.

## Features

- **Pure Lua 5.2 Reference Code**: Demonstrates `_ENV` lexical environment, `goto` with `::labels::`, `bit32` bitwise operations, and `table.pack`/`table.unpack`.
- **Tree-sitter AST Extraction**: High-density symbol and import extraction powered by native Rust `depot-treesitter` via `depot_ffi.dll`.
- **Lua 5.2 Language Server (LSP)**: Lightweight LSP server reporting diagnostics (flagging deprecated `setfenv`, `getfenv`, `unpack`), symbols, and hover documentation.
- **REA Bytecode Inspection**: Integrated runtime execution analysis for compiled Lua 5.2 chunks (`\x1bLua\x52`).
