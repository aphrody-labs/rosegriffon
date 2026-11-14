# Rust workspace recipes (clearing RUSTC_WRAPPER safely on Windows & Linux).

rustc_no_wrapper := if os() == "windows" { "$env:RUSTC_WRAPPER='';" } else { "RUSTC_WRAPPER=''" }

[private]
_cargo *args:
    {{rustc_no_wrapper}} cargo {{args}}

[group('rust')]
[doc("Check all Rust workspace crates without sccache wrapper.")]
rust-check *args:
    {{rustc_no_wrapper}} cargo check --workspace {{args}}

[group('rust')]
[doc("Run Rust workspace tests without sccache wrapper.")]
rust-test *args:
    {{rustc_no_wrapper}} cargo test --workspace {{args}}

[group('rust')]
[doc("Run cargo clippy across the Rust workspace.")]
rust-clippy *args:
    {{rustc_no_wrapper}} cargo clippy --workspace --all-targets {{args}}

[group('rust')]
[doc("Format or check formatting of Rust workspace crates.")]
rust-fmt *args:
    {{rustc_no_wrapper}} cargo fmt --all {{args}}
