import init, { WasmGame } from "./nie-wasm-web/nie_wasm.js";

const WASM_URL = "/wasm/nie_wasm_bg.wasm";
const FONT_CFG_URL = "/assets/font/font.cfg.bin.gz";
const FONT_G4TX_URL = "/assets/font/font.g4tx.gz";

let initPromise: Promise<void> | null = null;
async function ensureWasm(): Promise<void> {
  if (initPromise === null) {
    initPromise = (async () => {
      await init({ module_or_path: fetch(WASM_URL) });
    })();
  }
  return initPromise;
}

/** Fetch asset and gunzip to raw Uint8Array. */
async function fetchGzipped(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || res.body === null) throw new Error(`${url} -> HTTP ${res.status}`);
  const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Keyboard and gamepad input mapping to native IEVR menu and match commands. */
export const KEY_TO_COMMAND: Record<string, string> = {
  ArrowUp: "CMD_FCS_MTX_UP",
  KeyW: "CMD_FCS_MTX_UP",
  KeyZ: "CMD_FCS_MTX_UP",
  ArrowDown: "CMD_FCS_MTX_DOWN",
  KeyS: "CMD_FCS_MTX_DOWN",
  ArrowLeft: "CMD_FCS_MTX_LEFT",
  KeyA: "CMD_FCS_MTX_LEFT",
  KeyQ: "CMD_FCS_MTX_LEFT",
  ArrowRight: "CMD_FCS_MTX_RIGHT",
  KeyD: "CMD_FCS_MTX_RIGHT",
  Enter: "CMD_ENTER",
  NumpadEnter: "CMD_ENTER",
  Space: "CMD_ENTER",
  Escape: "CMD_BACK",
  Backspace: "CMD_BACK",
  Tab: "CMD_FCS_NEXT",
  KeyI: "CMD_INFO",
};

export interface GameHandle {
  readonly width: number;
  readonly height: number;
  input(cmd: string): void;
  setMatchInput(dx: number, dy: number, shoot: boolean): void;
  update(dt: number): void;
  frame(): ImageData;
  score(): [number, number];
  inMatch(): boolean;
  stateJson(): any;
}

/** Loads the complete WebAssembly IEVR game engine + fonts. */
export async function loadGame(): Promise<GameHandle> {
  await ensureWasm();
  const [cfg, g4tx] = await Promise.all([fetchGzipped(FONT_CFG_URL), fetchGzipped(FONT_G4TX_URL)]);
  const game = new WasmGame(cfg, g4tx);
  const w = game.width;
  const h = game.height;
  const toImage = (rgba: Uint8Array): ImageData => new ImageData(new Uint8ClampedArray(rgba), w, h);

  return {
    width: w,
    height: h,
    input: cmd => game.input(cmd),
    setMatchInput: (dx, dy, shoot) => {
      if (typeof (game as any).set_match_input === "function") {
        (game as any).set_match_input(dx, dy, shoot);
      }
    },
    update: dt => game.update(dt),
    frame: () => toImage(game.render()),
    score: () => {
      const s = game.score();
      return [s[0] ?? 0, s[1] ?? 0];
    },
    inMatch: () => game.in_match,
    stateJson: () => {
      try {
        if (typeof (game as any).state_json === "function") {
          return JSON.parse((game as any).state_json());
        }
      } catch {}
      return null;
    },
  };
}
