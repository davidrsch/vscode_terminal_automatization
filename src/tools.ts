/**
 * MCP tool definitions for the Terminal Automatization server.
 *
 * Each tool describes a terminal operation available to MCP agents.
 * Extracted from server.ts to keep the server module focused on transport
 * and lifecycle, and to allow independent testing of tool metadata.
 */

export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOLS: McpTool[] = [
  {
    name: 'list_terminals',
    title: 'List Terminals',
    description:
      'List all open VS Code terminals. Returns index, name, active status, exit status, shell type, shell integration availability, working directory, and process ID for each terminal.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_active_terminal',
    title: 'Get Active Terminal',
    description:
      'Get information about the currently active (focused) VS Code terminal, including shell type and working directory.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'focus_terminal',
    title: 'Focus Terminal',
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
    title: 'Create Terminal',
    description: 'Create a new VS Code terminal.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the new terminal' },
        cwd: { type: 'string', description: 'Working directory for the new terminal' },
        shellPath: {
          type: 'string',
          description: 'Path to the shell executable (e.g. /bin/bash)',
        },
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
    title: 'Rename Terminal',
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
    title: 'Close Terminal',
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
    title: 'Send Text to Terminal',
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
    name: 'hide_terminal',
    title: 'Hide Terminal',
    description: 'Hide (collapse) a terminal panel without closing it.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Terminal name to hide (defaults to active)' },
        index: { type: 'number', description: 'Terminal index (0-based) to hide' },
      },
    },
  },
  {
    name: 'close_all_terminals',
    title: 'Close All Terminals',
    description: 'Close (dispose) all open VS Code terminals at once.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'split_terminal',
    title: 'Split Terminal',
    description: 'Create a split terminal pane from an existing terminal.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Terminal name to split from (defaults to active)',
        },
        index: {
          type: 'number',
          description: 'Terminal index (0-based) to split from',
        },
      },
    },
  },
  {
    name: 'run_command',
    title: 'Run Command',
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
