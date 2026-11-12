# Persistent credentials (one-time setup)

No value below is ever committed. Only variable names live in `.env.example`.

## Steam (`bun-steam-depot`)

Steam has no identity federation for CM client logins (no GitHub, npm, crates.io or Cloudflare
OAuth linking). The only durable credential is the refresh token issued by one interactive
login. `bun-steam-depot` stores the refresh token, the account name and the steamid, never the
password. Every run renews the access token with `Authentication.GenerateAccessTokenForApp`
(renewal allowed) and writes a rotated refresh token back to the canonical store. It only asks
for a new login when Steam reports the token revoked or expired, with exit code 2.

One-time, on the VPS (password and Steam Guard typed by you on the TTY):

```sh
ssh -t vps docker compose -f /srv/rosegriffon/app/compose.yaml --profile tools run --rm steam-depot login <account>
ssh vps docker compose -f /srv/rosegriffon/app/compose.yaml --profile tools run --rm steam-depot update
ssh vps docker compose -f /srv/rosegriffon/app/compose.yaml --profile tools run --rm steam-depot auth status
```

Stores (`STEAM_TOKEN_STORE`):

| Kind         | Read                                     | Write on rotation                         |
| ------------ | ---------------------------------------- | ----------------------------------------- |
| `file`       | `$STEAM_HOME/steam-tokens.json` (0600)   | same file                                 |
| `env`        | `STEAM_USER` + `STEAM_REFRESH_TOKEN`     | read-only, rotation is logged as a warning |
| `cloudflare` | Workers KV value (`STEAM_TOKEN_KV_*`)    | same KV value                             |
| `github`     | `STEAM_REFRESH_TOKEN` injected by Actions | `gh secret set` (value on stdin)         |

Cloudflare Secrets Store values cannot be read back through the API, so the readable Cloudflare
store is a Workers KV namespace. Copy the token once to another store:

```sh
steam-depot auth export --to github      # needs gh auth on the host, STEAM_TOKEN_GH_REPO
steam-depot auth export --to cloudflare  # needs CLOUDFLARE_API_TOKEN with Workers KV edit
```

## Other registries

| Tool       | One-time command                         | Where it persists                          |
| ---------- | ---------------------------------------- | ------------------------------------------ |
| GitHub     | `gh auth login`                          | OS keyring                                 |
| Bun / npm  | `bun login` or `BUN_AUTH_TOKEN` env      | `~/.npmrc` (`//registry.npmjs.org/:_authToken`) |
| crates.io  | `cargo login`                            | `~/.cargo/credentials.toml`                |
| Cloudflare | `wrangler login` or `CLOUDFLARE_API_TOKEN` | `~/.wrangler/config` or the environment  |

## GitHub Actions

Repository secrets (Settings, Secrets and variables, Actions), set once with `gh secret set <NAME>`
(value on stdin):

- `STEAM_USER`, `STEAM_REFRESH_TOKEN`: consumed with `STEAM_TOKEN_STORE=github`, which reads the
  injected value and writes rotations back (the job needs a `GH_TOKEN` allowed to write secrets).
- `CARGO_REGISTRY_TOKEN`: `cargo publish` reads it directly.
- `NPM_TOKEN`: exposed as `NPM_CONFIG_TOKEN` / `BUN_AUTH_TOKEN` for `bun publish`.
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`: wrangler and the `cloudflare` token store.

```yaml
env:
  STEAM_TOKEN_STORE: github
  STEAM_USER: ${{ secrets.STEAM_USER }}
  STEAM_REFRESH_TOKEN: ${{ secrets.STEAM_REFRESH_TOKEN }}
  GH_TOKEN: ${{ secrets.SECRETS_WRITE_TOKEN }}
  CARGO_REGISTRY_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN }}
  BUN_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```
