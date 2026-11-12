/**
 * Thin browser loader for `NieGpuClient` (crates/aphrody-nie-wasm/src/gpu_client.rs). Rust owns
 * the frame: the requestAnimationFrame loop, keyboard and gamepad input, devicePixelRatio sizing
 * up to 4K and the WebGPU (WebGL2 fallback) surface on the canvas. This module only fetches and
 * instantiates the wasm, hands it the canvas, answers asset requests and plays the audio/video
 * commands the runtime emits through its `io` callback.
 *
 * The wasm package is not bundled: it is published to the CDN under a content-addressed,
 * immutable directory (`/static/nie/wasm/<hash>/`, see infra/scripts/publish-nie-wasm.ts) named
 * by `nie-wasm-release.json`, and imported at runtime. It must be built with
 * `--features webgl` (WebGPU plus the WebGL2 fallback).
 */
import release from "./nie-wasm-release.json";

export const NIE_CDN_BASE = (
  process.env.NEXT_PUBLIC_NIE_CDN_BASE || "https://cdn.rosegriffon.fr"
).replace(/\/+$/, "");

/** Fetches in flight at once (nginx `limit_conn` is 8 per client; leave room for media). */
export const ASSET_CONCURRENCY = 6;
/** Upper bound on backing-store pixels, mirrored from `gpu_client::MAX_PIXELS` (4K). */
const MAX_PIXELS = 3840 * 2160;

/** Subset of the wasm-bindgen `NieGpuClient` used by the loader. */
export interface NieClient {
  provide_asset(id: number, bytes: Uint8Array): void;
  asset_failed(id: number, status: number, reason: string): void;
  video_ended(name: string): void;
  wants_video(): boolean;
  stage(): string;
  focused_control(): string | undefined;
  frames(): number;
  frame_stats(): string;
  set_debug_overlay(on: boolean): void;
  stop(): void;
  free?(): void;
}

/** Kept for the asset pump's narrow contract. */
export type NieRuntime = Pick<NieClient, "provide_asset" | "asset_failed">;

interface NieModule {
  default: (opts: { module_or_path: string }) => Promise<unknown>;
  NieGpuClient: {
    create(
      canvas: HTMLCanvasElement,
      cdnBase: string | undefined,
      io: (requests: string, media: string) => void,
    ): Promise<NieClient>;
  };
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface AssetRequest {
  id: number;
  url: string;
}

type MediaCommand =
  | { op: "playAudio"; channel: string; url: string; loop: boolean }
  | { op: "stopAudio"; channel: string }
  | { op: "playVideo"; name: string; url: string }
  | { op: "stopVideo" };

export function wasmUrls(cdn = NIE_CDN_BASE) {
  const base = `${cdn}/static/${release.dir}`;
  return { js: `${base}/${release.js}`, wasm: `${base}/${release.wasm}` };
}

/**
 * Backing-store size for a CSS box: devicePixelRatio aware, capped at 4K. The runtime applies
 * the same rule (`gpu_client::backing_size`) every frame; this copy sizes the canvas before the
 * GPU surface exists.
 */
export function backingSize(cssW: number, cssH: number, dpr: number) {
  let w = Math.max(1, Math.round(cssW * dpr));
  let h = Math.max(1, Math.round(cssH * dpr));
  const over = Math.sqrt((w * h) / MAX_PIXELS);
  if (over > 1) {
    w = Math.max(1, Math.floor(w / over));
    h = Math.max(1, Math.floor(h / over));
  }
  return { w, h };
}

/**
 * Asset pump: at most `limit` fetches in flight, each request answered exactly once with
 * `provide_asset` or `asset_failed`.
 */
export class AssetPump {
  private queue: AssetRequest[] = [];
  private inFlight = 0;
  private stopped = false;

  constructor(
    private rt: Pick<NieRuntime, "provide_asset" | "asset_failed">,
    private limit = ASSET_CONCURRENCY,
    private fetcher: Fetcher = (url, init) => fetch(url, init),
  ) {}

  push(reqs: AssetRequest[]) {
    this.queue.push(...reqs);
    this.drain();
  }

  get active() {
    return this.inFlight;
  }

  stop() {
    this.stopped = true;
    this.queue.length = 0;
  }

  private drain() {
    while (
      !this.stopped &&
      this.inFlight < this.limit &&
      this.queue.length > 0
    ) {
      const req = this.queue.shift()!;
      this.inFlight++;
      void this.run(req).finally(() => {
        this.inFlight--;
        this.drain();
      });
    }
  }

  private async run({ id, url }: AssetRequest) {
    let res: Response;
    try {
      res = await this.fetcher(url, { mode: "cors", credentials: "omit" });
    } catch (e) {
      if (!this.stopped) this.rt.asset_failed(id, 0, String(e));
      return;
    }
    if (this.stopped) return;
    if (!res.ok) {
      this.rt.asset_failed(
        id,
        res.status,
        res.statusText || `HTTP ${res.status}`,
      );
      return;
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      if (!this.stopped) this.rt.asset_failed(id, res.status, String(e));
      return;
    }
    if (this.stopped) return;
    try {
      this.rt.provide_asset(id, bytes);
    } catch (e) {
      this.rt.asset_failed(id, res.status, String(e));
    }
  }
}

/** WebAudio channels; each `playAudio` replaces what the channel was playing. */
class AudioOut {
  ctx: AudioContext | null = null;
  private sources = new Map<string, AudioBufferSourceNode>();
  private gen = new Map<string, number>();
  private cache = new Map<string, Promise<AudioBuffer>>();

