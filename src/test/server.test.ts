import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock the MCP SDK ──────────────────────────────────────────────────────

const mockMcpServer = {
  setRequestHandler: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockTransport = {
  handleRequest: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
};

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => mockMcpServer),
}));

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(() => mockTransport),
}));

vi.mock('@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js', () => ({
  localhostHostValidation: vi
    .fn()
    .mockReturnValue((_req: unknown, _res: unknown, next: () => void) => next()),
}));

// ── Mock TerminalService ──────────────────────────────────────────────────

const mockTerminalService = {
  listTerminals: vi.fn().mockResolvedValue([{ index: 0, name: 'test', isActive: true }]),
  getActiveTerminal: vi.fn().mockResolvedValue({ index: 0, name: 'active', isActive: true }),
  focusTerminal: vi.fn().mockReturnValue('Focused terminal: "test"'),
  createTerminal: vi.fn().mockReturnValue('Created terminal: "new"'),
  renameTerminal: vi.fn().mockReturnValue('Renamed terminal to: "renamed"'),
  closeTerminal: vi.fn().mockReturnValue('Closed terminal: "test"'),
  sendTextToTerminal: vi.fn().mockReturnValue('Sent text to terminal "test" (executed)'),
  hideTerminal: vi.fn().mockReturnValue('Hid terminal: "test"'),
  closeAllTerminals: vi.fn().mockReturnValue('Closed 2 terminals'),
  splitTerminal: vi.fn().mockReturnValue('Split terminal from: "test"'),
  runCommand: vi
    .fn()
    .mockResolvedValue(JSON.stringify({ command: 'echo hi', exitCode: 0, output: 'hi' })),
};

vi.mock('../terminal-service', () => ({
  TerminalService: vi.fn().mockImplementation(() => mockTerminalService),
}));

// ── Mock express — capture route handlers ─────────────────────────────────

let capturedPostHandler: ((req: unknown, res: unknown) => void) | undefined;

function makeFakeServer() {
  const server = {
    on: vi.fn(),
    close: vi.fn().mockImplementation((cb?: () => void) => {
      if (cb) cb();
      return server;
    }),
    closeAllConnections: vi.fn(),
  };
  return server;
}

let fakeServer = makeFakeServer();

const mockExpressApp = {
  use: vi.fn(),
  post: vi
    .fn()
    .mockImplementation((_path: string, handler: (req: unknown, res: unknown) => void) => {
      capturedPostHandler = handler;
    }),
  get: vi.fn(),
  delete: vi.fn(),
  listen: vi.fn().mockImplementation((_port: number, _host: string, cb: () => void) => {
    fakeServer = makeFakeServer();
    cb();
    return fakeServer;
  }),
};

vi.mock('express', () => {
  const fn = vi.fn().mockReturnValue(mockExpressApp);
  (fn as any).json = vi.fn().mockReturnValue(vi.fn());
  return { default: fn };
});

// ── Import ────────────────────────────────────────────────────────────────

const { McpTerminalServer } = await import('../server');

// ── Helpers ───────────────────────────────────────────────────────────────

/** Simulate a POST /mcp request and return the CallTool handler */
async function triggerMcpRequest(server: InstanceType<typeof McpTerminalServer>): Promise<
  (request: { params: { name: string; arguments?: Record<string, unknown> } }) => Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>
> {
  await server.start();

  const fakeReq = {
    body: { method: 'tools/call', params: {} },
  };

  const fakeRes = {
    on: vi.fn(),
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };

  capturedPostHandler!(fakeReq, fakeRes);

  // Wait for async handler to complete & setRequestHandler to be called
  await vi.waitFor(() => mockMcpServer.setRequestHandler.mock.calls.length >= 2, { timeout: 1000 });

  // Second call is CallToolRequestSchema
  const call = mockMcpServer.setRequestHandler.mock.calls[1];
  return call?.[1] as any;
}

