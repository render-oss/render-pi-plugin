# Render MCP Troubleshooting

## Connection Errors

### "MCP server not found" or tool not available

**Cause:** MCP server not configured in the AI tool.

**Fix:** Follow the current setup and verification workflow in [render-access.md](render-access.md).

### "Connection refused" or timeout

**Cause:** Network issue or incorrect URL.

**Fix:** Confirm the current endpoint and transport using [render-access.md](render-access.md), check internet connectivity, and account for corporate firewalls that might block MCP connections.

### "Transport error" or "SSE not supported"

**Cause:** Using the wrong transport or URL.

**Fix:** Reconfigure the client from the current MCP documentation fetched through [render-access.md](render-access.md).

## Authentication Errors

### "Unauthorized" or 401

**Cause:** Missing or expired OAuth authorization (plugin setup), or a missing, invalid, or expired API key (manual setup).

**Fix:** For OAuth, reconnect the Render plugin or connector and complete authorization again. For manual setup, create a new key at `https://dashboard.render.com/u/settings#api-keys`, replace the configured bearer token, restart the client, and verify with `list_services()`. In Claude Code, run `claude mcp remove render`, then re-add it with the manual setup command in `SKILL.md`.

### "Forbidden" or 403

**Cause:** OAuth authorization or API key doesn't have access to the requested resource, or wrong workspace.

**Fix:** Verify the intended workspace and confirm that the authenticated account has access to it, following [render-access.md](render-access.md).

## Tool-Specific Issues

Use the current client-specific setup instructions fetched through [render-access.md](render-access.md). Also check these local failure modes:

### Cursor

- Config file: `~/.cursor/mcp.json`
- Must be valid JSON (no trailing commas)
- Restart Cursor fully after config changes (not just reload window)
- If multiple MCP servers are configured, ensure the `render` key is unique

### Claude Code

- Confirm the configured server appears in the client's MCP server list.
- Replace a stale manual setup with `claude mcp remove render`, then re-add it with the manual setup command in `SKILL.md`.

### Codex

- If the MCP configuration uses `RENDER_API_KEY`, it must be set in the shell or environment where Codex starts.
- Restart Codex after changing its MCP configuration or credential environment.

## Workspace Issues

### "No workspace selected"

**Fix:** Follow the workspace-selection workflow in [render-access.md](render-access.md).

### Operations return empty results

**Cause:** Active workspace has no services, or wrong workspace is selected.

**Fix:** Call `get_selected_workspace()` to inspect the active workspace and `list_workspaces()` to find the intended one. Verify credential access before concluding that no resources exist.

## MCP vs CLI Fallback

Use the supported fallback selection in [render-access.md](render-access.md), then inspect the current CLI or MCP capability surface instead of relying on a fixed comparison table.
