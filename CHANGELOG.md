# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-03-24

### Added

- `hide_terminal` tool — hide (collapse) a terminal panel without closing it
- `close_all_terminals` tool — close every open terminal in one call
- `shell` field in terminal info — detected shell type (e.g. `pwsh`, `bash`, `zsh`) returned by `list_terminals` and `get_active_terminal`
- `cwd` field in terminal info — current working directory URI (requires shell integration)

### Fixed

- `processId` field now correctly resolves the async `Thenable<number | undefined>` instead of always returning `undefined`

### Changed

- MCP server now registers via `contributes.mcpServerDefinitionProviders` + `vscode.lm.registerMcpServerDefinitionProvider` — the extension appears with its icon and metadata in the VS Code MCP SERVERS panel
- Transport migrated from legacy SSE (`/sse` + `/messages`) to Streamable HTTP stateless mode (`/mcp`) as recommended by the MCP SDK
- `autoConfigureMcpJson` setting default changed to `false`; the Copy/Add MCP Config commands remain available for non-VS Code clients

## [0.1.3] - 2026-03-22

### Fixed

- `run_command` tool: start consuming `execution.read()` concurrently with command execution instead of inside the end-event callback. The previous approach caused a permanent hang (timeout) because the async iterable's `done` signal fired before the `for await` loop began, leaving it awaiting a `next()` that would never resolve.

## [0.1.2] - 2026-03-22

### Fixed

- `run_command` tool: read terminal output before shell integration end-event to reliably capture command results

## [0.1.1] - 2026-03-21

### Added

- Extension logo

## [0.1.0] - 2026-03-21

### Added

- Initial release
- MCP SSE server embedded inside VS Code extension host (port 6070, configurable)
- Auto-writes `.vscode/mcp.json` on workspace open
- Status bar item with quick actions
- **9 MCP tools:**
  - `list_terminals` — list all open terminals
  - `get_active_terminal` — get the focused terminal
  - `focus_terminal` — navigate to a terminal by name or index
  - `create_terminal` — create a terminal with optional name, cwd, shell
  - `rename_terminal` — rename a terminal
  - `close_terminal` — close a terminal
  - `send_text_to_terminal` — send text/command with optional Enter
  - `split_terminal` — split a terminal pane
  - `run_command` — run a command and capture output (requires shell integration)
- Commands: Show Status, Copy MCP Configuration, Add to mcp.json, Restart Server
