---
name: render-mcp
description: >-
  Connects and configures the Render MCP server for AI coding tools—setup per
  tool (Cursor, Claude Code, Codex), authentication, workspace selection,
  capability discovery, and troubleshooting. Use when MCP is not configured, list_services()
  fails, the user asks about Render MCP setup, or an action skill needs MCP
  but it's not connected yet.
  Trigger terms: MCP, Render MCP, list_services, MCP setup, MCP server,
  OAuth, API key, Bearer token, mcp.render.com, workspace selection.
license: MIT
compatibility: Render MCP server (hosted at mcp.render.com)
metadata:
  author: Render
  version: "1.0.0"
  category: operations
---

# Render MCP Server

The Render MCP server lets AI coding tools manage Render resources directly. This skill covers **setup**, **authentication**, **workspace selection**, **capability discovery**, and **troubleshooting**.

Action skills (render-deploy, render-debug, render-monitor) use MCP tools for their workflows. If MCP is not connected, set it up using this skill first.

Before configuring, troubleshooting, or using Render MCP, read `references/render-access.md` for the current server, authentication, workspace, capability-discovery, and fallback workflow.

## When to Use

- `list_services()` fails or MCP tools are unavailable
- First-time Render MCP setup for any AI tool
- User asks how to connect their AI tool to Render
- Switching workspaces or troubleshooting auth errors
- Discovering which MCP tools exist and what they do

## Current Setup and Capabilities

Follow `references/render-access.md` to fetch the current MCP documentation, configure the client, verify read-only access, select the intended workspace, and inspect the tools actually available. Do not rely on a memorized tool catalog.

If the user has not identified their AI tool, ask which tool they use before giving client-specific setup instructions. Prefer the official Render plugin or connector and its browser-based OAuth flow when available. For a manual API-key setup, create a key at `https://dashboard.render.com/u/settings#api-keys` and use the hosted endpoint `https://mcp.render.com/mcp`.

### Manual client setup

For Cursor, add this configuration to `~/.cursor/mcp.json`, restart Cursor, and verify the connection with `list_services()`:

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_API_KEY>"
      }
    }
  }
}
```

For Claude Code, add the server with:

```bash
claude mcp add --transport http render https://mcp.render.com/mcp --header "Authorization: Bearer <YOUR_API_KEY>"
```

Restart Claude Code and verify with `list_services()`. To replace a stale manual configuration, run `claude mcp remove render` before adding it again.

For Codex, follow the current OAuth or API-key configuration fetched through `references/render-access.md`. If the configuration obtains its bearer token from `RENDER_API_KEY`, that variable must be available in the environment where Codex starts; restart Codex after changing it.

### Empty results and workspace selection

MCP operations run against the active workspace. If `list_services()` connects successfully but returns no services, first call `get_selected_workspace()`, then `list_workspaces()` if the wrong workspace might be selected. Also verify that the credential or `RENDER_API_KEY` belongs to an account with access to the intended workspace. Do not diagnose the server URL as the primary problem when the MCP call itself succeeds.

## Troubleshooting

See `references/troubleshooting.md` for connection errors, auth failures, timeout issues, and tool-specific quirks.

## References

| Document | Contents |
|----------|----------|
| `references/render-access.md` | Current MCP and CLI access, authentication, workspace, capability-discovery, and authorization workflow |
| `references/troubleshooting.md` | Connection errors, auth failures, tool-specific issues, timeout handling |

## Related Skills

- **render-deploy** — Deploy flows using MCP tools
- **render-debug** — Debug failures using MCP logs and metrics
- **render-monitor** — Monitor health using MCP metrics
- **render-cli** — CLI alternative when MCP is unavailable

<!-- shared:documentation-retrieval -->
## Current documentation retrieval

Whenever this skill directs you to consult current Render documentation:

1. Retrieve the linked Markdown document directly with an available URL-fetching tool or HTTP client, such as `curl`. Do not substitute web-search summaries for the document.
2. Confirm that retrieval succeeded and returned the expected document, then read its contents. Saving a file or printing its path is not sufficient.
3. If the request fails or your tool cannot read the Markdown response, open and read the linked HTML version instead.
4. If neither version can be retrieved, disclose that the current reference is unavailable and follow any topic-specific fallback in the skill. Use bundled guidance only for stable constraints, and do not guess at changeable platform details.

When a task requires multiple references, apply this workflow to each one and distinguish the documents you verified from those that remain unavailable.
<!-- /shared:documentation-retrieval -->
