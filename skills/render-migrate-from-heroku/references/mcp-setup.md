# MCP Server Setup for Heroku to Render Migration

The Render MCP server is recommended for direct service creation and automated verification, but not required for the Blueprint path. The Heroku MCP server is optional — it enables automatic discovery of config vars, add-on plans, and dyno sizes.

## Render MCP Server (Recommended)

Follow [render-access.md](render-access.md) for the current hosted server, client setup, authentication, workspace selection, capability discovery, and fallback workflow. Verify Render access with a read-only operation before starting the migration.

## Heroku MCP Server (Optional)

The Heroku MCP server enables automatic discovery of config vars, add-on plans, and dyno sizes. If it's not configured, the migration skill still works — it reads local project files and asks you to provide config var values manually.

- Requires Heroku CLI v10.8.1+ installed globally
- `heroku mcp:start` uses existing CLI auth (no API key needed)
- Alternative: `npx -y @heroku/mcp-server` with `HEROKU_API_KEY` env var
- Source: [heroku-mcp-server](https://github.com/heroku/heroku-mcp-server)

Add to your MCP config alongside the Render server:

```json
{
  "mcpServers": {
    "heroku": {
      "command": "heroku",
      "args": ["mcp:start"]
    }
  }
}
```

## Verification

After configuring, test your connections:
- Ask: "List my Render services" — should return services via Render MCP (required)
- Ask: "List my Heroku apps" — should return apps via Heroku MCP (optional)

If Render MCP fails, troubleshoot it through [render-access.md](render-access.md). If Heroku MCP is not configured, the migration skill still works—it reads local project files and asks you to provide config var values manually.
