import { vi } from 'vitest';
import type { Terminal, TerminalOptions, TerminalExitStatus } from 'vscode';

// ── Minimal Terminal mock ────────────────────────────────────────────────────

export function makeTerminal(
  name: string,
  opts: {
    isActive?: boolean;
    exitStatus?: TerminalExitStatus;
    shellIntegration?: boolean;
  } = {}
): Terminal {
  return {
    name,
    processId: Promise.resolve(1234),
    creationOptions: {} as TerminalOptions,
    exitStatus: opts.exitStatus,
    state: { isInteractedWith: false, shell: undefined },
    shellIntegration: opts.shellIntegration
      ? {
          cwd: undefined,
          env: { value: {}, isArray: false, isTrusted: true },
          executeCommand: vi.fn().mockReturnValue({
            read: vi.fn().mockReturnValue((async function* () { yield 'hello\n'; })()),
          }),
        }
      : undefined,
    show: vi.fn(),
    hide: vi.fn(),
    sendText: vi.fn(),
    dispose: vi.fn(),
  } as unknown as Terminal;
}

// ── vscode module mock ───────────────────────────────────────────────────────

export function makeVscodeMock(terminals: Terminal[], activeTerminal?: Terminal) {
  return {
    window: {
      terminals,
      activeTerminal: activeTerminal ?? terminals[0] ?? undefined,
      createTerminal: vi.fn((opts: TerminalOptions) => makeTerminal(opts.name ?? 'terminal')),
      onDidEndTerminalShellExecution: vi.fn(() => ({ dispose: vi.fn() })),
    },
    workspace: {
      getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(undefined),
      }),
      workspaceFolders: undefined,
    },
    commands: {
      executeCommand: vi.fn(),
    },
  };
}