  private context() {
    this.ctx ??= new AudioContext();
    return this.ctx;
  }

  unlock() {
    void this.context()
      .resume()
      .catch(() => {});
  }

  async play(channel: string, url: string, loop: boolean) {
    this.stop(channel);
    const g = (this.gen.get(channel) ?? 0) + 1;
    this.gen.set(channel, g);
    const ctx = this.context();
    let buf = this.cache.get(url);
    if (!buf) {
      buf = fetch(url, { mode: "cors", credentials: "omit" })
        .then((r) =>
          r.ok
            ? r.arrayBuffer()
            : Promise.reject(new Error(`HTTP ${r.status}`)),
        )
        .then((b) => ctx.decodeAudioData(b));
      this.cache.set(url, buf);
      buf.catch(() => this.cache.delete(url));
    }
    let decoded: AudioBuffer;
    try {
      decoded = await buf;
    } catch (e) {
      console.error("nie audio", url, e);
      return;
    }
    if (this.gen.get(channel) !== g) return;
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.loop = loop;
    src.connect(ctx.destination);
    src.start();
    this.sources.set(channel, src);
  }

  stop(channel: string) {
    this.gen.set(channel, (this.gen.get(channel) ?? 0) + 1);
    const s = this.sources.get(channel);
    if (s) {
      try {
        s.stop();
      } catch {}
      s.disconnect();
      this.sources.delete(channel);
    }
  }

  close() {
    for (const c of [...this.sources.keys()]) this.stop(c);
    void this.ctx?.close().catch(() => {});
  }
}

export interface NieHost {
  stop(): void;
}

declare global {
  interface Window {
    /** Read-only state probes (diagnostics and end-to-end tests). */
    __nie?: {
      stage(): string;
      focusedControl(): string | null;
      frames(): number;
      /** Frame pacing measured in wasm (fps, frame_ms, p99_ms, cpu_ms, backend, size). */
      frameStats(): unknown;
      overlay(on: boolean): void;
      ready: boolean;
    };
  }
}

/** Start the runtime on `canvas`, which must fill the viewport. */
export async function startNieHost(
  canvas: HTMLCanvasElement,
): Promise<NieHost> {
  const { js, wasm } = wasmUrls();
  const mod = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ js
  )) as NieModule;
  await mod.default({ module_or_path: wasm });

  const { w, h } = backingSize(
    canvas.clientWidth || window.innerWidth,
    canvas.clientHeight || window.innerHeight,
    window.devicePixelRatio || 1,
  );
  canvas.width = w;
  canvas.height = h;

  const audio = new AudioOut();
  // The boot video plays in a fullscreen element UNDER the canvas: the runtime presents a
  // transparent frame while it wants the video, so no video pixel ever crosses into wasm.
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.setAttribute("aria-hidden", "true");
  video.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000;pointer-events:none;z-index:0";
  canvas.style.background = "transparent";
  canvas.style.zIndex = "1";
  document.body.appendChild(video);

  let client: NieClient | null = null;
  let videoName: string | null = null;
  const endVideo = () => {
    if (videoName) {
      const n = videoName;
      videoName = null;
      client?.video_ended(n);
    }
  };
  video.addEventListener("ended", endVideo);
  video.addEventListener("error", endVideo);

  const media = (cmds: MediaCommand[]) => {
    for (const c of cmds) {
      switch (c.op) {
        case "playAudio":
          void audio.play(c.channel, c.url, c.loop);
          break;
        case "stopAudio":
          audio.stop(c.channel);
          break;
        case "playVideo":
          videoName = c.name;
          video.src = c.url;
          video.play().catch(() => {
            // Autoplay refused even muted: let the runtime move on.
            if (videoName === c.name) endVideo();
          });
          break;
        case "stopVideo":
          videoName = null;
          video.pause();
          video.removeAttribute("src");
          video.load();
          break;
      }
    }
  };

  let pump: AssetPump | null = null;
  const pending: AssetRequest[] = [];
  const io = (requests: string, cmds: string) => {
    if (requests !== "[]") {
      const reqs = JSON.parse(requests) as AssetRequest[];
      if (pump) pump.push(reqs);
      else pending.push(...reqs);
    }
    if (cmds !== "[]") media(JSON.parse(cmds) as MediaCommand[]);
  };

  client = await mod.NieGpuClient.create(canvas, NIE_CDN_BASE, io);
  const rt = client;
  pump = new AssetPump(rt);
  if (pending.length) pump.push(pending.splice(0));

  // Audio and fullscreen need a user gesture; input itself is read by the runtime.
  let gestured = false;
  const onGesture = () => {
    audio.unlock();
    video.muted = false;
    if (!gestured) {
      gestured = true;
      if (!document.fullscreenElement)
        void document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };
  window.addEventListener("keydown", onGesture);
  window.addEventListener("pointerdown", onGesture);

  window.__nie = {
    stage: () => rt.stage(),
    focusedControl: () => rt.focused_control() ?? null,
    frames: () => rt.frames(),
    frameStats: () => JSON.parse(rt.frame_stats()),
    overlay: (on) => rt.set_debug_overlay(on),
    ready: true,
  };

  return {
    stop() {
      rt.stop();
      pump?.stop();
      audio.close();
      video.remove();
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("pointerdown", onGesture);
      delete window.__nie;
      rt.free?.();
    },
  };
}
