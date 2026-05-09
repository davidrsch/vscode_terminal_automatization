# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-09

### Added

- **Port 0 by default** — the OS now assigns a free port instead of hardcoded 6070. Eliminates all port conflicts with other MCP servers or services. The status bar always shows the actual listening port.
- **Atomic `.vscode/mcp.json` writes** — config is written to a temp file and renamed atomically, preventing corruption from concurrent writes by other extensions.
- **`terminalMcp.enableHttpServer` setting** — users who only need VS Code's built-in MCP support can disable the HTTP server entirely, freeing the port.
- **`mcpServerDefinitionProviders` manifest entry** — the extension now appears under the `@mcp` filter in VS Code's Extensions view for easier discovery.
- **Prettier formatter** — all source code is now formatted consistently (`.prettierrc` with 100 columns, single quotes, trailing commas).
- **Typed error codes** (`src/errors.ts`) — `ErrorCode` enum with `McpErrorResult` type and `makeError`/`wrapError` factories for consistent MCP error responses.
- **Structured JSON logger** (`src/logger.ts`) — every log entry is a JSON line with timestamp, level, module, and message for machine-parseable logs.
- **Tool definitions extracted** (`src/tools.ts`) — the `TOOLS` array and `McpTool` type are now in a separate module, testable independently.
- **Server test suite** (`src/test/server.test.ts` — 14 tests) covering HTTP lifecycle, endpoint registration, and dispatch of all 11 tools with error handling.
- **Tool metadata tests** (`src/test/tools.test.ts` — 6 tests) validating unique names, snake_case convention, required fields, and mandatory tool set.
- **Test coverage** — v8 provider with text + lcov reporters, 47 tests across 3 files.
- **`npm run check`** — single command that runs format → lint → typecheck → test → build.
- **`npm run typecheck`** — TypeScript type checking via `tsc --noEmit`.
- **Publish workflow parity with playbooks-mcp:**
  - Open VSX dual publishing (`npm run publish:ovsx`)
  - Version tag validation (tag must match `package.json` version)
  - GitHub Release naming (`terminal-automatization v0.2.0`)
  - Auto-generated release notes
  - VSIX renamed with release tag (`terminal-automatization-v0.2.0.vsix`)
  - Split into `build-vsix` + `publish` jobs with artifact handoff
  - PR trigger for dry-run verification
  - `--skip-duplicate` for idempotent publish runs
  - `@vscode/vsce` and `ovsx` as devDependencies (modern tooling)

### Changed

- **Port handling simplified** — `startServer` now does a two-stage bind: try the configured port, then fall back to port 0 (OS-guaranteed). Replaces the old 10-port 6070–6079 loop.
- **McpTerminalServer.port** is now mutable — after binding, the actual OS-assigned port is read from `server.address()` and stored.
- **Default port changed** from `6070` to `0` in both `package.json` configuration and `extension.ts` default variable.
- **Publish workflow upgraded** from single-job monolithic to dual-job `build-vsix` → `publish` with artifact download.
- **CI workflow** now includes a `Format check` step after lint.
- **ESLint** now allows `console.log` (used by the structured logger).
- **Vitest config** now includes coverage configuration and a 30-second test timeout.
- **`@vscode/vsce`** now used as a devDependency instead of legacy `npx vsce`.

### Fixed

- **Port conflicts eliminated** — `port: 0` delegates to the OS, which always picks a free port. No more `EADDRINUSE` loops.
- **`.vscode/mcp.json` corruption risk eliminated** — atomic write-then-rename prevents partial writes.
- **All predefined error codes are now unused** — `ErrorCode` and `makeError` removed from `server.ts` import; only `wrapError` is used at the MCP transport boundary.

## [0.1.8] - 2026-05-07

### Fixed

- `setupMcpJson` no longer writes an inconsistent `"type":"sse","url":".../sse"` entry when an existing `mcp.json` is updated — it now reuses `buildMcpServerEntry` and always writes `"type":"http"` plus `"url":".../mcp"`, matching the clipboard config and the actual Streamable HTTP transport.
- `closeAllTerminals` no longer mutates the terminal list mid-iteration — the snapshot is captured before disposal, preventing potential stale/duplicate disposal and off-by-one counts.
- Flaky `renameTerminal` test replaced with a deterministic assertion that checks the exact ANSI sequence sent to the terminal.
- `deactivate()` now returns a `Promise<void>` so VS Code can await server shutdown during extension deactivation, avoiding a potential race condition where the server port is not released before the process exits.
- esbuild target updated from `node20` to `node22` to match the Node.js version bundled with VS Code 1.99+.

### Changed

- `run_command` timeout no longer throws an error in SSH/remote terminal sessions where shell integration events do not propagate from the remote host. Instead it returns a descriptive note that output capture timed out, allowing callers to handle the situation gracefully without treating it as a hard failure.
- MCP server now reports the actual extension version from `package.json` instead of a hardcoded `"0.1.0"`.
- README updated to reference the Streamable HTTP transport (`type: "http"`, `/mcp` endpoint) instead of legacy SSE.
- All MCP tools now include a `title` field (human-readable display name) for better UI integration in MCP clients.
- MCP SDK upgraded from 1.27.1 to 1.29.0.

### Security

- Added `localhostHostValidation()` middleware from the MCP SDK to protect against DNS rebinding attacks on localhost, following official MCP best practices.

## [0.1.7] - 2026-03-25

### Fixed

- Fixed `EADDRINUSE` when multiple VS Code windows are open — the server now automatically tries ports 6070–6079, binding to the first available one. The status bar and all commands always reflect the actual running port.

## [0.1.6] - 2026-03-25

### Fixed

- Fixed `EADDRINUSE` error on restart — `stop()` now properly awaits server close before starting a new one.
- Removed `contributes.mcpServerDefinitionProviders` manifest entry which was triggering an unwanted GitHub sign-in prompt on activation.

## [0.1.5] - 2026-03-25

### Added

- Extension logo now appears in MCP SERVERS panel — the server embeds `logo.png` as a base64 data URI in the MCP protocol `icons` field of the `initialize` response, so any MCP client that supports the `icons` field will display the extension's icon.

### Fixed

- Removed the `vscode.lm.registerMcpServerDefinitionProvider` runtime call which was triggering an unwanted GitHub sign-in prompt. The `contributes.mcpServerDefinitionProviders` declaration in the manifest is sufficient for the extension to appear under `@mcp` in the Extensions view; the runtime Copilot API is not needed for the HTTP MCP server to work with any AI client.

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
