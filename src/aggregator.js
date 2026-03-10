/**
 * src/aggregator.js — Aggregates MCP tool calls into frequency table
 */

/**
 * Aggregate an array of MCP call records into a frequency map.
 *
 * Input:  [{ server, tool, fullName, timestamp }, ...]
 * Output: Map<fullName, { server, tool, fullName, count, lastUsed }>
 */
export function aggregateCalls(calls) {
  const map = new Map();

  for (const call of calls) {
    const existing = map.get(call.fullName);
    if (existing) {
      existing.count += 1;
      if (call.timestamp && (!existing.lastUsed || call.timestamp > existing.lastUsed)) {
        existing.lastUsed = call.timestamp;
      }
    } else {
      map.set(call.fullName, {
        server: call.server,
        tool: call.tool,
        fullName: call.fullName,
        count: 1,
        lastUsed: call.timestamp,
      });
    }
  }

  return map;
}

/**
 * Build a ranked list sorted by call count (descending).
 */
export function rankByUsage(aggregated) {
  return [...aggregated.values()].sort((a, b) => b.count - a.count);
}

/**
 * Given a set of all registered tool names and the aggregated usage map,
 * return the tools that were never called.
 */
export function findNeverCalled(registeredTools, aggregated) {
  const neverCalled = [];

  for (const fullName of registeredTools) {
    if (!aggregated.has(fullName)) {
      // Parse server/tool from the name
      const rest = fullName.slice('mcp__'.length);
      const sep = rest.indexOf('__');
      const server = sep === -1 ? rest : rest.slice(0, sep);
      const tool = sep === -1 ? rest : rest.slice(sep + 2);
      neverCalled.push({ server, tool, fullName });
    }
  }

  return neverCalled.sort((a, b) => a.server.localeCompare(b.server) || a.tool.localeCompare(b.tool));
}

/**
 * Group tools by server. Returns Map<server, tool[]>
 */
export function groupByServer(tools) {
  const groups = new Map();
  for (const t of tools) {
    const list = groups.get(t.server) || [];
    list.push(t);
    groups.set(t.server, list);
  }
  return groups;
}

/**
 * Identify servers where ALL tools are never-called (candidates for removal).
 */
export function findRemovableServers(registeredTools, aggregated) {
  // Group all registered tools by server
  const serverTools = new Map();
  for (const fullName of registeredTools) {
    const rest = fullName.slice('mcp__'.length);
    const sep = rest.indexOf('__');
    const server = sep === -1 ? rest : rest.slice(0, sep);
    const tools = serverTools.get(server) || [];
    tools.push(fullName);
    serverTools.set(server, tools);
  }

  const removable = [];
  for (const [server, tools] of serverTools) {
    const allUnused = tools.every((t) => !aggregated.has(t));
    if (allUnused) {
      removable.push({ server, toolCount: tools.length, tools });
    }
  }

  return removable.sort((a, b) => a.server.localeCompare(b.server));
}
