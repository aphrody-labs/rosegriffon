/**
 * Thin browser host for `NieClientRuntime` (crates/aphrody-nie-wasm/src/client.rs, JS API in
 * crates/aphrody-nie-wasm/README.md). The runtime owns every pixel and every decision; the host
 * only moves bytes: frames into a canvas, gamepad/keyboard state in, CDN responses in, and
 * audio/video commands out to WebAudio and a hidden <video>.
 *
 * The wasm package is not bundled: it is published to the CDN under a content-addressed,
 * immutable directory (`/static/nie/wasm/<hash>/`, see infra/scripts/publish-nie-wasm.ts) named
 * by `nie-wasm-release.json`, and imported at runtime.
 */
import release from "./nie-wasm-release.json";

export const NIE_CDN_BASE = (
  process.env.NEXT_PUBLIC_NIE_CDN_BASE || "https://cdn.rosegriffon.fr"
).replace(/\/+$/, "");

/** Fetches in flight at once (nginx `limit_conn` is 8 per client; leave room for media). */
export const ASSET_CONCURRENCY = 6;
/** Upper bound on backing-store pixels: the runtime rasterises on the CPU. */
const MAX_PIXELS = 1920 * 1080;
const GAMEPAD_PERIOD_MS = 1000 / 60;

/** Subset of the wasm-bindgen class used by the host. */
export interface NieRuntime {
  resize(w: number, h: number): void;
  tick(dtMs: number): void;
  render_into(out: Uint8Array): void;
  set_gamepad(buttons: Float32Array, axes: Float32Array, id: string): void;
  clear_gamepad(): void;
  blur(): void;
  key_down(code: string): boolean;
  key_up(code: string): void;
  poll_asset_requests(): string;
  provide_asset(id: number, bytes: Uint8Array): void;
  asset_failed(id: number, status: number, reason: string): void;
  poll_media_commands(): string;
  poll_events(): string;
  video_ended(name: string): void;
  wants_video(): boolean;
  stage(): string;
  focused_control(): string | undefined;
  match_score(): Uint32Array;
  free?(): void;
}

interface NieModule {
  default: (opts: { module_or_path: string }) => Promise<unknown>;
  NieClientRuntime: new (
    cdnBase: string | undefined,
    w: number,
    h: number,
  ) => NieRuntime;
}

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

/** Backing-store size for a CSS box: devicePixelRatio aware, capped at MAX_PIXELS. */
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
    private fetcher: typeof fetch = (...a) => fetch(...a),
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

  let { w, h } = backingSize(
    window.innerWidth,
    window.innerHeight,
    window.devicePixelRatio || 1,
  );
  const rt = new mod.NieClientRuntime(NIE_CDN_BASE, w, h);
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
  let pixels = new Uint8ClampedArray(w * h * 4);
  let image = new ImageData(pixels, w, h);
  let view = new Uint8Array(pixels.buffer);
  let layer: OffscreenCanvas | null = null;

  const applySize = () => {
    canvas.width = w;
    canvas.height = h;
    rt.resize(w, h);
    pixels = new Uint8ClampedArray(w * h * 4);
    image = new ImageData(pixels, w, h);
    view = new Uint8Array(pixels.buffer);
    layer = null;
  };
  applySize();

  const pump = new AssetPump(rt);
  const audio = new AudioOut();
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.setAttribute("aria-hidden", "true");
  video.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
  document.body.appendChild(video);
  let videoName: string | null = null;
  const endVideo = () => {
    if (videoName) {
      const n = videoName;
      videoName = null;
      rt.video_ended(n);
    }
  };
  video.addEventListener("ended", endVideo);
  video.addEventListener("error", endVideo);

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

  const onKeyDown = (e: KeyboardEvent) => {
    onGesture();
    if (rt.key_down(e.code)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => rt.key_up(e.code);
  const onBlur = () => rt.blur();
  const onVisibility = () => {
    if (document.hidden) rt.blur();
  };
  const onResize = () => {
    const s = backingSize(
      window.innerWidth,
      window.innerHeight,
      window.devicePixelRatio || 1,
    );
    if (s.w !== w || s.h !== h) {
      ({ w, h } = s);
      applySize();
    }
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("resize", onResize);
  window.addEventListener("pointerdown", onGesture);
  document.addEventListener("visibilitychange", onVisibility);

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

  let padSeen = false;
  let lastPad = 0;
  const pollGamepad = (now: number) => {
    if (now - lastPad < GAMEPAD_PERIOD_MS - 1) return;
    lastPad = now;
    const pad = navigator.getGamepads?.().find((p) => p && p.connected) ?? null;
    if (pad) {
      rt.set_gamepad(
        Float32Array.from(pad.buttons, (b) => b.value),
        Float32Array.from(pad.axes),
        pad.id,
      );
      padSeen = true;
    } else if (padSeen) {
      rt.clear_gamepad();
      padSeen = false;
    }
  };

  const draw = () => {
    rt.render_into(view);
    if (rt.wants_video() && videoName && video.readyState >= 2) {
      // Boot video under the runtime frame: composite the frame with its alpha.
      const vw = video.videoWidth || w;
      const vh = video.videoHeight || h;
      const s = Math.min(w / vw, h / vh);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(video, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s);
      layer ??= new OffscreenCanvas(w, h);
      layer.getContext("2d")!.putImageData(image, 0, 0);
      ctx.drawImage(layer, 0, 0);
    } else {
      ctx.putImageData(image, 0, 0);
    }
  };

  let frames = 0;
  let raf = 0;
  let last = performance.now();
  let running = true;
  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(now - last, 100);
    last = now;
    pollGamepad(now);
    rt.tick(dt);
    const reqs = rt.poll_asset_requests();
    if (reqs !== "[]") pump.push(JSON.parse(reqs) as AssetRequest[]);
    const cmds = rt.poll_media_commands();
    if (cmds !== "[]") media(JSON.parse(cmds) as MediaCommand[]);
    rt.poll_events();
    draw();
    frames++;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  window.__nie = {
    stage: () => rt.stage(),
    focusedControl: () => rt.focused_control() ?? null,
    frames: () => frames,
    ready: true,
  };

  return {
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      pump.stop();
      audio.close();
      video.remove();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", onGesture);
      document.removeEventListener("visibilitychange", onVisibility);
      delete window.__nie;
      rt.free?.();
    },
  };
}
