import * as http from 'http';
import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TerminalService } from './terminal-service';

const TOOLS = [
  {
    name: 'list_terminals',
    description:
      'List all open VS Code terminals. Returns index, name, active status, exit status, shell integration availability, and working directory for each terminal.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_active_terminal',
    description: 'Get information about the currently active (focused) VS Code terminal.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'focus_terminal',
    description: 'Focus (navigate to) a specific terminal by name or index.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Terminal name to focus' },
        index: { type: 'number', description: 'Terminal index (0-based) to focus' },
      },
    },
  },
  {
    name: 'create_terminal',
    description: 'Create a new VS Code terminal.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the new terminal' },
        cwd: { type: 'string', description: 'Working directory for the new terminal' },
        shellPath: { type: 'string', description: 'Path to the shell executable (e.g. /bin/bash)' },
        shellArgs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arguments for the shell',
        },
      },
    },
  },
  {
    name: 'rename_terminal',
    description: 'Rename an existing VS Code terminal.',
    inputSchema: {
      type: 'object' as const,
      required: ['newName'],
      properties: {
        name: { type: 'string', description: 'Current terminal name' },
        index: { type: 'number', description: 'Terminal index (0-based)' },
        newName: { type: 'string', description: 'New name for the terminal' },
      },
    },
  },
  {
    name: 'close_terminal',
    description: 'Close (dispose) a terminal by name or index.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Terminal name to close' },
        index: { type: 'number', description: 'Terminal index (0-based) to close' },
      },
    },
  },
  {
    name: 'send_text_to_terminal',
    description:
      'Send text or a command to a specific terminal. Optionally executes (presses Enter). If no terminal specified, uses the active terminal.',
    inputSchema: {
      type: 'object' as const,
      required: ['text'],
      properties: {
        name: { type: 'string', description: 'Target terminal name (optional)' },
        index: { type: 'number', description: 'Target terminal index (optional)' },
        text: { type: 'string', description: 'Text or command to send' },
        execute: {
          type: 'boolean',
          description: 'Press Enter after sending (default: true)',
        },
      },
    },
  },
  {
    name: 'split_terminal',
    description: 'Create a split terminal pane from an existing terminal.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Terminal name to split from (defaults to active)' },
        index: { type: 'number', description: 'Terminal index (0-based) to split from' },
      },
    },
  },
  {
    name: 'run_command',
    description:
      'Run a shell command in a terminal and return its output. Requires shell integration (VS Code 1.93+). Falls back to send_text if shell integration is unavailable.',
    inputSchema: {
      type: 'object' as const,
      required: ['command'],
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        name: { type: 'string', description: 'Terminal name to run in (optional)' },
        index: { type: 'number', description: 'Terminal index (0-based) to run in (optional)' },
        timeoutMs: {
          type: 'number',
          description: 'Timeout in milliseconds to wait for output (default: 30000)',
        },
      },
    },
  },
];

export class McpTerminalServer {
  private httpServer: http.Server | undefined;
  private readonly terminalService: TerminalService;
  private readonly transports = new Map<string, SSEServerTransport>();

  constructor(private readonly port: number) {
    this.terminalService = new TerminalService();
  }

  async start(): Promise<void> {
    const app = express();
    app.use(express.json());

    // SSE endpoint — clients connect here first to get the message endpoint
    app.get('/sse', (req: Request, res: Response) => {
      const mcpServer = this.createMcpServer();
      const transport = new SSEServerTransport('/messages', res);

      this.transports.set(transport.sessionId, transport);

      mcpServer.connect(transport).catch((err: unknown) => {
        console.error('[vscode-terminal-mcp] transport connect error:', err);
      });

      req.on('close', () => {
        this.transports.delete(transport.sessionId);
        mcpServer.close().catch((err: unknown) => {
          console.error('[vscode-terminal-mcp] server close error:', err);
        });
      });
    });

    // POST endpoint — clients post JSON-RPC messages here
    app.post('/messages', async (req: Request, res: Response) => {
      const sessionId = req.query['sessionId'] as string | undefined;
      if (!sessionId) {
        res.status(400).json({ error: 'Missing sessionId query parameter' });
        return;
      }
      const transport = this.transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: `No active session: ${sessionId}` });
        return;
      }
      try {
        await transport.handlePostMessage(req, res, req.body);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    // Health check
    app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', sessions: this.transports.size });
    });

    return new Promise((resolve, reject) => {
      this.httpServer = app.listen(this.port, '127.0.0.1', resolve as () => void);
      this.httpServer.on('error', reject);
    });
  }

  stop(): void {
    this.httpServer?.close();
    this.transports.clear();
  }

  private createMcpServer(): Server {
    const server = new Server(
      { name: 'vscode-terminal-mcp', version: '0.1.0' },
      { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

    server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args = {} } = request.params;
      try {
        const result = await this.dispatch(name, args as Record<string, unknown>);
        return { content: [{ type: 'text' as const, text: result }] };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    });

    return server;
  }

  private async dispatch(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    switch (toolName) {
      case 'list_terminals':
        return JSON.stringify(this.terminalService.listTerminals(), null, 2);

      case 'get_active_terminal':
        return JSON.stringify(this.terminalService.getActiveTerminal(), null, 2);

      case 'focus_terminal':
        return this.terminalService.focusTerminal(args);

      case 'create_terminal':
        return this.terminalService.createTerminal(args);

      case 'rename_terminal':
        return this.terminalService.renameTerminal(args);

      case 'close_terminal':
        return this.terminalService.closeTerminal(args);

      case 'send_text_to_terminal':
        return this.terminalService.sendTextToTerminal(args);

      case 'split_terminal':
        return this.terminalService.splitTerminal(args);

      case 'run_command':
        return this.terminalService.runCommand(args);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
