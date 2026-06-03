// Drive the WinClean WinUI 3 app (src/Winclean.Ui) from Bun.
//
// Why a separate process and not in-process: WinUI 3 XAML requires a
// `UseWinUI=true` project (the XAML compiler generates the metadata provider)
// plus a dedicated UI thread with a DispatcherQueue and message pump. It cannot
// be hosted inside Bun's event-loop thread, and Microsoft's own JS+WinUI
// pattern is the inverse (a WinUI app embedding libnode), not a JS host loading
// WinUI. So the supported, robust path is: launch the real WinUI 3 app as its
// own process and control its top-level window via Win32 (bun:ffi / user32).

import { dlopen, FFIType, type Pointer } from "bun:ffi";
import { resolve } from "node:path";

const WM_CLOSE = 0x0010;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;

// ShowWindow nCmdShow values.
export const SW = {
  HIDE: 0,
  NORMAL: 1,
  MAXIMIZE: 3,
  SHOW: 5,
  MINIMIZE: 6,
  RESTORE: 9,
} as const;

const WINUI_WINDOW_CLASS = "WinUIDesktopWin32WindowClass";

const user32 = dlopen("user32.dll", {
  FindWindowW: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
  FindWindowExW: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
  GetWindowThreadProcessId: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.u32 },
  IsWindowVisible: { args: [FFIType.ptr], returns: FFIType.bool },
  IsWindow: { args: [FFIType.ptr], returns: FFIType.bool },
  ShowWindow: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.bool },
  SetForegroundWindow: { args: [FFIType.ptr], returns: FFIType.bool },
  SetWindowPos: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.u32],
    returns: FFIType.bool,
  },
  PostMessageW: { args: [FFIType.ptr, FFIType.u32, FFIType.u64, FFIType.i64], returns: FFIType.bool },
  GetWindowTextW: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
}).symbols;

function toWide(text: string): Uint16Array {
  const encoded = new Uint16Array(text.length + 1);
  for (let i = 0; i < text.length; i++) {
    encoded[i] = text.charCodeAt(i);
  }
  encoded[text.length] = 0;
  return encoded;
}

function repoRoot(): string {
  // Winclean.Ui lives in the parent winclean repo (3 levels up from the fork).
  const env = Bun.env.WINCLEAN_ROOT;
  return env && env.length > 0 ? env : resolve(import.meta.dir, "..", "..", "..");
}

const TFM_RID = "net10.0-windows10.0.26100.0/win-x64";

// Locate Winclean.Ui.exe: explicit override → Debug → Release publish → Release.
export function resolveUiExe(override?: string): string {
  if (override && Bun.file(override).size > 0) {
    return override;
  }
  const root = repoRoot();
  const candidates = [
    `src/Winclean.Ui/bin/Debug/${TFM_RID}/Winclean.Ui.exe`,
    `src/Winclean.Ui/bin/Release/${TFM_RID}/publish/Winclean.Ui.exe`,
    `src/Winclean.Ui/bin/Release/${TFM_RID}/native/Winclean.Ui.exe`,
    `src/Winclean.Ui/bin/Release/${TFM_RID}/Winclean.Ui.exe`,
  ];
  for (const rel of candidates) {
    const full = resolve(root, rel);
    if (Bun.file(full).size > 0) {
      return full;
    }
  }
  throw new Error(
    "Winclean.Ui.exe not found. Build it: dotnet build src/Winclean.Ui -c Debug",
  );
}

export function launch(opts?: { exePath?: string }): Bun.Subprocess {
  const exe = resolveUiExe(opts?.exePath);
  return Bun.spawn({ cmd: [exe], stdout: "ignore", stderr: "ignore" });
}

// Poll for the top-level window by title until it appears or the timeout hits.
export async function findWindow(title = "WinClean", timeoutMs = 15_000, pollMs = 200): Promise<Pointer | null> {
  // Keep the UTF-16 buffer in a live binding and pass it directly: bun:ffi pins
  // a TypedArray for the call's duration. Passing a bare ptr() would dangle once
  // the backing array is GC'd → segfault.
  const name = toWide(title);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const hwnd = user32.FindWindowW(null, name) as Pointer | null;
    if (hwnd) {
      return hwnd;
    }
    if (Date.now() >= deadline) {
      return null;
    }
    // Sequential by design: we poll the OS for the window, no parallelism to gain.
    // eslint-disable-next-line no-await-in-loop
    await Bun.sleep(pollMs);
  }
}

function pidOf(hwnd: Pointer): number {
  const out = new Uint32Array(1);
  user32.GetWindowThreadProcessId(hwnd, out);
  return out[0] ?? 0;
}

// Robustly find the window OWNED BY a given process — immune to leftover
// instances that share the title. WinUI 3 top-level windows use a fixed class,
// so we enumerate that class with FindWindowExW and match the owning PID.
export async function findWindowForPid(
  pid: number,
  timeoutMs = 15_000,
  pollMs = 200,
  className = WINUI_WINDOW_CLASS,
): Promise<Pointer | null> {
  const cls = toWide(className);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let prev: Pointer | null = null;
    for (;;) {
      const hwnd = user32.FindWindowExW(null, prev, cls, null) as Pointer | null;
      if (!hwnd) {
        break;
      }
      if (pidOf(hwnd) === pid && user32.IsWindowVisible(hwnd)) {
        return hwnd;
      }
      prev = hwnd;
    }
    if (Date.now() >= deadline) {
      return null;
    }
    // Sequential by design: polling the OS for the window to appear.
    // eslint-disable-next-line no-await-in-loop
    await Bun.sleep(pollMs);
  }
}

export function isAlive(hwnd: Pointer): boolean {
  return user32.IsWindow(hwnd);
}

export function getTitle(hwnd: Pointer): string {
  const buffer = new Uint16Array(512);
  const length = user32.GetWindowTextW(hwnd, buffer, buffer.length);
  // Decode the UTF-16 code units directly (avoids a TextDecoder label dependency).
  return String.fromCharCode(...buffer.subarray(0, length));
}

export function show(hwnd: Pointer, cmd: number = SW.RESTORE): boolean {
  return user32.ShowWindow(hwnd, cmd);
}

export function bringToFront(hwnd: Pointer): boolean {
  user32.ShowWindow(hwnd, SW.RESTORE);
  return user32.SetForegroundWindow(hwnd);
}

export function move(hwnd: Pointer, x: number, y: number, width: number, height: number): boolean {
  return user32.SetWindowPos(hwnd, null, x, y, width, height, SWP_NOZORDER | SWP_NOACTIVATE);
}

// Graceful close (lets the app run its shutdown), unlike killing the process.
export function close(hwnd: Pointer): boolean {
  return user32.PostMessageW(hwnd, WM_CLOSE, 0n, 0n);
}

// Convenience: spawn the app, wait for ITS window (matched by PID, not title),
// restore + bring it to front. Returns the process handle and the window.
export async function launchAndWait(
  opts?: { exePath?: string; timeoutMs?: number },
): Promise<{ proc: Bun.Subprocess; hwnd: Pointer }> {
  const proc = launch(opts);
  const hwnd = await findWindowForPid(proc.pid, opts?.timeoutMs ?? 15_000);
  if (!hwnd) {
    proc.kill();
    throw new Error("WinClean window did not appear before timeout");
  }
  show(hwnd, SW.RESTORE);
  bringToFront(hwnd);
  return { proc, hwnd };
}
