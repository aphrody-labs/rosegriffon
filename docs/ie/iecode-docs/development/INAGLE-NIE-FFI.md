# Current Inagle, NIE and IECODE native boundary

Source authority: `crates/nie/aphrody-nie-ffi/src/lib.rs`, its `iecode` cdylib
manifest, `crates/nie/aphrody-nie-formats/src/lib.rs` and
`packages/inagle/src/ffi/nie.ts`. Retained NIE/RG documents describe historical
checkouts; current source and root manifests determine the executable contract.

## Ownership

- NIE Rust owns parsers, virtual filesystems, saves, simulation and C ABI.
- Inagle owns Bun bindings and the documented pure byte/CRC/PRNG fallbacks.
- Azalée and RG consume producer exports. Browser-safe entrypoints must not
  import `bun:ffi`, host CDP or native loader modules.
- Aphrody owns shared Web/CDP acquisition and Infra deployment. IECODE packages
  are consumed from private archives at the commit pinned by the consumer;
  there are no sibling Bun workspace members in Aphrody.

## Memory and ABI

`NieBytes` is `#[repr(C)]` with a pointer, `usize len` and `usize cap`.
The existing Bun bridge uses a 24-byte slot on 64-bit hosts. Call `_out`
variants rather than passing the aggregate by value. Borrow input buffers for
one call, copy dynamic output before freeing it, and release each Rust allocation
exactly once through `nie_bytes_free_fields`. Static C strings, including
version and format names, are borrowed and must not be freed. Handles use their
matching `_free` function. The ABI has per-function null/empty/sentinel behavior;
consult `nie_last_error_out` rather than assuming universal integer statuses.

Set `IECODE_LIB_PATH` to the intended compiled library when package installation
places source under an archive/cache path. Loader availability and diagnostics
are exposed by `isNativeAvailable`, `getNativeLibraryPath` and
`getNativeLoadError`. No native binary is bundled by producer archive preparation.

## Formats and evidence

The 28 standard VFS IDs are stable (G4TX=1, cfg.bin=11, CPK=14,
CRILAYLA=22, LIVE=28). The Rust source additionally defines HCA=29,
p3lip=30 and DXBC=31; the retained 28-format TypeScript catalog is not the full
extended native catalog. CPK has an exact `CPK ` prefix and CRILAYLA an exact
eight-byte `CRILAYLA` prefix. A probe recognizes a signature, not the validity
of a complete file. Native descriptor calls remain distinct from source fallback
helpers; tests requiring native symbols skip explicitly when the library is absent.

## Qualification

Run producer typechecks, Inagle/Azalée build projects and scoped byte-contract,
FFI, VFS and crawl regression tests. Native qualification additionally requires
the compiled Rust library and real supported fixtures through the integrating
agent's serialized Cargo workflow. The current source-only gates do not prove
native, browser, .NET or five-runtime parity. Protected game inputs and databases
must never be fabricated, copied into Git or mutated to satisfy a test.
