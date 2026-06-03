// Author WinUI 3 XAML from Bun.
//
// Bun can't host XAML in-process, so this drives the Winclean.XamlHost helper:
// you write XAML markup as a string in TS, it becomes a live WinUI 3 window
// (parsed via XamlReader.Load), and control events stream back to your handlers.
// Update controls with setText, read them with getText.

import { resolve } from "node:path";
import type { ReadableStreamDefaultReader } from "node:stream/web";

export type XamlEvent = { event: string; name: string; value?: unknown };
type EventHandler = (e: XamlEvent) => void;

type Incoming =
  | { type: "ready" }
  | { type: "result"; id: number; ok: boolean; value?: unknown; error?: string }
  | { type: "event"; event: string; name: string; value?: unknown };

export function resolveHostExe(override?: string): string {
  if (override && Bun.file(override).size > 0) {
    return override;
  }
  // The host project lives under ./tools/ inside the fork.
  const full = resolve(
    import.meta.dir,
    "tools/Winclean.XamlHost/bin/Debug/net10.0-windows10.0.26100.0/win-x64/Winclean.XamlHost.exe",
  );
  if (Bun.file(full).size === 0) {
    throw new Error("Winclean.XamlHost.exe not found. Build: dotnet build winclean/tools/Winclean.XamlHost");
  }
  return full;
}

export class XamlApp {
  readonly #proc: Bun.Subprocess<"pipe", "pipe", "inherit">;
  readonly #reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>;
  readonly #decoder = new TextDecoder();
  readonly #encoder = new TextEncoder();
  #buffer = "";
  #nextId = 1;
  readonly #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  readonly #handlers = new Map<string, Set<EventHandler>>();
  #onReady!: () => void;
  readonly #ready: Promise<void>;

  constructor(exePath?: string) {
    this.#ready = new Promise((res) => {
      this.#onReady = res;
    });
    this.#proc = Bun.spawn({
      cmd: [resolveHostExe(exePath)],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    });
    this.#reader = this.#proc.stdout.getReader();
    void this.#pump();
  }

  get pid(): number {
    return this.#proc.pid;
  }

  ready(): Promise<void> {
    return this.#ready;
  }

  async #pump(): Promise<void> {
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { value, done } = await this.#reader.read();
      if (done) {
        break;
      }
      this.#buffer += this.#decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = this.#buffer.indexOf("\n")) >= 0) {
        const line = this.#buffer.slice(0, nl);
        this.#buffer = this.#buffer.slice(nl + 1);
        if (line.trim().length > 0) {
          this.#handle(JSON.parse(line) as Incoming);
        }
      }
    }
  }

  #handle(msg: Incoming): void {
    if (msg.type === "ready") {
      this.#onReady();
    } else if (msg.type === "result") {
      const pending = this.#pending.get(msg.id);
      if (pending) {
        this.#pending.delete(msg.id);
        if (msg.ok) {
          pending.resolve(msg.value);
        } else {
          pending.reject(new Error(msg.error ?? "xaml host error"));
        }
      }
    } else {
      const set = this.#handlers.get(msg.event);
      if (set) {
        for (const handler of set) {
          handler({ event: msg.event, name: msg.name, value: msg.value });
        }
      }
    }
  }

  #send(cmd: string, extra: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.#nextId++;
    const promise = new Promise<unknown>((res, rej) => {
      this.#pending.set(id, { resolve: res, reject: rej });
    });
    this.#proc.stdin.write(this.#encoder.encode(JSON.stringify({ id, cmd, ...extra }) + "\n"));
    void this.#proc.stdin.flush();
    return promise;
  }

  // Subscribe to a control event ("click", "toggle", "text"). Returns an unsubscribe fn.
  on(event: string, handler: EventHandler): () => void {
    let set = this.#handlers.get(event);
    if (!set) {
      set = new Set();
      this.#handlers.set(event, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  async setContent(xaml: string): Promise<void> {
    await this.#send("setContent", { xaml });
  }

  async setText(name: string, value: string): Promise<void> {
    await this.#send("setText", { name, value });
  }

  async getText(name: string): Promise<string> {
    return String(await this.#send("getText", { name }));
  }

  async setTitle(title: string): Promise<void> {
    await this.#send("setTitle", { title });
  }

  async resize(w: number, h: number): Promise<void> {
    await this.#send("resize", { w, h });
  }

  async ping(): Promise<string> {
    return String(await this.#send("ping"));
  }

  dispose(): void {
    this.#proc.kill();
  }
}
