# aphrody-nie-render3d

CPU-only, deterministic rendering and inspection of reconstructed IEVR GLB models. The renderer uses the shared scalar `aphrody-softraster` and does not include the upstream wgpu/WebGPU/WebGL modules.

```sh
cargo check -p aphrody-nie-render3d
```

The optional CLI can produce local images and video. The WGPU game host stays outside this workspace.
