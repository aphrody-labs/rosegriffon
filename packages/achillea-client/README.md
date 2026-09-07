# @achillea/client

Versioned HTTP client and runtime Zod contracts for Achillea's guild API. It is
ESM-only and uses the Fetch API, so the transport can run in Bun, modern Node,
browsers, or edge runtimes.

## Versioning

The stable root export currently points to contract `v1`. Import the versioned
entry point when the response shape must not change during a dependency update:

```ts
import { createAchilleaClient } from "@achillea/client/v1";
```

The package version follows SemVer. A breaking change to endpoint paths, result
envelopes, or schema outputs requires a new contract entry point.

## Endpoints

| Method | Path                   | Client method   | Runtime schema              |
| ------ | ---------------------- | --------------- | --------------------------- |
| GET    | `/guilds?page=&limit=` | `listGuilds`    | `achilleaGuildPageSchema`   |
| GET    | `/guilds/stats`        | `getGuildStats` | `achilleaGuildStatsSchema`  |
| GET    | `/guilds/:id`          | `getGuild`      | `achilleaGuildDetailSchema` |

`listGuilds` uses the `{ data, meta }` pagination envelope. Stats and guild
details are direct response objects. Nullable fields remain nullable; absent
role/channel fields with API defaults are normalized by their Zod schemas.

## Usage

```ts
import { createAchilleaClient } from "@achillea/client/v1";

const client = createAchilleaClient({
	baseUrl: "https://ranked.rosegriffon.fr/api",
	timeoutMs: 8_000,
});

const result = await client.getGuild("123456789012345678");
if (!result.ok) {
	console.error(result.kind, result.detail);
} else {
	console.info(result.value.name);
}
```

Calls never throw for expected transport or contract failures. Failures use the
`unreachable`, `http`, `invalid_json`, or `invalid_response` kinds. Successful
responses have already been validated and normalized by Zod.
