# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
