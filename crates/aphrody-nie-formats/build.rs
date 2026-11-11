//! `textures-encode` pulls `intel_tex_2` (ISPC texture compressor, C++ objects). Its rlib does not
//! declare the C++ runtime, so on Linux every binary, test and example that links it failed with
//! rust-lld "undefined symbol: __gxx_personality_v0". Link the platform C++ runtime here.
fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    if std::env::var_os("CARGO_FEATURE_TEXTURES_ENCODE").is_none() {
        return;
    }
    let os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    match (os.as_str(), env.as_str()) {
        ("macos" | "ios" | "freebsd", _) => println!("cargo:rustc-link-lib=dylib=c++"),
        ("windows", "msvc") => {} // the MSVC linker pulls the C++ runtime itself
        ("android", _) => println!("cargo:rustc-link-lib=dylib=c++_shared"),
        ("linux" | "windows", _) => println!("cargo:rustc-link-lib=dylib=stdc++"),
        _ => {}
    }
}
