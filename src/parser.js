/**
 * src/parser.js — Extracts MCP tool call entries from JSONL session logs
 *
 * MCP tools in Claude Code follow the naming convention:
 *   mcp__<server_id>__<tool_name>
 *
 * Examples:
 *   mcp__claude_ai_Notion__notion-search
 *   mcp__plugin_sonatype-guide_sonatype-guide__getComponentVersion
 */

import fs from 'node:fs';
import readline from 'node:readline';

const MCP_PREFIX = 'mcp__';

/**
 * Parse the MCP tool name into server and tool components.
 *
 * Convention: mcp__<server>__<tool>
 * The server portion may contain underscores, so we split on the
 * double-underscore boundary after the initial "mcp__" prefix.
 */
export function parseMcpToolName(name) {
  if (!name.startsWith(MCP_PREFIX)) return null;

  const rest = name.slice(MCP_PREFIX.length);
  const separatorIdx = rest.indexOf('__');
  if (separatorIdx === -1) {
    return { server: rest, tool: rest };
  }

  return {
    server: rest.slice(0, separatorIdx),
    tool: rest.slice(separatorIdx + 2),
  };
}

/**
 * Extract all MCP tool calls from a single JSONL file.
 * Returns array of { server, tool, fullName, timestamp }
 */
export async function extractMcpCalls(filePath) {
  const calls = [];
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.includes(MCP_PREFIX)) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    // Only look at assistant messages with tool_use blocks
    if (entry.type !== 'assistant') continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;

    const timestamp = entry.timestamp || null;

    for (const block of content) {
      if (block?.type !== 'tool_use') continue;
      const name = block.name || '';
      if (!name.startsWith(MCP_PREFIX)) continue;

      const parsed = parseMcpToolName(name);
      if (!parsed) continue;

      calls.push({
        server: parsed.server,
        tool: parsed.tool,
        fullName: name,
        timestamp,
      });
    }
  }

  return calls;
}

// Strips ANSI escape sequences from a string
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Extract all registered MCP tool names from a session log.
 *
 * Claude Code logs MCP tools in two ways:
 * 1. ANSI-formatted string in context usage display (user message, string content)
 *    Format: "└ mcp__server__tool: N.Nk tokens\n..."
 * 2. Actual tool_use blocks in assistant messages (tools that were called).
 *
 * We parse both sources, stripping ANSI codes and rejecting obviously
 * corrupted names (those containing digits, which come from token-count
 * values being injected into line-wrapped tool names).
 */
export async function extractRegisteredTools(filePath) {
  const registered = new Set();
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  // Valid MCP tool names: only letters, hyphens, underscores (no digits)
  const mcpPattern = /mcp__[a-zA-Z_-]+__[a-zA-Z_-]+/g;

  for await (const line of rl) {
    if (!line.includes(MCP_PREFIX)) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const content = entry.message?.content;

    // 1. Parse ANSI context-usage string (primary source of registered tools)
    if (typeof content === 'string' && content.includes(MCP_PREFIX)) {
      // Strip ANSI codes, remove injected token counts between name fragments,
      // then rejoin lines that were split mid-name by terminal wrapping.
      const clean = stripAnsi(content)
        .replace(/(?<=[\w-])(\d+\.\d+[kKMmB]? *)\n/g, '\n') // remove mid-name token counts
        .replace(/(?<=[a-zA-Z-])\n(?=[a-z])/g, ''); // rejoin wrapped lines

      for (const match of clean.matchAll(mcpPattern)) {
        registered.add(match[0]);
      }
    }

    // 2. Actual tool_use blocks (tools that were already called)
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'tool_use' && block.name?.startsWith(MCP_PREFIX)) {
          registered.add(block.name);
        }
        // 3. Check text blocks that contain deferred tool listings
        //    (system-inserted content, always has uncorrupted tool names)
        if (
          block?.type === 'text' &&
          typeof block.text === 'string' &&
          block.text.includes(MCP_PREFIX) &&
          block.text.includes('available-deferred-tools')
        ) {
          for (const match of block.text.matchAll(mcpPattern)) {
            registered.add(match[0]);
          }
        }
      }
    }
  }

  return registered;
}
