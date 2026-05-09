import * as vscode from 'vscode';
import { McpTerminalServer } from './server';

let mcpServer: McpTerminalServer | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let configuredPort = 0;
let extensionVersion = '0.1.0';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  extensionVersion = context.extension.packageJSON?.version ?? '0.1.0';
  const cfg = vscode.workspace.getConfiguration('terminalMcp');
  configuredPort = cfg.get<number>('port', 0);
  const enableHttp = cfg.get<boolean>('enableHttpServer', true);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'terminal-automatization.showStatus';
  context.subscriptions.push(statusBarItem);

  if (enableHttp) {
    await startServer(configuredPort);
  } else {
    setStatusBar(
      '$(terminal) MCP (stdio)',
      'Terminal MCP registered via VS Code MCP provider (HTTP server disabled)',
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('terminal-automatization.showStatus', () => {
      const url = `http://localhost:${getActivePort()}/mcp`;
      vscode.window
        .showInformationMessage(
          `Terminal MCP is running at ${url}`,
          'Copy Config',
          'Add to mcp.json',
        )
        .then(async sel => {
          if (sel === 'Copy Config') await copyMcpConfig(getActivePort());
          else if (sel === 'Add to mcp.json') await setupMcpJson(getActivePort(), true);
        });
    }),
    vscode.commands.registerCommand('terminal-automatization.copyMcpConfig', () =>
      copyMcpConfig(getActivePort()),
    ),
    vscode.commands.registerCommand('terminal-automatization.addToMcpJson', () =>
      setupMcpJson(getActivePort(), true),
    ),
    vscode.commands.registerCommand('terminal-automatization.restart', async () => {
      await startServer(configuredPort);
      vscode.window.showInformationMessage('Terminal MCP server restarted.');
    }),
  );
}

export async function deactivate(): Promise<void> {
  await mcpServer?.stop();
}

async function startServer(basePort: number): Promise<void> {
  await mcpServer?.stop();
  mcpServer = undefined;

  // Stage 1: try the configured port
  if (basePort !== 0) {
    const server = new McpTerminalServer(basePort, extensionVersion);
    try {
      await server.start();
      mcpServer = server;
      setStatusBar(
        `$(terminal) MCP :${server.port}`,
        `Terminal MCP running on port ${server.port}`,
      );
      return;
    } catch (err) {
      await server.stop();
      if ((err as { code?: string })?.code !== 'EADDRINUSE') {
        setStatusBar('$(error) MCP failed', 'Terminal MCP failed to start');
        vscode.window.showErrorMessage(`Terminal MCP failed to start on port ${basePort}: ${err}`);
        return;
      }
      // EADDRINUSE — fall through to port 0
    }
  }

  // Stage 2: let the OS pick a free port (port 0)
  const server = new McpTerminalServer(0, extensionVersion);
  try {
    await server.start();
    mcpServer = server;
    const actualPort = server.port;
    setStatusBar(
      `$(terminal) MCP :${actualPort}`,
      `Terminal MCP running on port ${actualPort} (OS-assigned)`,
    );
    vscode.window
      .showInformationMessage(
        `Terminal MCP is running on port ${actualPort} (OS-assigned). Use "Add to mcp.json" to configure your MCP client.`,
        'Add to mcp.json',
      )
      .then(sel => {
        if (sel === 'Add to mcp.json') setupMcpJson(actualPort, true);
      });
  } catch (err) {
    await server.stop();
    setStatusBar('$(error) MCP failed', 'Terminal MCP failed to start');
    vscode.window.showErrorMessage(
      `Terminal MCP failed to start — unable to bind any port: ${err}`,
    );
  }
}

function getActivePort(): number {
  return mcpServer?.port ?? configuredPort;
}

function setStatusBar(text: string, tooltip: string): void {
  if (!statusBarItem) return;
  statusBarItem.text = text;
  statusBarItem.tooltip = tooltip;
  statusBarItem.show();
}

async function copyMcpConfig(port: number): Promise<void> {
  const cfg = buildMcpConfig(port);
  await vscode.env.clipboard.writeText(JSON.stringify(cfg, null, 2));
  vscode.window.showInformationMessage('MCP configuration copied to clipboard!');
}

function buildMcpServerEntry(port: number): { type: string; url: string; serverName?: string } {
  return {
    type: 'http',
    url: `http://localhost:${port}/mcp`,
    serverName: 'terminal-automatization',
  };
}

function buildMcpConfig(port: number): object {
  return {
    servers: {
      'terminal-automatization': buildMcpServerEntry(port),
    },
  };
}

async function setupMcpJson(port: number, force = false): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return;

  const wsRoot = folders[0].uri;
  const vscodeDir = vscode.Uri.joinPath(wsRoot, '.vscode');
  const mcpJsonUri = vscode.Uri.joinPath(vscodeDir, 'mcp.json');
  const tmpUri = vscode.Uri.joinPath(vscodeDir, 'mcp.json.tmp');

  const entry = buildMcpServerEntry(port);
  const serverKey = 'terminal-automatization';

  let parsed: { servers?: Record<string, unknown> };

  try {
    const raw = await vscode.workspace.fs.readFile(mcpJsonUri);
    parsed = JSON.parse(Buffer.from(raw).toString('utf-8'));
  } catch {
    // File doesn't exist — start fresh
    parsed = {};
  }

  if (!force && parsed.servers?.[serverKey]) return;

  parsed.servers = parsed.servers ?? {};
  parsed.servers[serverKey] = entry;

  // Atomic write: write to temp file first, then rename to avoid corruption
  // from concurrent writes by other extensions or VS Code itself.
  const content = Buffer.from(JSON.stringify(parsed, null, 2) + '\n', 'utf-8');

  try {
    await vscode.workspace.fs.createDirectory(vscodeDir);
  } catch {
    // Directory may already exist
  }

  await vscode.workspace.fs.writeFile(tmpUri, content);
  await vscode.workspace.fs.rename(tmpUri, mcpJsonUri, { overwrite: true });
}
