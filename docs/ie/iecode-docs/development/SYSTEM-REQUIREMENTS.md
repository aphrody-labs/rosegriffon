# IECODE System Requirements & Setup Guide

This guide records toolchain contracts and setup recipes. The Linux package example targets Ubuntu 24.04; Debian package names and repositories differ. These recipes have not been validated as a complete installation on fresh Windows, Linux, or Docker hosts. Target-specific SDKs and graphics drivers may require additional setup.

Keep the maintained Aphrody checkout at `../aphrody`: root Cargo dependencies reference that sibling directly. `APHRODY_ROOT` selects shared operations and does not rewrite Cargo paths. See the [workspace guide](WORKSPACE.md).

---

## 1. Version Matrix

| Runtime / Tool       | Version                                                     | Canonical Source                                   | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| **Bun**              | `>= 1.4.2`                                                  | `curl -fsSL https://bun.sh/install \| bash`        | TypeScript workspaces, Inagle CLI, Azalée, Web frontend     |
| **Rust**             | Toolchain `1.98.1`; workspace MSRV `1.97`, edition 2024     | [`rust-toolchain.toml`](../../rust-toolchain.toml) | Emulation cores (`crates/emu`), NIE formats, graphics forks |
| **wasm-bindgen-cli** | `0.2.128`                                                   | `cargo install wasm-bindgen-cli --version 0.2.128` | Browser WebGPU/WASM builds for DS & Wii                     |
| **Python**           | `>= 3.10`                                                   | [`pyproject.toml`](../../pyproject.toml)           | Reverse engineering scripts, VFS tooling, `niepy`           |
| **TypeScript / Oxc** | Catalog TypeScript `7.0.2`, Oxlint `1.85.0`, Oxfmt `0.70.0` | [`package.json`](../../package.json)               | Semantic checking, lint and format                          |
| **Astral uv**        | `0.12.17`                                                   | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | Hermetic Python environment and lockfile sync               |
| **.NET SDK**         | `10.0.102`, `latestMinor` roll-forward                      | [`global.json`](../../global.json)                 | Managed Core, `IECODE.Ffi` (NativeAOT), C# CLI              |
| **CMake**            | `>= 3.25`                                                   | [`CMakePresets.json`](../../CMakePresets.json)     | C++20 build presets                                         |
| **Ninja**            | `>= 1.11`                                                   | APT / winget                                       | Fast native compilation                                     |
| **C++ Compiler**     | GCC 13+ / Clang 18+ / MSVC v143+                            | System package                                     | C++20 / C17 native libraries and tests                      |
| **vcpkg**            | Git checkout with manifest baseline                         | `git clone https://github.com/microsoft/vcpkg.git` | C++ package manager                                         |
| **7-Zip**            | `7z` executable                                             | `p7zip-full` / `7z`                                | High-ratio archive compression (`docs.7z`)                  |

---

## 2. Debian / Ubuntu (Bare Metal, WSL2, or VM)

### 2.1 System Packages (Ubuntu 24.04 APT)

```sh
sudo apt-get update && sudo apt-get install -y \
  ca-certificates \
  build-essential \
  g++-13 \
  clang-18 \
  clang-format \
  cmake \
  ninja-build \
  pkg-config \
  git \
  curl \
  wget \
  unzip \
  tar \
  p7zip-full \
  zstd \
  libgtest-dev \
  libasound2-dev \
  libudev-dev \
  libvulkan-dev \
  vulkan-tools \
  libx11-dev \
  libxcursor-dev \
  libxi-dev \
  libxrandr-dev \
  libxinerama-dev \
  libwayland-dev \
  wayland-protocols \
  libxkbcommon-dev \
  libgl1-mesa-dev \
  libegl1-mesa-dev \
  libfontconfig1-dev
```

### 2.2 Toolchains Installation

