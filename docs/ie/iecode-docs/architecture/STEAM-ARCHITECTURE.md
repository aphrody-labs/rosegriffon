# Steam architecture

Current source ownership, checked on 2026-10-01. The NIE Steam implementation
is local to IECODE at `crates/nie/aphrody-nie-steam`; it is not owned by a sibling
`nie` checkout. The managed toolkit retains its compatibility implementation.

## Implemented boundaries

| Surface                    | Owner                                    | Boundary                                                                           |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Depot planning             | `aphrody-nie-steam::planning`            | Platform-neutral depot/manifest planning                                           |
| Steam acquisition          | `aphrody-nie-steam` host-feature modules | Resolver, token store, session and downloader using `steamroom`/`steamroom-client` |
| In-process Steam API model | `aphrody-nie-steam::emulator`            | Explicit game-domain API state; not evidence of authenticated Valve service access |
| NIE networking             | `crates/nie/aphrody-nie-net`             | Product networking owner; qualify each integrated caller separately                |
| Managed compatibility      | `src/IECODE/Core` Steam code             | Retained SteamKit2 and native import interfaces                                    |

Do not describe the presence of an API emulator as proof of complete multiplayer,
publisher SDK support, depot entitlement or game compatibility. Native and
managed consumers need measured migration and integration gates before a
reference implementation can be removed. Avoid adding another general binding
that duplicates an existing owner without a concrete missing capability.

## External inputs and qualification

Authentication remains in existing private configuration; secrets and licensed
Valve SDK material are not committed. Steam/Proton/Wine are external PC
integration runtimes, not Nintendo console cores. A source port does not
establish account authorization or protected online-launch support.

Future validation should cover authorized depot selection/download behavior,
token persistence errors, API-model behavior and native consumer parity. Source
history records prior porting work, while current manifests and modules define
ownership. Repository-wide release qualification remains separate from scoped
Steam tests and emulator browser smoke runs.
