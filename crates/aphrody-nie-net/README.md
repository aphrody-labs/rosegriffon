# aphrody-nie-net

Ports the Inazuma Eleven: Victory Road room, lobby, friends, competitive, tournament, and deterministic match-session models. The default `transport` feature adds Tokio/WebSocket client and server hosts; disable default features for only the protocol and in-memory models.

```sh
cargo check -p aphrody-nie-net
cargo check -p aphrody-nie-net --no-default-features
```
