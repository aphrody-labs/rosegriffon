# aphrody-nie-save

Static IEVR save-file support: filename-derived CRC32/XOR decryption, Lives header and directory parsing, blob CRC validation, and structured read/edit/re-encrypt operations. The core works on byte slices; `io` provides local file helpers.

```rust
let container = aphrody_nie_save::parse(bytes, "002AB8F4-USERDATALIVE")?;
let encrypted = container.encrypt()?;
```

The parser checks the decrypted magic and header CRC before accepting a file. Real-save fixtures and mutating game/runtime integrations are not bundled. `serde` is optional.
