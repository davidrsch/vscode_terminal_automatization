import { describe, it, expect } from 'vitest';
import { TOOLS } from '../tools';

describe('TOOLS', () => {
  it('has at least one tool defined', () => {
    expect(TOOLS.length).toBeGreaterThan(0);
  });

  it('every tool has a unique name', () => {
    const names = TOOLS.map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every tool has required fields', () => {
    for (const tool of TOOLS) {
      expect(tool.name, `${tool.name}: missing name`).toBeTruthy();
      expect(tool.title, `${tool.name}: missing title`).toBeTruthy();
      expect(tool.description, `${tool.name}: missing description`).toBeTruthy();
      expect(tool.inputSchema, `${tool.name}: missing inputSchema`).toBeDefined();
      expect(tool.inputSchema.type, `${tool.name}: inputSchema.type !== 'object'`).toBe('object');
    }
  });

  it('every tool description is non-empty and reasonable length', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length, `${tool.name}: description too short`).toBeGreaterThan(10);
      expect(tool.description.length, `${tool.name}: description too long`).toBeLessThan(500);
    }
  });

  it('tool names follow snake_case convention', () => {
    for (const tool of TOOLS) {
      expect(tool.name, `${tool.name}: not snake_case`).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('required tools are present', () => {
    const names = new Set(TOOLS.map(t => t.name));
    for (const required of [
      'list_terminals',
      'create_terminal',
      'close_terminal',
      'send_text_to_terminal',
      'run_command',
    ]) {
      expect(names.has(required), `Missing required tool: ${required}`).toBe(true);
    }
  });
});
