/**
 * Structured JSON logger for the Terminal MCP server.
 * Follows the playbooks-mcp pattern: every log entry is a JSON line with
 * timestamp, level, module, message, and optional details.
 *
 * This makes logs machine-parseable and searchable by module name.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  details?: Record<string, unknown>;
}

function log(
  level: LogLevel,
  module: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  };
  if (details) {
    entry.details = details;
  }

  const output = JSON.stringify(entry);
  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
      break;
  }
}

export const logger = {
  debug: (module: string, message: string, details?: Record<string, unknown>) =>
    log('debug', module, message, details),
  info: (module: string, message: string, details?: Record<string, unknown>) =>
    log('info', module, message, details),
  warn: (module: string, message: string, details?: Record<string, unknown>) =>
    log('warn', module, message, details),
  error: (module: string, message: string, details?: Record<string, unknown>) =>
    log('error', module, message, details),
};
