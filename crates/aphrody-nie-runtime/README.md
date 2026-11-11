# aphrody-nie-runtime

Headless deterministic match simulation, game timing, animation adapters, and CPU top-down rendering. The command-line bins can encode PNG/MP4 output; GPU and WASM hosts remain outside this crate.

```sh
cargo check -p aphrody-nie-runtime
```

The CPU simulation is suitable for deterministic replay and online lockstep. It is a local reconstructed simulation, not a claim of byte-exact Level-5 match physics.
