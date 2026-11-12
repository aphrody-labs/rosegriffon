# syntax=docker/dockerfile:1.7
# SPDX-License-Identifier: Apache-2.0
#
# steam-depot: static musl `bun-steam-depot` (crates/bun-steam, feature `depot`) on Alpine.
# Replaces Valve steamcmd for our use: one interactive `login`, then unattended `update`/`verify`
# of the Windows depots of an app into /game.
#
# Build context: the rosegriffon repository root.
#   docker build -f infra/docker/steam-depot/Dockerfile -t rosegriffon/steam-depot .
#
# Runtime contract (compose service `steam-depot`, profile `tools`):
#   /steam  <- /srv/rosegriffon/steam      STEAM_HOME, token file steam-tokens.json (0600), dir 0700
#   /game   <- /srv/rosegriffon/game/ievr  STEAM_INSTALL_DIR
# No credential is baked into the image or passed as a build argument.

ARG ALPINE_VERSION=3.23

FROM rust:alpine AS builder
RUN apk add --no-cache musl-dev build-base perl pkgconf linux-headers
WORKDIR /src
COPY . .
# rust-toolchain.toml pins the channel; rustup installs it on first use.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/src/target \
    rustup target add x86_64-unknown-linux-musl \
 && RUSTFLAGS="-C target-feature=+crt-static" cargo build --release --locked \
      -p bun-steam --features depot --bin bun-steam-depot \
      --target x86_64-unknown-linux-musl \
 && install -Dm755 target/x86_64-unknown-linux-musl/release/bun-steam-depot /out/bun-steam-depot

FROM alpine:${ALPINE_VERSION} AS runtime
RUN apk add --no-cache ca-certificates tini \
 && addgroup -g 1000 steam \
 && adduser -D -u 1000 -G steam -h /steam steam \
 && mkdir -p /game \
 && chown steam:steam /game \
 && chmod 700 /steam
COPY --from=builder /out/bun-steam-depot /usr/local/bin/bun-steam-depot
COPY --chmod=755 infra/docker/steam-depot/entrypoint.sh /usr/local/bin/steam-depot
ENV STEAM_HOME=/steam \
    STEAM_INSTALL_DIR=/game \
    STEAM_APP_ID=2799860 \
    STEAM_PLATFORM=windows \
    STEAM_TOKEN_STORE=file
USER steam:steam
WORKDIR /game
VOLUME ["/steam", "/game"]
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/steam-depot"]
CMD ["update"]
