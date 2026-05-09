/**
 * Typed error codes for consistent error reporting across the MCP server.
 * Follows the playbooks-mcp pattern: each error has a code, message, and optional metadata.
 */

export enum ErrorCode {
  /** Terminal not found by name or index */
  TERMINAL_NOT_FOUND = 'TERMINAL_NOT_FOUND',
  /** Invalid or missing required argument */
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  /** Command execution timed out waiting for output */
  COMMAND_TIMEOUT = 'COMMAND_TIMEOUT',
  /** Shell integration is unavailable on the target terminal */
  SHELL_INTEGRATION_UNAVAILABLE = 'SHELL_INTEGRATION_UNAVAILABLE',
  /** Internal server error (unexpected) */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  /** Port already in use */
  PORT_IN_USE = 'PORT_IN_USE',
}

export interface McpErrorResult {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Factory for creating a typed error result.
 * The `details` field carries optional metadata (e.g. tool name, terminal index).
 */
export function makeError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): McpErrorResult {
  return { code, message, ...(details && { details }) };
}

/**
 * Wraps a raw Error into an McpErrorResult with the INTERNAL_ERROR code.
 */
export function wrapError(err: unknown): McpErrorResult {
  return makeError(ErrorCode.INTERNAL_ERROR, err instanceof Error ? err.message : String(err));
}
