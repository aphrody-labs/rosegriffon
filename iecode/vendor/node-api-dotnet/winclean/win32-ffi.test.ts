import { expect, test } from "bun:test";
import { bind, FFIType, getCursorPos, getInstalledMemoryKb, kernel32, user32 } from "./win32-ffi";

test("bun:ffi reaches arbitrary flat Win32 exports", () => {
  // kernel32 functions absent from the N-API [JSExport] surface
  expect(kernel32.GetTickCount64()).toBeGreaterThan(0n);

  // Cross-check FFI against the JS runtime: same process, same PID
  expect(Number(kernel32.GetCurrentProcessId())).toBe(process.pid);

  // C: drive present (bit 2 of the GetLogicalDrives bitmask)
  const drives = Number(kernel32.GetLogicalDrives());
  expect(drives & (1 << 2)).toBeGreaterThan(0);

  // user32 scalar API
  expect(user32.GetSystemMetrics(0)).toBeGreaterThan(0); // SM_CXSCREEN

  // Struct out-param (POINT) — non-scalar APIs reachable via pointers
  const pos = getCursorPos();
  expect(Number.isFinite(pos.x)).toBe(true);
  expect(Number.isFinite(pos.y)).toBe(true);

  // PULONGLONG out-param: total installed RAM in KB
  expect(getInstalledMemoryKb()).toBeGreaterThan(0n);

  // Generic escape hatch: bind ANY export at runtime by name + signature
  const getDoubleClickTime = bind("user32.dll", "GetDoubleClickTime", {
    args: [],
    returns: FFIType.u32,
  });
  expect(Number(getDoubleClickTime())).toBeGreaterThan(0);
});
