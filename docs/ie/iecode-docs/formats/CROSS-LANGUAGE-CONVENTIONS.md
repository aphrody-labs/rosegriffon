# Cross-Language Conventions: VFS Formats & Memory Architecture

> Architectural conventions for parsing, validating, and sharing Inazuma Eleven: Victory Road binary structures
> across Rust (`crates/nie/*`), Bun / TypeScript (`@rosegriffon/inagle`), C# .NET 10 (`IECODE.Core`), Python (`niepy`), and C/C++ (`src/iecode-cpp`).

---

## 1. Ground Rules & Memory Ownership

1. **Rust is the Authoritative Engine (`aphrody-nie-formats`, `libiecode.so`)**:
   - Complex decoders (CRILAYLA bitstream decompression, CRI position-XOR ciphers, RDBN schema resolution, BCn decoding) execute in Rust.
   - Cross-language bindings (.NET NativeAOT, Bun FFI, Python ctypes, C headers) act as thin, strongly-typed adapters.

2. **Standard Memory Management via `NieBytes`**:
   - Functions returning dynamic allocations across the C-ABI use a standard 24-byte struct `NieBytes`:
     \`\`\`c
     typedef struct {
     uint8_t* ptr; // 8 bytes (x86_64 pointer)
     size_t len; // 8 bytes (payload length)
     size_t cap; // 8 bytes (allocation capacity)
     } NieBytes;
     \`\`\`
   - Memory allocated by Rust is released exclusively via `nie_bytes_free(NieBytes bytes)` or `nie_bytes_free_fields(uint64_t ptr, uint64_t len, uint64_t cap)`.
   - Never release unmanaged pointers using foreign allocators (`free()`, `Marshal.FreeHGlobal()`, etc.).

3. **Endianness Rules**:
   - **Level-5 Native Formats** (`G4TX`, `G4MD`, `G4MG`, `G4SK`, `G4PK`, `RDBN`, `LIVE`): **Little-Endian**.
   - **CRI Middleware Containers** (`CPK`, `@UTF`, `@ACB`, `CRID` / USM): **Big-Endian**.
   - Cross-language consumers must use endian-safe accessors (`from_le_bytes` in Rust, `DataView.getUint32(offset, true)` in JS, `BinaryPrimitives.ReadUInt32LittleEndian` in C#, `struct.unpack("<I")` in Python).

4. **Discriminant Stability**:
   - Format identifiers are stable 1-indexed integers `1..28` matching `vfs-formats.json`.
   - `0` is strictly reserved for `Unknown` / unparsed files.

---

## 2. Cross-Language Consumer Contracts

### 2.1 Bun / TypeScript (`packages/inagle`)

\`\`\`typescript
import { Inagle } from "@rosegriffon/inagle";

// Direct typed detection and inspection
const format = Inagle.formats.detectFormat(buffer);
console.log(format.id, format.name, format.mimeType);

// Format schema inspection
const schema = Inagle.formats.getFormatSchema(format.id);
\`\`\`

### 2.2 C# .NET 10 (`IECODE.Core`)

\`\`\`csharp
using IECODE.Core.Formats;

VfsFormatDescriptor desc = VfsFormatConsumer.Detect(buffer);
if (desc.Id == VfsFormatId.G4tx) {
// Process G4TX container
}
\`\`\`

### 2.3 Python (`niepy`)

\`\`\`python
import niepy

fmt = niepy.detect_format(data_bytes)
print(f"Format: {fmt.name} ({fmt.extension}), Category: {fmt.category}")
\`\`\`

### 2.4 C / C++ (`src/iecode-cpp`)

\`\`\`c
#include <iecode/vfs_formats.h>

iecode_format_id_t id = iecode_format_detect_c(buffer, length);
const iecode_format_info_t* info = iecode_format_get_info(id);
printf("Detected %s (%s)\n", info->name, info->extension);
\`\`\`
