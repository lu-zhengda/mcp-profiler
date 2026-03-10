import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMcpToolName } from '../src/parser.js';

describe('parseMcpToolName', () => {
  it('parses a standard MCP tool name', () => {
    const result = parseMcpToolName('mcp__claude_ai_Notion__notion-search');
    assert.deepStrictEqual(result, {
      server: 'claude_ai_Notion',
      tool: 'notion-search',
    });
  });

  it('parses a plugin tool name with hyphens', () => {
    const result = parseMcpToolName('mcp__plugin_sonatype-guide_sonatype-guide__getComponentVersion');
    assert.deepStrictEqual(result, {
      server: 'plugin_sonatype-guide_sonatype-guide',
      tool: 'getComponentVersion',
    });
  });

  it('returns null for non-MCP tool names', () => {
    assert.strictEqual(parseMcpToolName('Read'), null);
    assert.strictEqual(parseMcpToolName('Bash'), null);
    assert.strictEqual(parseMcpToolName(''), null);
  });

  it('handles tool name without double-underscore separator', () => {
    const result = parseMcpToolName('mcp__standalone');
    assert.deepStrictEqual(result, {
      server: 'standalone',
      tool: 'standalone',
    });
  });
});
