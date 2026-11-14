# Cross-Language Architecture: Bun, Rust NIE & C# IECODE.Core

> Technical design and implementation of the unified tri-runtime architecture powering IECODE.
> Bridges TypeScript / Bun, Rust C-ABI (`libiecode.so`), and .NET 10 NativeAOT (`IECODE.Ffi.so`).

---

## 1. Architecture Overview

```
+---------------------------------------------------------------------------------+
|                       USER INTERFACES & WORKSPACE CONSUMERS                     |
|  - CLI: `inagle <command>`                                                      |
|  - Web Application: external web consumers (separate repositories)                 |
|  - Shared Components: `packages/ieverse`                                       |
+---------------------------------------+-----------------------------------------+
                                        |
                   +--------------------+--------------------+
                   |                                         |
+------------------v------------------+   +------------------v------------------+
|           BUN FFI CLIENT            |   |         .NET NATIVEAOT / C-ABI      |
|    `packages/inagle/src/ffi/nie.ts`  |   |   `apps/iecode-dotnet/Ffi/bin/Release/net10.0/<RID>/publish` |
|   - Zero-copy buffer exchange       |   |   - CriFs CPK Container Engine      |
|   - Safe memory pointer unwrapping  |   |   - UnmanagedCallersOnly exports    |
|   - Multi-platform library loader   |   |   - Node-API JSExport layer         |
+------------------+------------------+   +------------------+------------------+
                   |                                         |
+------------------v-----------------------------------------v------------------+
|              RUST NIE ENGINE (crates/aphrody-nie-*)                            |
|                 C-ABI: `aphrody-nie-ffi` (Cargo target directory)             |
|   - `aphrody-nie-core`: CRC32 (reflected), Viola cipher, PRNG, endian IO       |
|   - `aphrody-nie-formats`: CRILAYLA SIMD decompressor, G4TX, G4MD, RDBN        |
|   - `aphrody-nie-save`: Lives save decryption (002AB8F4-* containers)        |
|   - `aphrody-nie-data`: In-game gamedata schemas, players, growth curves       |
|   - `aphrody-nie-wiki`: Relational SQLite database queries and drop tables   |
+-------------------------------------------------------------------------------+
```

---

## 2. ABI Contracts & Memory Management

### 2.1 Rust C-ABI (`libiecode.so`)
- **Symbol Prefix**: `nie_*`
- **Calling Convention**: System V AMD64 ABI (Linux) / Microsoft x64 ABI (Windows)
- **String Management**: Output strings allocated by Rust are freed via `nie_free_string(char* ptr)`.
- **Status Codes**: Functions return `0` on success, negative integers on error (`-1` Invalid Argument, `-2` Buffer Too Small, `-3` Corrupt Data).

### 2.2 .NET 10 NativeAOT (`IECODE.Ffi.so`)
- **Symbol Prefix**: `iecode_*`
- **Compiler**: `dotnet publish /p:PublishAot=true` producing self-contained native `.so` without external runtime dependency.
- **Node-API**: Compliant with Node.js N-API v8 and Bun native addon loader.

---

## 3. High-Performance TypeScript Usage

```typescript
import { Inagle } from "@aphrody/inagle";
import { nieCrc32, nieDecompressCrilayla, nieProbeHeader } from "@aphrody/inagle/ffi";
import { IecodeDotnet } from "@aphrody/inagle/dotnet";

// 1. Instant header probe
const probe = nieProbeHeader(rawBuffer);
console.log("Detected format:", probe.format);

// 2. High-speed SIMD CRILAYLA decompression
const decompressed = nieDecompressCrilayla(compressedBytes);

// 3. .NET CriFs CPK Extraction
await IecodeDotnet.extractCpk("data/packs/common.cpk", "dist/common");
```
