# Achillea web runtime configuration

The Angular production bundle contains no infrastructure endpoint or credential. `bun run build` generates `achillea-config.js` from public build variables. That file is loaded before Angular and can also be replaced or mounted at runtime without rebuilding the application.

Supported build variables:

| Variable                      | Browser field            | Constraint                                   |
| ----------------------------- | ------------------------ | -------------------------------------------- |
| `ACHILLEA_API_BASE_URL`       | `apiBaseUrl`             | HTTP(S) URL or root-relative path            |
| `ACHILLEA_SOCKET_URL`         | `socketUrl`              | HTTP(S)/WS(S) URL or root-relative path      |
| `ACHILLEA_SOCKET_PATH`        | `socketPath`             | Root-relative path; defaults to `/socket.io` |
| `ACHILLEA_COLYSEUS_URL`       | `colyseusUrl`            | WS(S) URL                                    |
| `ACHILLEA_CDN_BASE_URL`       | `cdnBaseUrl`             | HTTPS URL                                    |
| `SUPABASE_URL`                | `supabaseUrl`            | HTTPS URL                                    |
| `SUPABASE_PUBLISHABLE_KEY`    | `supabasePublishableKey` | Public browser key only                      |
| `SUPABASE_JWKS_URL`           | `supabaseJwksUrl`        | HTTPS URL                                    |
| `ACHILLEA_YOUTUBE_API_KEY`    | `youtubeApiKey`          | Public browser API key                       |
| `ACHILLEA_YOUTUBE_CHANNEL_ID` | `youtubeChannelId`       | Channel identifier                           |

No secret/service-role Supabase key is read or supported. URL fields reject localhost and literal IP hosts. With no variables, the generated production configuration is neutral (empty endpoint/public-key values).

The production build also normalizes localhost/loopback defaults embedded by browser dependencies to the reserved `invalid.invalid` hostname, then fails if any IP literal or supported secret signature remains in a text artifact.

For runtime injection, replace the built `achillea-config.js` with JavaScript assigning the same fields to `globalThis.__ACHILLEA_CONFIG__` before serving the application.
