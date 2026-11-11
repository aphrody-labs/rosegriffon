# aphrody-nie-app

Ports the NIE application state machine, menu input/rendering, roster, game-data DTOs, and headless presentation. This crate is shared by host frontends and carries no window or GPU backend.

```sh
cargo check -p aphrody-nie-app
```

The rendering state describes the local reconstruction; it does not assert that original game screens or gameplay have been reproduced exactly.
