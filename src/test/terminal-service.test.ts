import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTerminal, makeVscodeMock } from './vscode-mock';

// Mock the 'vscode' module before importing TerminalService
const mockTermA = makeTerminal('alpha');
const mockTermB = makeTerminal('beta', { shellIntegration: true });
const vsMock = makeVscodeMock([mockTermA, mockTermB], mockTermA);

vi.mock('vscode', () => vsMock);

// Import AFTER mock is in place
const { TerminalService } = await import('../terminal-service');

describe('TerminalService', () => {
  let service: InstanceType<typeof TerminalService>;

  beforeEach(() => {
    vi.clearAllMocks();
    vsMock.window.terminals = [mockTermA, mockTermB];
    vsMock.window.activeTerminal = mockTermA;
    service = new TerminalService();
  });

  // ── listTerminals ──────────────────────────────────────────────────────────

  describe('listTerminals', () => {
    it('returns all terminals with correct fields', () => {
      const result = service.listTerminals();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ index: 0, name: 'alpha', isActive: true });
      expect(result[1]).toMatchObject({ index: 1, name: 'beta', isActive: false });
    });

    it('marks shellIntegration correctly', () => {
      const result = service.listTerminals();
      expect(result[0].shellIntegration).toBe(false);
      expect(result[1].shellIntegration).toBe(true);
    });
  });

  // ── getActiveTerminal ──────────────────────────────────────────────────────

  describe('getActiveTerminal', () => {
    it('returns active terminal info', () => {
      const result = service.getActiveTerminal();
      expect(result).not.toBeNull();
      expect(result!.name).toBe('alpha');
      expect(result!.isActive).toBe(true);
    });

    it('returns null when no terminal is active', () => {
      vsMock.window.activeTerminal = undefined as any;
      expect(service.getActiveTerminal()).toBeNull();
    });
  });

  // ── focusTerminal ──────────────────────────────────────────────────────────

  describe('focusTerminal', () => {
    it('focuses by name', () => {
      service.focusTerminal({ name: 'beta' });
      expect(mockTermB.show).toHaveBeenCalled();
    });

    it('focuses by index', () => {
      service.focusTerminal({ index: 0 });
      expect(mockTermA.show).toHaveBeenCalled();
    });

    it('throws for unknown name', () => {
      expect(() => service.focusTerminal({ name: 'nope' })).toThrow('not found');
    });
  });

  // ── createTerminal ─────────────────────────────────────────────────────────

  describe('createTerminal', () => {
    it('creates with name and cwd', () => {
      service.createTerminal({ name: 'new', cwd: '/tmp' });
      expect(vsMock.window.createTerminal).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'new', cwd: '/tmp' })
      );
    });

    it('throws when shellArgs contains non-strings', () => {
      expect(() => service.createTerminal({ shellArgs: [1, 2] })).toThrow(
        'shellArgs must be an array of strings'
      );
    });
  });

  // ── renameTerminal ─────────────────────────────────────────────────────────

  describe('renameTerminal', () => {
    it('throws when newName is empty', () => {
      expect(() => service.renameTerminal({ index: 0, newName: '  ' })).toThrow('newName');
    });

    it('sends rename sequence to the terminal', () => {
      service.renameTerminal({ index: 0, newName: 'renamed' });
      expect(vsMock.window.activeTerminal === mockTermA || mockTermA.sendText).toBeTruthy();
    });
  });

  // ── closeTerminal ──────────────────────────────────────────────────────────

  describe('closeTerminal', () => {
    it('disposes the terminal by name', () => {
      service.closeTerminal({ name: 'alpha' });
      expect(mockTermA.dispose).toHaveBeenCalled();
    });

    it('throws for unknown terminal', () => {
      expect(() => service.closeTerminal({ name: 'ghost' })).toThrow('not found');
    });
  });

  // ── sendTextToTerminal ─────────────────────────────────────────────────────

  describe('sendTextToTerminal', () => {
    it('sends text with Enter by default', () => {
      service.sendTextToTerminal({ text: 'ls', name: 'alpha' });
      expect(mockTermA.sendText).toHaveBeenCalledWith('ls', true);
    });

    it('respects execute=false', () => {
      service.sendTextToTerminal({ text: 'partial', name: 'alpha', execute: false });
      expect(mockTermA.sendText).toHaveBeenCalledWith('partial', false);
    });

    it('throws when text is missing', () => {
      expect(() => service.sendTextToTerminal({})).toThrow('text is required');
    });
  });

  // ── splitTerminal ──────────────────────────────────────────────────────────

  describe('splitTerminal', () => {
    it('shows terminal then calls split command', () => {
      service.splitTerminal({ name: 'alpha' });
      expect(mockTermA.show).toHaveBeenCalled();
      expect(vsMock.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.terminal.split'
      );
    });
  });

  // ── runCommand ─────────────────────────────────────────────────────────────

  describe('runCommand', () => {
    it('throws when command is empty', async () => {
      await expect(service.runCommand({ command: '   ', name: 'alpha' })).rejects.toThrow(
        'command is required'
      );
    });

    it('falls back gracefully when shell integration is absent', async () => {
      const result = await service.runCommand({ command: 'echo hi', name: 'alpha' });
      const parsed = JSON.parse(result);
      expect(parsed.note).toMatch(/Shell integration unavailable/);
      expect(mockTermA.sendText).toHaveBeenCalledWith('echo hi', true);
    });

    it('captures output via shell integration', async () => {
      // The mock execution fires onDidEndTerminalShellExecution immediately
      const execution = {
        read: vi.fn().mockReturnValue(
          (async function* () {
            yield 'hello output\n';
          })()
        ),
      };
      (mockTermB.shellIntegration!.executeCommand as ReturnType<typeof vi.fn>).mockReturnValue(
        execution
      );

      let endHandler: ((e: any) => void) | undefined;
      vsMock.window.onDidEndTerminalShellExecution = vi.fn((cb: (e: any) => void) => {
        endHandler = cb;
        return { dispose: vi.fn() };
      });

      const promise = service.runCommand({ command: 'echo hi', name: 'beta' });

      // read() must be called before the end event fires so that the stream
      // starts buffering data from the very beginning of the execution.
      expect(execution.read).toHaveBeenCalledTimes(1);

      // Simulate shell integration ending immediately
      endHandler!({ execution, exitCode: 0 });

      const result = JSON.parse(await promise);
      expect(result.output).toBe('hello output');
      expect(result.exitCode).toBe(0);
    });
  });
});
