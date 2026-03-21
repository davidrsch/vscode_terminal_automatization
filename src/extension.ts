import * as vscode from 'vscode';
import { McpTerminalServer } from './server';

let mcpServer: McpTerminalServer | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('terminalMcp');
  const port = cfg.get<number>('port', 6070);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'terminal-automatization.showStatus';
  context.subscriptions.push(statusBarItem);

  await startServer(port, context);

  // Re-setup mcp.json when workspace folders change
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      if (mcpServer) await setupMcpJson(port);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('terminal-automatization.showStatus', () => {
      const url = `http://localhost:${port}/sse`;
      vscode.window.showInformationMessage(
        `Terminal MCP is running at ${url}`,
        'Copy Config',
        'Add to mcp.json'
      ).then(async sel => {
        if (sel === 'Copy Config') await copyMcpConfig(port);
        else if (sel === 'Add to mcp.json') await setupMcpJson(port, true);
      });
    }),
    vscode.commands.registerCommand('terminal-automatization.copyMcpConfig', () => copyMcpConfig(port)),
    vscode.commands.registerCommand('terminal-automatization.addToMcpJson', () => setupMcpJson(port, true)),
    vscode.commands.registerCommand('terminal-automatization.restart', async () => {
      mcpServer?.stop();
      await startServer(port);
      vscode.window.showInformationMessage('Terminal MCP server restarted.');
    })
  );
}

export function deactivate(): void {
  mcpServer?.stop();
}

async function startServer(port: number): Promise<void> {
  mcpServer = new McpTerminalServer(port);
  try {
    await mcpServer.start();
    setStatusBar(`$(terminal) MCP :${port}`, `Terminal MCP running on port ${port}`);

    const autoCfg = vscode.workspace.getConfiguration('terminalMcp').get<boolean>('autoConfigureMcpJson', true);
    if (autoCfg) await setupMcpJson(port);
  } catch (err) {
    setStatusBar('$(error) MCP failed', 'Terminal MCP failed to start');
    vscode.window.showErrorMessage(`Terminal MCP failed to start on port ${port}: ${err}`);
  }
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

function buildMcpConfig(port: number): object {
  return {
    servers: {
      'terminal-automatization': {
        type: 'sse',
        url: `http://localhost:${port}/sse`,
      },
    },
  };
}

async function setupMcpJson(port: number, force = false): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return;

  const wsRoot = folders[0].uri;
  const vscodeDir = vscode.Uri.joinPath(wsRoot, '.vscode');
  const mcpJsonUri = vscode.Uri.joinPath(vscodeDir, 'mcp.json');

  const entry = {
    type: 'sse',
    url: `http://localhost:${port}/sse`,
  };

  try {
    const raw = await vscode.workspace.fs.readFile(mcpJsonUri);
    const parsed: { servers?: Record<string, unknown> } = JSON.parse(
      Buffer.from(raw).toString('utf-8')
    );

    if (!force && parsed.servers?.['vscode-terminal-mcp']) return;

    parsed.servers = parsed.servers ?? {};
    parsed.servers['vscode-terminal-mcp'] = entry;

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
