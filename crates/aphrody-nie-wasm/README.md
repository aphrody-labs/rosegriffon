# aphrody-nie-wasm

WebAssembly bindings (wasm-bindgen, workspace pin `=0.2.129`) for the nie crates. This file
documents the fullscreen client `NieClientRuntime` (`src/client.rs`); the format, data and
inspection exports are described in the crate docs (`src/lib.rs`).

## Build and output location

Run on the `vps` host (heavy build, sccache), never on the Windows workstation:

```sh
cargo build -p aphrody-nie-wasm --target wasm32-unknown-unknown --release
wasm-bindgen target/wasm32-unknown-unknown/release/aphrody_nie_wasm.wasm \
    --out-dir crates/aphrody-nie-wasm/pkg --target web
```

The package lands in `crates/aphrody-nie-wasm/pkg/` (`aphrody_nie_wasm.js`,
`aphrody_nie_wasm_bg.wasm`, `aphrody_nie_wasm.d.ts`). The wasm-bindgen CLI version must match
the workspace pin exactly.

## Asset origin

Every URL comes from the public CDN `https://cdn.rosegriffon.fr` (overridable via the
constructor). The client never requests `/vfs` or `/raw`. Routes used:

| Route | Use |
|---|---|
| `/tex/<rel>.png`, `/tex-info/<rel>.g4tx` | menu, HUD, `gaiji_game` atlases and their regions |
| `/tex/dx11/font/font_def/font.png`, `/ui/font-metrics.json` | `font_def` font |
| `/audio-info/data/common/sound_asset/bgm_title.acb` | resolves cue `bg00010` |
| `/audio/data/common/sound_asset/bgm_title.acb?id=N` | title music (WAV) |
| `/model-full/c01000010.glb`, `/model-full/c05000010.glb` | home / away players |
| `/model-chr/item/b000004.glb` | ball |
| `/static/nie/boot/SplashScreen.png` | `EasyAntiCheat/SplashScreen.png` |
| `/static/nie/boot/L5logo.mp4`, `/static/nie/boot/IE_15th.mp4` | boot videos (transcoded `.usm`) |

The `/static/nie/boot/` files must be published by the deploy side; the client reports any
missing one through `poll_events()` (`assetError`) and keeps going.

## Flow

`eac-launcher` (progress = boot assets actually received) -> `boot-logo` (two videos played by
the host) -> `loading` -> `autosave` -> `start` -> `title-menu` (13 measured controls of
`title_menu_2`, 2D spatial navigation) -> `match-loading` -> `match`. From the title menu,
`mode-competition` starts a match and `avatar` opens the avatar editor (six tabs, L1/R1);
other entries are reported as `menuAction` events with `handled: false`.

## JS API (`class NieClientRuntime`)

| Method | Role |
|---|---|
| `new NieClientRuntime(cdnBase?: string, width, height)` | create; throws on an invalid embedded scene |
| `resize(w, h)`, `width()`, `height()` | canvas size |
| `tick(dtMs)` | advance (call from `requestAnimationFrame`) |
| `render_into(out: Uint8Array)` | fill RGBA8 `width*height*4` (wrap in `ImageData`) |
| `set_gamepad(buttons: Float32Array, axes: Float32Array, id)` | `Gamepad.buttons[i].value`, `Gamepad.axes`, `Gamepad.id` (Standard Gamepad, 16 buttons + 2 sticks) |
| `clear_gamepad()`, `blur()` | disconnect / lost focus |
| `key_down(code) -> bool`, `key_up(code)` | keyboard fallback; `true` = call `preventDefault` |
| `poll_asset_requests() -> string` | JSON `[{id, url, kind: "image"\|"json"\|"model"}]`, each returned once |
| `provide_asset(id, bytes: Uint8Array)` | response body; throws if undecodable |
| `asset_failed(id, status, reason)` | HTTP or network failure |
| `poll_media_commands() -> string` | JSON `[{op: "playAudio", channel, url, loop} \| {op: "stopAudio", channel} \| {op: "playVideo", name, url} \| {op: "stopVideo"}]` |
| `video_ended(name)` | boot video finished or failed |
| `wants_video() -> bool` | host should show the boot video under the canvas |
| `poll_events() -> string` | JSON `stage`, `menuAction`, `goal`, `fullTime`, `assetError` |
| `stage() -> string`, `focused_control()`, `match_score()`, `failed_assets()` | state queries |
| `set_match_render_scale(0.25..1)` | 3D resolution factor (default 0.5) |

Minimal host loop:

```js
import init, { NieClientRuntime } from "./pkg/aphrody_nie_wasm.js";
await init();
const rt = new NieClientRuntime(undefined, canvas.width, canvas.height);
const img = new ImageData(canvas.width, canvas.height);
function frame(dt) {
  const pad = navigator.getGamepads().find(Boolean);
  if (pad) rt.set_gamepad(Float32Array.from(pad.buttons, b => b.value), Float32Array.from(pad.axes), pad.id);
  for (const r of JSON.parse(rt.poll_asset_requests()))
    fetch(r.url).then(x => x.ok ? x.arrayBuffer().then(b => rt.provide_asset(r.id, new Uint8Array(b)))
                                : rt.asset_failed(r.id, x.status, x.statusText),
                      e => rt.asset_failed(r.id, 0, String(e)));
  // media: play WAV through WebAudio, boot videos through an offscreen <video> drawn to the canvas.
  rt.tick(dt);
  rt.render_into(img.data);
  ctx.putImageData(img, 0, 0);
}
```

## Match controls

Left stick or D-pad: move. R2: sprint (drains stamina). South (A): pass toward the stick, or
validate a Focus duel choice. East (B): hold to charge a shot, release to shoot. West (X):
Hissatsu shot (50 Tension, within 32 m). North (Y): defensive Hissatsu (30 Tension). L1: switch
player. R1: Zone (full Tension, half-speed world). Start: pause (resume, camera, restart,
quit). These rules are local to the nie engine; they are not measured from `nie.exe`.

## Delivery to the website

The package never enters git. `wasm-opt -O3` is run on the wasm-bindgen output, then
`bun infra/scripts/publish-nie-wasm.ts --pkg crates/aphrody-nie-wasm/pkg --static <cdn static dir>
--release apps/rg-website/src/lib/nie-wasm-release.json` copies the JS glue and the wasm into
`/static/nie/wasm/<hash>/` (first 16 hex digits of SHA-256 over both files) and writes the small
release JSON the website commits. nginx serves `/static/` with
`Cache-Control: public, max-age=31536000, immutable` and `Access-Control-Allow-Origin: *`, so a
release is fetched once per browser and a new build always gets a new URL. The host
(`apps/rg-website/src/lib/nie-client-host.ts`) imports the glue from that URL at runtime.

Boot files (`SplashScreen.png`, `L5logo.mp4`, `IE_15th.mp4`) come from
`bun infra/scripts/derive-nie-boot.ts --game <install> --static <cdn static dir>`.
