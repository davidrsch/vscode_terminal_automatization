import * as vscode from 'vscode';
import { McpTerminalServer } from './server';

let mcpServer: McpTerminalServer | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let configuredPort = 6070;
let extensionVersion = '0.1.0';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  extensionVersion = context.extension.packageJSON?.version ?? '0.1.0';
  const cfg = vscode.workspace.getConfiguration('terminalMcp');
  configuredPort = cfg.get<number>('port', 6070);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'terminal-automatization.showStatus';
  context.subscriptions.push(statusBarItem);

  await startServer(configuredPort);

  context.subscriptions.push(
    vscode.commands.registerCommand('terminal-automatization.showStatus', () => {
      const url = `http://localhost:${getActivePort()}/mcp`;
      vscode.window.showInformationMessage(
        `Terminal MCP is running at ${url}`,
        'Copy Config',
        'Add to mcp.json'
      ).then(async sel => {
        if (sel === 'Copy Config') await copyMcpConfig(getActivePort());
        else if (sel === 'Add to mcp.json') await setupMcpJson(getActivePort(), true);
      });
    }),
    vscode.commands.registerCommand('terminal-automatization.copyMcpConfig', () => copyMcpConfig(getActivePort())),
    vscode.commands.registerCommand('terminal-automatization.addToMcpJson', () => setupMcpJson(getActivePort(), true)),
    vscode.commands.registerCommand('terminal-automatization.restart', async () => {
      await startServer(configuredPort);
      vscode.window.showInformationMessage('Terminal MCP server restarted.');
    })
  );
}

export async function deactivate(): Promise<void> {
  await mcpServer?.stop();
}

async function startServer(basePort: number): Promise<void> {
  await mcpServer?.stop();
  mcpServer = undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    const tryPort = basePort + attempt;
    const server = new McpTerminalServer(tryPort, extensionVersion);
    try {
      await server.start();
      mcpServer = server;
      setStatusBar(`$(terminal) MCP :${tryPort}`, `Terminal MCP running on port ${tryPort}`);
      return;
    } catch (err) {
      await server.stop();
      if ((err as { code?: string })?.code === 'EADDRINUSE' && attempt < 9) {
        continue;
      }
      setStatusBar('$(error) MCP failed', 'Terminal MCP failed to start');
      vscode.window.showErrorMessage(`Terminal MCP failed to start on port ${basePort}: ${err}`);
      return;
    }
  }
  setStatusBar('$(error) MCP failed', 'Terminal MCP failed to start');
  vscode.window.showErrorMessage(`Terminal MCP failed to start: all ports ${basePort}–${basePort + 9} are in use`);
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

  const entry = buildMcpServerEntry(port);
  const serverKey = 'terminal-automatization';

  try {
    const raw = await vscode.workspace.fs.readFile(mcpJsonUri);
    const parsed: { servers?: Record<string, unknown> } = JSON.parse(
      Buffer.from(raw).toString('utf-8')
    );

    if (!force && parsed.servers?.[serverKey]) return;

    parsed.servers = parsed.servers ?? {};
    parsed.servers[serverKey] = entry;

    await vscode.workspace.fs.writeFile(
      mcpJsonUri,
      Buffer.from(JSON.stringify(parsed, null, 2), 'utf-8')
    );
  } catch {
    // File doesn't exist — create it
    try {
      await vscode.workspace.fs.createDirectory(vscodeDir);
    } catch {
      // Directory may already exist
    }
    await vscode.workspace.fs.writeFile(
      mcpJsonUri,
      Buffer.from(JSON.stringify(buildMcpConfig(port), null, 2), 'utf-8')
    );
  }
}
