// Runtime + type machinery for the generated Win32 bindings (*.gen.ts).
// Hand-written; the .gen.ts files are produced by src/Winclean.Win32Gen.

import { dlopen, FFIType, type Pointer } from "bun:ffi";

export type FFICode =
  | "void" | "bool" | "i8" | "u8" | "i16" | "u16"
  | "i32" | "u32" | "i64" | "u64" | "f32" | "f64" | "ptr";

// Anything accepted as a pointer arg: raw address, TypedArray (auto-pinned), or null.
export type WinPtr = number | bigint | Pointer | ArrayBufferView | null;

type ArgTs<C extends FFICode> = C extends "ptr"
  ? WinPtr
  : C extends "bool"
    ? boolean
    : C extends "i64" | "u64"
      ? number | bigint
      : number;

type RetTs<C extends FFICode> = C extends "void"
  ? void
  : C extends "ptr"
    ? Pointer | null
    : C extends "bool"
      ? boolean
      : C extends "i64" | "u64"
        ? bigint
        : number;

export type Sig = { readonly a: readonly FFICode[]; readonly r: FFICode };

type Args<A extends readonly FFICode[]> = { [I in keyof A]: ArgTs<A[I]> };
type Fn<S extends Sig> = (...args: Args<S["a"]>) => RetTs<S["r"]>;
export type Module<S extends Record<string, Sig>> = { [K in keyof S]: Fn<S[K]> };

const FFI: Record<FFICode, FFIType> = {
  void: FFIType.void,
  bool: FFIType.bool,
  i8: FFIType.i8,
  u8: FFIType.u8,
  i16: FFIType.i16,
  u16: FFIType.u16,
  i32: FFIType.i32,
  u32: FFIType.u32,
  i64: FFIType.i64,
  u64: FFIType.u64,
  f32: FFIType.f32,
  f64: FFIType.f64,
  ptr: FFIType.ptr,
};

// Lazily binds each exported symbol on first access (per-symbol dlopen), so a
// module import never fails on APIs absent from the running OS — only an actual
// call to a missing export throws.
export function loadModule<const S extends Record<string, Sig>>(dll: string, sigs: S): Module<S> {
  const cache = new Map<string, CallableFunction>();
  return new Proxy({} as Module<S>, {
    get(_target, prop: string): CallableFunction {
      const existing = cache.get(prop);
      if (existing) {
        return existing;
      }
      const sig = sigs[prop];
      if (!sig) {
        throw new Error(`${dll}: no binding named '${prop}'`);
      }
      const lib = dlopen(dll, {
        [prop]: { args: sig.a.map((code) => FFI[code]), returns: FFI[sig.r] },
      });
      const fn = lib.symbols[prop] as CallableFunction;
      cache.set(prop, fn);
      return fn;
    },
  });
}
