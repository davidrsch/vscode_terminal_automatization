# VS Code Terminal MCP

A VS Code extension that exposes an **MCP (Model Context Protocol) server** so AI assistants can **list, rename, navigate, create, close, split, and execute commands** in your VS Code terminals — using the real VS Code API, not browser automation.

## Why this extension?

No existing MCP server provides first-class terminal management inside VS Code. This extension bridges that gap by running an SSE-based MCP server directly inside the VS Code extension host, giving AI agents direct access to `vscode.window.terminals`.

## Tools

| Tool                    | Description                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `list_terminals`        | List all open terminals with index, name, active status, and shell integration availability |
| `get_active_terminal`   | Get info about the currently focused terminal                                               |
| `focus_terminal`        | Focus (show) a terminal by name or index                                                    |
| `create_terminal`       | Create a new terminal with optional name, cwd, and shell path                               |
| `rename_terminal`       | Rename a terminal by name or index                                                          |
| `close_terminal`        | Close (dispose) a terminal by name or index                                                 |
| `send_text_to_terminal` | Send text/command to a terminal, optionally pressing Enter                                  |
| `split_terminal`        | Split a terminal pane from an existing terminal                                             |
| `run_command`           | Run a shell command and capture output (requires shell integration, VS Code 1.93+)          |

## Installation

### From VS Code Marketplace

Search for **"VS Code Terminal MCP"** in the Extensions view (`Ctrl+Shift+X`).

### From VSIX

```sh
code --install-extension vscode-terminal-mcp-*.vsix
```

## Setup

Once installed, the extension:

1. Starts an MCP SSE server on port **6070** (configurable).
2. Automatically writes `.vscode/mcp.json` in your workspace (configurable).
3. Shows a status bar item — click it for options.

### Manual MCP configuration

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "vscode-terminal-mcp": {
      "type": "sse",
      "url": "http://localhost:6070/sse"
    }
  }
}
```

Or add to `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "vscode-terminal-mcp": {
        "type": "sse",
        "url": "http://localhost:6070/sse"
      }
    }
  }
}
```

## Configuration

| Setting                            | Default | Description                                     |
| ---------------------------------- | ------- | ----------------------------------------------- |
| `terminalMcp.port`                 | `6070`  | Port the MCP server listens on                  |
| `terminalMcp.autoConfigureMcpJson` | `true`  | Auto-add entry to `.vscode/mcp.json` on startup |

## Commands

| Command                                 | Description                          |
| --------------------------------------- | ------------------------------------ |
| `Terminal MCP: Show Status`             | Show server status and quick actions |
| `Terminal MCP: Copy MCP Configuration`  | Copy JSON config to clipboard        |
| `Terminal MCP: Add to .vscode/mcp.json` | Write config to workspace mcp.json   |
| `Terminal MCP: Restart Server`          | Restart the MCP server               |

## Requirements

- VS Code `1.99.0` or higher
- For `run_command` output capture: VS Code 1.93+ with shell integration enabled

## License

MIT
