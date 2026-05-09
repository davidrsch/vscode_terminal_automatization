import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { localhostHostValidation } from '@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TerminalService } from './terminal-service';
import { TOOLS } from './tools';
import { wrapError } from './errors';
import { logger } from './logger';

export class McpTerminalServer {
  private httpServer: http.Server | undefined;
  private readonly terminalService: TerminalService;
  private logoDataUri: string | undefined;
  private readonly serverVersion: string;

  /** The port the server is actually listening on.
   *  May differ from the constructor argument when port 0 is used
   *  (OS assigns a free port). */
  port: number;

  constructor(port: number, version?: string) {
    this.port = port;
    this.terminalService = new TerminalService();
    this.serverVersion = version ?? '0.1.0';
  }

  async start(): Promise<void> {
    try {
      const logoPath = path.join(__dirname, '..', 'logo.png');
      const logoBuffer = fs.readFileSync(logoPath);
      this.logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch {
      // logo.png not found — icon will be omitted
    }

    const app = express();
    app.use(express.json());
    app.use(localhostHostValidation()); // DNS rebinding protection per MCP best practices

    // Streamable HTTP endpoint (stateless — new transport per request)
    app.post('/mcp', async (req: Request, res: Response) => {
      const mcpServer = this.createMcpServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      try {
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on('close', () => {
          transport.close();
          mcpServer.close().catch((err: unknown) => {
            logger.error('server', 'MCP server close error', { error: String(err) });
          });
        });
      } catch (err) {
        logger.error('server', 'MCP request error', { error: String(err) });
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    });

    // GET /mcp — not used in stateless mode
    app.get('/mcp', (_req: Request, res: Response) => {
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      });
    });

    // DELETE /mcp — not used in stateless mode
    app.delete('/mcp', (_req: Request, res: Response) => {
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      });
    });

    // Health check
    app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    return new Promise((resolve, reject) => {
      this.httpServer = app.listen(this.port, '127.0.0.1', () => {
        // When port 0 is used, the OS assigns a free port — read it back
        const addr = this.httpServer?.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        resolve();
      });
      this.httpServer.on('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise(resolve => {
      if (!this.httpServer) return resolve();
      this.httpServer.closeAllConnections?.();
      this.httpServer.close(() => resolve());
    });
  }

  private createMcpServer(): Server {
    const icons = this.logoDataUri ? [{ src: this.logoDataUri, mimeType: 'image/png' }] : undefined;
    const server = new Server(
      { name: 'terminal-automatization', version: this.serverVersion, ...(icons && { icons }) },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

    server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args = {} } = request.params;
      try {
        const result = await this.dispatch(name, args as Record<string, unknown>);
        return { content: [{ type: 'text' as const, text: result }] };
      } catch (err) {
        const errorResult = wrapError(err);
        logger.warn('server', `Tool '${name}' failed`, {
          code: errorResult.code,
          message: errorResult.message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `[${errorResult.code}] ${errorResult.message}`,
            },
          ],
          isError: true,
        };
      }
    });

    return server;
  }

  private async dispatch(toolName: string, args: Record<string, unknown>): Promise<string> {
    switch (toolName) {
      case 'list_terminals':
        return JSON.stringify(await this.terminalService.listTerminals(), null, 2);

      case 'get_active_terminal':
        return JSON.stringify(await this.terminalService.getActiveTerminal(), null, 2);

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

      case 'hide_terminal':
        return this.terminalService.hideTerminal(args);

      case 'close_all_terminals':
        return this.terminalService.closeAllTerminals();

      case 'run_command':
        return this.terminalService.runCommand(args);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
