# steam plugin

Knowledge and tools for the Steam ecosystem. It works from Claude Code (as a plugin), from
agy/Gemini and Codex (the skills are mirrored to `C:/src/.agents/skills/steam-*`, see the
monorepo `AGENTS.md`), and from any MCP client.

## Components

- `skills/`: steam-web-api, steam-auth, steam-ids-and-urls, steam-content-cdn,
  steam-client-windows, steam-linux-proton, steam-community-tools, steam-local-inspect.
- `agents/steam-expert.md`: deep debugging agent (Proton, depots, auth).
- `servers/steam-mcp.ts`: dependency-free MCP stdio server started with `bun run`. Tools:
  `web_api_call`, `store_appdetails`, `resolve_steamid`, `local_apps`, `read_vdf`,
  `app_paths`, `steamdb_link`.
- `scripts/steam-inspect.ts`: CLI over the same library (`lib/steam.ts`).

## Environment

- `STEAM_WEB_API_KEY` (optional): Web API key from https://steamcommunity.com/dev/apikey.
  Without it, `web_api_call` is limited to keyless methods and `resolve_steamid` resolves
  vanity names through the public community XML profile feed.
- `STEAM_PATH` (optional): Steam root override.

## Other MCP clients

```json
{
  "mcpServers": {
    "steam": {
      "command": "bun",
      "args": ["run", "<path>/plugins/steam/servers/steam-mcp.ts"]
    }
  }
}
```

Requires Bun 1.4 or newer. No npm dependencies. License: Apache-2.0 (see the repository `LICENSE-APACHE`).
