import * as vscode from 'vscode';

interface TerminalInfo {
  index: number;
  name: string;
  isActive: boolean;
  exitStatus: vscode.TerminalExitStatus | undefined;
  shellIntegration: boolean;
  processId: number | undefined;
}

export class TerminalService {
  // ─── Helpers ──────────────────────────────────────────────────────────────

  private all(): readonly vscode.Terminal[] {
    return vscode.window.terminals;
  }

  private resolve(args: Record<string, unknown>): vscode.Terminal | undefined {
    const terminals = this.all();
    if (typeof args['index'] === 'number') return terminals[args['index'] as number];
    if (typeof args['name'] === 'string') {
      return terminals.find(t => t.name === args['name']);
    }
    return vscode.window.activeTerminal;
  }

  private resolveOrThrow(args: Record<string, unknown>, label = 'Terminal'): vscode.Terminal {
    const t = this.resolve(args);
    if (!t) throw new Error(`${label} not found. Use list_terminals to see available terminals.`);
    return t;
  }

  private info(terminal: vscode.Terminal, index: number): TerminalInfo {
    return {
      index,
      name: terminal.name,
      isActive: terminal === vscode.window.activeTerminal,
      exitStatus: terminal.exitStatus,
      shellIntegration: terminal.shellIntegration !== undefined,
      processId: undefined, // processId is async — resolved separately
    };
  }

  // ─── Tools ────────────────────────────────────────────────────────────────

  listTerminals(): TerminalInfo[] {
    return this.all().map((t, i) => this.info(t, i));
  }

  getActiveTerminal(): TerminalInfo | null {
    const active = vscode.window.activeTerminal;
    if (!active) return null;
    const idx = this.all().indexOf(active);
    return this.info(active, idx);
  }

  focusTerminal(args: Record<string, unknown>): string {
    const terminal = this.resolveOrThrow(args);
    terminal.show();
    return `Focused terminal: "${terminal.name}"`;
  }

  createTerminal(args: Record<string, unknown>): string {
    const options: vscode.TerminalOptions = {};
    if (typeof args['name'] === 'string') options.name = args['name'];
    if (typeof args['cwd'] === 'string') options.cwd = args['cwd'];
    if (typeof args['shellPath'] === 'string') options.shellPath = args['shellPath'];
    if (Array.isArray(args['shellArgs'])) {
      // Validate each element is a string to avoid injection
      const shellArgs = args['shellArgs'] as unknown[];
      if (!shellArgs.every(a => typeof a === 'string')) {
        throw new Error('shellArgs must be an array of strings');
      }
      options.shellArgs = shellArgs as string[];
    }
    const terminal = vscode.window.createTerminal(options);
    terminal.show();
    return `Created terminal: "${terminal.name}"`;
  }

  renameTerminal(args: Record<string, unknown>): string {
    if (typeof args['newName'] !== 'string' || !args['newName'].trim()) {
      throw new Error('newName is required and must be a non-empty string');
    }
    const newName = (args['newName'] as string).replace(/[^\x20-\x7E]/g, '').trim();
    if (!newName) throw new Error('newName contains no printable ASCII characters');
    const terminal = this.resolveOrThrow(args);
    // OSC 1 sets the terminal tab title via the PTY sequence.
    // sendSequence writes directly to the PTY (not stdin), so the shell
    // interprets the escape code and updates the tab title.
    terminal.sendText(`\x1b]0;${newName}\x07`, false);
    return `Renamed terminal to: "${newName}"`;
  }

  closeTerminal(args: Record<string, unknown>): string {
    const terminal = this.resolveOrThrow(args);
    const name = terminal.name;
    terminal.dispose();
    return `Closed terminal: "${name}"`;
  }

  sendTextToTerminal(args: Record<string, unknown>): string {
    if (typeof args['text'] !== 'string') throw new Error('text is required');
    const terminal = this.resolveOrThrow(args);
    const execute = args['execute'] !== false; // default true
    terminal.show();
    terminal.sendText(args['text'], execute);
    return `Sent text to terminal "${terminal.name}"${execute ? ' (executed)' : ' (no Enter)'}`;
  }

  splitTerminal(args: Record<string, unknown>): string {
    const terminal = this.resolve(args) ?? vscode.window.activeTerminal;
    if (!terminal) throw new Error('No terminal to split from');

    // Focus the terminal first so the split targets it
    terminal.show();
    vscode.commands.executeCommand('workbench.action.terminal.split');
    return `Split terminal from: "${terminal.name}"`;
  }

  async runCommand(args: Record<string, unknown>): Promise<string> {
    if (typeof args['command'] !== 'string' || !args['command'].trim()) {
      throw new Error('command is required');
    }
    const command = args['command'] as string;
    const timeoutMs =
      typeof args['timeoutMs'] === 'number' ? (args['timeoutMs'] as number) : 30_000;

    // Prefer a terminal with shell integration
    const terminal = this.resolve(args);
    if (!terminal) throw new Error('No terminal found');

    terminal.show();

    if (terminal.shellIntegration) {
      return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`Command timed out after ${timeoutMs}ms`)),
          timeoutMs
        );

        const execution = terminal!.shellIntegration!.executeCommand(command);

        const disposable = vscode.window.onDidEndTerminalShellExecution(async event => {
          if (event.execution !== execution) return;
          disposable.dispose();
          clearTimeout(timeout);

          try {
            const stream = event.execution.read();
            let output = '';
            for await (const data of stream) {
              output += data;
            }
            resolve(
              JSON.stringify({
                command,
                exitCode: event.exitCode,
                output: output.trim(),
              })
            );
          } catch (err) {
            reject(err);
          }
        });
      });
    }

    // Fallback: send text without output capture
    terminal.sendText(command, true);
    return JSON.stringify({
      command,
      note: 'Shell integration unavailable — command was sent but output cannot be captured. Upgrade to VS Code 1.93+ for output capture.',
    });
  }
}
