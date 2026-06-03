// Full UI Automation control of a running WinUI 3 (or any UIA) app from Bun.
//
// Bun can't call System.Windows.Automation, so we spawn the JIT C# helper
// (src/Winclean.UiaBridge) and talk JSON over stdio: one request line in, one
// result line out. This drives real XAML controls — invoke buttons, read/set
// text, toggle switches, dump the control tree — by Name or AutomationId.

import { resolve } from "node:path";
import type { ReadableStreamDefaultReader } from "node:stream/web";

export type Selector = { name: string } | { automationId: string };

export type UiaElement = {
  name: string;
  automationId: string;
  controlType: string;
  enabled: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Response = { ok: true; result: unknown } | { ok: false; error: string };

export function resolveBridgeExe(override?: string): string {
  if (override && Bun.file(override).size > 0) {
    return override;
  }
  // The bridge project lives under ./tools/ inside the fork.
  const full = resolve(
    import.meta.dir,
    "tools/Winclean.UiaBridge/bin/Debug/net10.0-windows/Winclean.UiaBridge.exe",
  );
  if (Bun.file(full).size === 0) {
    throw new Error("Winclean.UiaBridge.exe not found. Build: dotnet build winclean/tools/Winclean.UiaBridge");
  }
  return full;
}

// A persistent bridge session: keeps one helper process alive for many commands.
export class UiaSession {
  readonly #proc: Bun.Subprocess<"pipe", "pipe", "inherit">;
  readonly #reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>;
  #buffer = "";
  readonly #decoder = new TextDecoder();
  readonly #encoder = new TextEncoder();

  constructor(exePath?: string) {
    this.#proc = Bun.spawn({
      cmd: [resolveBridgeExe(exePath)],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    });
    this.#reader = this.#proc.stdout.getReader();
  }

  async #send(request: Record<string, unknown>): Promise<unknown> {
    this.#proc.stdin.write(this.#encoder.encode(JSON.stringify(request) + "\n"));
    await this.#proc.stdin.flush();
    const line = await this.#readLine();
    const parsed = JSON.parse(line) as Response;
    if (!parsed.ok) {
      throw new Error(`UIA bridge: ${parsed.error}`);
    }
    return parsed.result;
  }

  async #readLine(): Promise<string> {
    for (;;) {
      const newline = this.#buffer.indexOf("\n");
      if (newline >= 0) {
        const line = this.#buffer.slice(0, newline);
        this.#buffer = this.#buffer.slice(newline + 1);
        return line;
      }
      // eslint-disable-next-line no-await-in-loop
      const { value, done } = await this.#reader.read();
      if (done) {
        throw new Error("UIA bridge closed unexpectedly");
      }
      this.#buffer += this.#decoder.decode(value, { stream: true });
    }
  }

  async ping(): Promise<string> {
    return (await this.#send({ cmd: "ping" })) as string;
  }

  async snapshot(hwnd: number, max = 200): Promise<UiaElement[]> {
    return (await this.#send({ cmd: "snapshot", hwnd, max })) as UiaElement[];
  }

  async invoke(hwnd: number, selector: Selector): Promise<void> {
    await this.#send({ cmd: "invoke", hwnd, ...selector });
  }

  async select(hwnd: number, selector: Selector): Promise<void> {
    await this.#send({ cmd: "select", hwnd, ...selector });
  }

  // Generic primary action (invoke/select/toggle/expand). Returns which pattern fired.
  async activate(hwnd: number, selector: Selector): Promise<string> {
    return (await this.#send({ cmd: "activate", hwnd, ...selector })) as string;
  }

  async getValue(hwnd: number, selector: Selector): Promise<string> {
    return (await this.#send({ cmd: "getValue", hwnd, ...selector })) as string;
  }

  async setValue(hwnd: number, selector: Selector, value: string): Promise<void> {
    await this.#send({ cmd: "setValue", hwnd, value, ...selector });
  }

  async toggle(hwnd: number, selector: Selector): Promise<string> {
    return (await this.#send({ cmd: "toggle", hwnd, ...selector })) as string;
  }

  dispose(): void {
    this.#proc.kill();
  }
}
