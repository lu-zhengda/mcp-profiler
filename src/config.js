/**
 * src/config.js — Reads MCP server configuration from known locations
 *
 * Supported config locations:
 * 1. claude_desktop_config.json (Claude Desktop)
 * 2. .mcp.json (project-level MCP config)
 * 3. ~/.claude/settings.json (Claude Code plugins that provide MCP tools)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_DESKTOP_CONFIG = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Claude',
  'claude_desktop_config.json',
);

/**
 * Try to read and parse a JSON file. Returns null on failure.
 */
function tryReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Extract MCP server names from claude_desktop_config.json
 * Format: { mcpServers: { "server-name": { command, args, ... } } }
 */
function extractDesktopServers(config) {
  const servers = config?.mcpServers || {};
  return Object.keys(servers);
}

/**
 * Load configured MCP servers from the given config path,
 * or auto-detect from known locations.
 *
 * Returns { configPath: string|null, servers: string[] }
 */
export function loadConfigServers(configPath) {
  // Explicit path provided
  if (configPath) {
    const config = tryReadJson(configPath);
    if (!config) {
      return { configPath, servers: [], error: `Could not read config: ${configPath}` };
    }
    return { configPath, servers: extractDesktopServers(config) };
  }

  // Auto-detect: Claude Desktop config
  const desktopConfig = tryReadJson(DEFAULT_DESKTOP_CONFIG);
  if (desktopConfig) {
    const servers = extractDesktopServers(desktopConfig);
    if (servers.length > 0) {
      return { configPath: DEFAULT_DESKTOP_CONFIG, servers };
    }
  }

  // Auto-detect: .mcp.json in home dir
  const homeMcp = tryReadJson(path.join(os.homedir(), '.mcp.json'));
  if (homeMcp) {
    const servers = extractDesktopServers(homeMcp);
    if (servers.length > 0) {
      return { configPath: path.join(os.homedir(), '.mcp.json'), servers };
    }
  }

  return { configPath: null, servers: [] };
}
