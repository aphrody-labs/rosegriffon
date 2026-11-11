# aphrody-nie-asm

Pure Rust x86-64 assembler for the MSVC encoding dialect, including address-aware branch/RIP operands and a strict text parser. This supports static reconstruction and byte-for-byte comparison of recovered functions. It does not execute assembled code.

```rust
use aphrody_nie_asm::{Insn, Reg, encode};
assert_eq!(encode(&[Insn::MovRegImm8(Reg::Rax, 1), Insn::Ret]), [0xb0, 0x01, 0xc3]);
```

The crate is `no_std` + `alloc` friendly. The upstream source is subject to the license text in `LICENSE`.