describe('McpTerminalServer', () => {
  let server: InstanceType<typeof McpTerminalServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedPostHandler = undefined;
    fakeServer = makeFakeServer();
    server = new McpTerminalServer(6070, '1.0.0-test');
  });

  describe('start', () => {
    it('starts the HTTP server on the given port', async () => {
      await server.start();
      expect(mockExpressApp.listen).toHaveBeenCalledWith(6070, '127.0.0.1', expect.any(Function));
    });

    it('registers the /mcp POST endpoint and captures handler', async () => {
      await server.start();
      expect(mockExpressApp.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
      expect(capturedPostHandler).toBeDefined();
    });

    it('registers health check endpoint', async () => {
      await server.start();
      expect(mockExpressApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
    });

    it('registers DNS rebinding protection middleware', async () => {
      await server.start();
      expect(mockExpressApp.use).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('resolves immediately when no server is running', async () => {
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('closes the HTTP server when running', async () => {
      await server.start();
      await server.stop();
      expect(fakeServer.close).toHaveBeenCalled();
    });
  });

  describe('tool dispatch (via POST /mcp handler)', () => {
    let handler: (request: {
      params: { name: string; arguments?: Record<string, unknown> };
    }) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;

    beforeEach(async () => {
      handler = await triggerMcpRequest(server);
    });

    it('dispatches list_terminals', async () => {
      const result = await handler({ params: { name: 'list_terminals' } });
      expect(mockTerminalService.listTerminals).toHaveBeenCalled();
      expect(result.content[0].text).toContain('"index": 0');
    });

    it('dispatches focus_terminal with arguments', async () => {
      const result = await handler({
        params: { name: 'focus_terminal', arguments: { name: 'test' } },
      });
      expect(mockTerminalService.focusTerminal).toHaveBeenCalledWith({ name: 'test' });
      expect(result.content[0].text).toContain('Focused');
    });

    it('dispatches create_terminal with arguments', async () => {
      await handler({
        params: { name: 'create_terminal', arguments: { name: 'myterm', cwd: '/tmp' } },
      });
      expect(mockTerminalService.createTerminal).toHaveBeenCalledWith({
        name: 'myterm',
        cwd: '/tmp',
      });
    });

    it('dispatches send_text_to_terminal', async () => {
      await handler({
        params: {
          name: 'send_text_to_terminal',
          arguments: { text: 'ls', name: 'test', execute: false },
        },
      });
      expect(mockTerminalService.sendTextToTerminal).toHaveBeenCalledWith({
        text: 'ls',
        name: 'test',
        execute: false,
      });
    });

    it('dispatches run_command', async () => {
      const result = await handler({
        params: { name: 'run_command', arguments: { command: 'echo hi' } },
      });
      expect(mockTerminalService.runCommand).toHaveBeenCalledWith({ command: 'echo hi' });
      expect(result.content[0].text).toContain('"exitCode":0');
    });

    it('returns error for unknown tool', async () => {
      const result = await handler({ params: { name: 'nonexistent_tool' } });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('INTERNAL_ERROR');
    });

    it('returns error when TerminalService throws', async () => {
      mockTerminalService.focusTerminal.mockImplementationOnce(() => {
        throw new Error('Terminal not found');
      });
      const result = await handler({
        params: { name: 'focus_terminal', arguments: { name: 'ghost' } },
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('INTERNAL_ERROR');
      expect(result.content[0].text).toContain('Terminal not found');
    });

    it('dispatches all 11 tools without errors', async () => {
      const toolNames = [
        'list_terminals',
        'get_active_terminal',
        'focus_terminal',
        'create_terminal',
        'rename_terminal',
        'close_terminal',
        'send_text_to_terminal',
        'split_terminal',
        'hide_terminal',
        'close_all_terminals',
        'run_command',
      ];

      for (const name of toolNames) {
        const result = await handler({ params: { name, arguments: {} } });
        expect(
          result.isError,
          `Tool '${name}' returned error: ${result.content[0]?.text}`,
        ).toBeFalsy();
      }

      expect(toolNames.length).toBe(11);
    });
  });
});
