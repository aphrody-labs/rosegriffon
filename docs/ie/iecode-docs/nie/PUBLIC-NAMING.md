# Public naming contract

The public command is `nie`. The Rust package remains `aphrody-nie-cli` because it is an internal
workspace package, and the source module history may still contain the compatibility spelling
`nie`; neither is a public executable name.

| Surface             | Public name                                | Internal compatibility                      |
| ------------------- | ------------------------------------------ | ------------------------------------------- |
| Rust CLI executable | `nie` / `nie.exe`                          | package `aphrody-nie-cli`                   |
| Site service        | `nie-site`                                 | crate `nie-site`                            |
| Model service       | `aphrody-nie-model-serve`                  | crate `aphrody-nie-model-serve`             |
| CLI build recipe    | `cargo build -p aphrody-nie-cli --bin nie` | no second CLI binary                        |
| Repository root     | resolved by `NIE_REPO_ROOT`                | legacy `NIE_VPS_REPO` accepted by sync only |

Scripts must resolve the repository from their own location or `NIE_REPO_ROOT`; they must not
embed a checkout path. Game content is resolved from `NIE_GAME_DIR`. Deployment units use the
same variables through `/etc/nie/nie.env`. Existing historical prose and migration notes may
mention `nie`, but new public commands, manifests and release archives use `nie`.
