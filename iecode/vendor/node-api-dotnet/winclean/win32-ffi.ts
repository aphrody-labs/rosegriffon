// Direct Win32 access from Bun via `bun:ffi` — no .NET/N-API rebuild required.
//
// This complements the curated [JSExport] surface re-exported from ./index.ts.
// That surface is hand-wrapped in C# and only grows with an AOT rebuild. This
// module instead binds *arbitrary* flat C exports from any system DLL at
// runtime, given a signature — so any kernel32/user32/etc. function with a
// C ABI is reachable from Bun immediately.
//
// Limits (inherent to flat FFI): C exports only — no COM/WinRT projections, no
// inline-macro APIs; struct in/out params go through pointers (TypedArrays).

import { CString, dlopen, FFIType, type Pointer, ptr, read } from "bun:ffi";

export { CString, dlopen, FFIType, ptr };
export type { Pointer };

export type Signature = {
  readonly args: readonly FFIType[];
  readonly returns: FFIType;
};

type FFIArg = number | bigint | boolean | Pointer | CString | ArrayBufferView | null;
type FFIReturn = number | bigint | boolean | Pointer | null;
export type NativeFunction = (...args: FFIArg[]) => FFIReturn;

// The "access to ALL flat Win32" escape hatch: bind any export by name +
// signature at runtime. Caller supplies the C ABI types via FFIType.
export function bind(dll: string, symbol: string, signature: Signature): NativeFunction {
  return dlopen(dll, { [symbol]: signature }).symbols[symbol] as NativeFunction;
}

// A useful, ready-to-use slice that is NOT in the N-API surface, demonstrating
// reach. Extend freely — or use bind()/dlopen() directly for anything else.
export const kernel32 = dlopen("kernel32.dll", {
  GetTickCount64: { args: [], returns: FFIType.u64 },
  GetCurrentProcessId: { args: [], returns: FFIType.u32 },
  GetLogicalDrives: { args: [], returns: FFIType.u32 },
  GetPhysicallyInstalledSystemMemory: { args: [FFIType.ptr], returns: FFIType.bool },
}).symbols;

export const user32 = dlopen("user32.dll", {
  GetSystemMetrics: { args: [FFIType.i32], returns: FFIType.i32 },
  GetDoubleClickTime: { args: [], returns: FFIType.u32 },
  GetCursorPos: { args: [FFIType.ptr], returns: FFIType.bool },
  GetDesktopWindow: { args: [], returns: FFIType.ptr },
}).symbols;

// Struct out-param example (POINT { LONG x; LONG y }): proves non-scalar APIs
// are reachable through pointer-backed TypedArrays.
export function getCursorPos(): { x: number; y: number } {
  const point = new Int32Array(2);
  const p = ptr(point);
  if (!user32.GetCursorPos(p)) {
    throw new Error("GetCursorPos failed");
  }
  // read.i32 reads native memory directly — faster than building a DataView,
  // and returns a number (no undefined / non-null assertion).
  return { x: read.i32(p, 0), y: read.i32(p, 4) };
}

// PULONGLONG out-param (total physical RAM in kilobytes).
export function getInstalledMemoryKb(): bigint {
  const out = new BigUint64Array(1);
  if (!kernel32.GetPhysicallyInstalledSystemMemory(ptr(out))) {
    throw new Error("GetPhysicallyInstalledSystemMemory failed");
  }
  return new DataView(out.buffer).getBigUint64(0, true);
}