On Ubuntu 24.04, use the Ubuntu feed for .NET 10; the Microsoft Ubuntu feed does not provide .NET packages. Follow [Microsoft’s Ubuntu installation guide](https://learn.microsoft.com/en-us/dotnet/core/install/linux-ubuntu-install#ubuntu-2404) for current availability. For Debian, follow the separate [Debian guide](https://learn.microsoft.com/en-us/dotnet/core/install/linux-debian).

```sh
# 1. Bun
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# 2. Rust & WebAssembly Target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.98.1
source "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128 --locked
cargo install cargo-nextest --locked

# 3. Astral uv (Python)
curl -LsSf https://astral.sh/uv/0.12.17/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# 4. .NET 10 SDK (Ubuntu 24.04 distribution feed)
sudo apt-get update && sudo apt-get install -y dotnet-sdk-10.0

# 5. vcpkg
git clone https://github.com/microsoft/vcpkg.git "$HOME/vcpkg"
"$HOME/vcpkg/bootstrap-vcpkg.sh" -disableMetrics
export VCPKG_ROOT="$HOME/vcpkg"
export PATH="$VCPKG_ROOT:$PATH"
```

---

## 3. Windows 11 setup recipe

### 3.1 Package Installation via Winget

Open PowerShell as Administrator:

```powershell
# 1. Core Build Tools & Git
winget install Git.Git --source winget
winget install 7zip.7zip --source winget
winget install Kitware.CMake --source winget
winget install Ninja-build.Ninja --source winget

# 2. Visual Studio 2022 Community / Build Tools
# Ensure workloads: "Desktop development with C++" (MSVC v143, Windows 11 SDK)
winget install Microsoft.VisualStudio.2022.Community --override "--add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --includeRecommended --passive"

# 3. .NET 10 SDK
winget install Microsoft.DotNet.SDK.10 --source winget

# 4. Vulkan SDK (for WGPU hardware acceleration)
winget install LunarG.VulkanSDK --source winget
```

### 3.2 Toolchains Setup (PowerShell)

```powershell
# 1. Bun for Windows
powershell -c "irm bun.sh/install.ps1 | iex"

# 2. Rust
winget install Rustlang.Rustup
rustup toolchain install 1.98.1
rustup default 1.98.1
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128 --locked
cargo install cargo-nextest --locked

# 3. Astral uv
powershell -c "irm https://astral.sh/uv/0.12.17/install.ps1 | iex"

# 4. vcpkg
git clone https://github.com/microsoft/vcpkg.git C:\vcpkg
C:\vcpkg\bootstrap-vcpkg.bat -disableMetrics
[Environment]::SetEnvironmentVariable("VCPKG_ROOT", "C:\vcpkg", "User")
```

---

## 4. Docker / Minimal POSIX Unix Container

Candidate build image, not a verified clean-install result. Mount both checkouts as `/workspace/iecode` and `/workspace/aphrody`. Browser checks additionally need a selected Chromium executable; graphics execution requires appropriate host GPU/display access.

```dockerfile
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    RUSTUP_HOME=/opt/rust \
    CARGO_HOME=/opt/rust \
    VCPKG_ROOT=/opt/vcpkg \
    PATH=/opt/rust/bin:/root/.bun/bin:/root/.local/bin:/opt/vcpkg:$PATH

# System packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential g++-13 clang-18 cmake ninja-build pkg-config \
    git curl wget unzip tar p7zip-full zstd libgtest-dev clang-format \
    libasound2-dev libudev-dev libvulkan-dev libx11-dev libwayland-dev \
    libxkbcommon-dev libgl1-mesa-dev libegl1-mesa-dev libfontconfig1-dev \
    libxcursor-dev libxi-dev libxrandr-dev libxinerama-dev wayland-protocols \
    ca-certificates dotnet-sdk-10.0 \
    && rm -rf /var/lib/apt/lists/*

# Bun
RUN curl -fsSL https://bun.sh/install | bash

# Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.98.1 \
    && rustup target add wasm32-unknown-unknown \
    && cargo install wasm-bindgen-cli --version 0.2.128 --locked \
    && cargo install cargo-nextest --locked

# uv (Python)
RUN curl -LsSf https://astral.sh/uv/0.12.17/install.sh | sh

# vcpkg
RUN git clone --depth 1 https://github.com/microsoft/vcpkg.git /opt/vcpkg \
    && /opt/vcpkg/bootstrap-vcpkg.sh -disableMetrics

WORKDIR /workspace/iecode
```

---

## 5. Bootstrapping and Launching the Monorepo

The wasm-bindgen CLI must match the version resolved in [`Cargo.lock`](../../Cargo.lock), currently `0.2.128`. Rust is pinned by [`rust-toolchain.toml`](../../rust-toolchain.toml), rather than the moving `stable` channel. Run these commands from the repository root with the Aphrody sibling checkout present:

```sh
# 1. Install workspace dependencies
bun install --frozen-lockfile
uv sync
dotnet restore IECODE.sln

# 2. Run verification gates
# Unpack first when docs are available only as docs.7z
bun run docs:unpack
bun run check:workspace
bun run typecheck
bun run docs:check

# 3. Launch Applications & CLIs
# Inagle CLI (TypeScript)
bun run packages/inagle/src/cli.ts --help

# niepy CLI (Python)
uv run --package niepy python -m niepy --help

# Dust DS Headless CLI (Rust)
cargo run -p aphrody-dust-cli --bin dust -- --help

# Web Application (WebGPU DS & Wii Canvases)
bun run build:web
bun run --cwd apps/web start
```

## CI shared checkout

CI checks out IECODE into `iecode/` and its shared owner into sibling `aphrody/`.
The repository secret `APHRODY_CHECKOUT_TOKEN` grants read access to the
repository selected by `workspace.manifest.json`'s `operations.repository`
(currently `aphrody-labs/aphrody`). The shared setup action reads the exact
40-character `operations.revision` pin from that manifest and verifies required
owner paths. Credentials are not persisted. Publish owner changes before
updating this pin; local sibling gates do not prove a clean GitHub runner build.
The active IECODE repository is `aphrody-labs/iecode`; commit identity remains
`aphrody-code <contact@aphrody.com>`.

The distribution workflow builds artifacts. Production deployment remains owned
by Aphrody Infra; its preview/production input labels do not publish a service.
