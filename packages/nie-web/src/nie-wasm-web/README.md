# nie-wasm-web

`nie-engine.ts` and `nie-game.ts` import the wasm-bindgen output of
`crates/aphrody-nie-wasm` from this folder (`nie_wasm.js`, `nie_wasm.d.ts`,
`nie_wasm_bg.wasm`, `nie_wasm_bg.wasm.d.ts`). These are build output and are
ignored by `.gitignore`. Regenerate them with the wasm-bindgen CLI pinned in
`Cargo.lock`:

```sh
cargo build -p aphrody-nie-wasm --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-name nie_wasm \
  --out-dir packages/nie-web/src/nie-wasm-web \
  "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/aphrody_nie_wasm.wasm"
```
