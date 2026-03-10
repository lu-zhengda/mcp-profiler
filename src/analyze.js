/**
 * src/analyze.js — Main analysis pipeline
 */

import { findAllSessionLogs, filterByDays } from './scanner.js';
import { extractMcpCalls, extractRegisteredTools } from './parser.js';
import { aggregateCalls, rankByUsage, findNeverCalled, findRemovableServers } from './aggregator.js';
import { loadConfigServers } from './config.js';
import { printUsageTable, printNeverCalled, printConfigDiff, printSummary } from './format.js';

/**
 * Deduplicate tool names: remove truncated names that are prefixes of full names.
 * Handles ANSI line-wrap truncation in terminal output stored in logs.
 */
function deduplicateToolNames(names) {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  const result = new Set();
  for (const name of sorted) {
    const isPrefix = [...result].some((longer) => longer.startsWith(name) && longer !== name);
    if (!isPrefix) {
      result.add(name);
    }
  }
  return result;
}

/**
 * Run the full analysis pipeline.
 */
export async function analyze({ days, configPath, jsonOutput }) {
  // 1. Find and filter session logs
  const allLogs = findAllSessionLogs();
  const logs = filterByDays(allLogs, days);

  if (logs.length === 0) {
    console.log(`No Claude Code session logs found in the last ${days} days.`);
    console.log('Logs are stored in ~/.claude/projects/');
    process.exit(0);
  }

  // 2. Extract MCP tool calls from all sessions
  const allCalls = [];
  const rawRegistered = new Set();

  for (const log of logs) {
    const [calls, registered] = await Promise.all([
      extractMcpCalls(log.filePath),
      extractRegisteredTools(log.filePath),
    ]);

    allCalls.push(...calls);
    for (const name of registered) {
      rawRegistered.add(name);
    }
  }

  // 2b. Deduplicate truncated names
  const registeredTools = deduplicateToolNames(rawRegistered);

  // 3. Also add tools from config file (if found)
  const configResult = loadConfigServers(configPath);
  if (configResult.error) {
    console.warn(`Warning: ${configResult.error}`);
  }

  // 4. Aggregate
  const aggregated = aggregateCalls(allCalls);
  const ranked = rankByUsage(aggregated);
  const neverCalled = findNeverCalled(registeredTools, aggregated);
  const removableServers = findRemovableServers(registeredTools, aggregated);

  // 5. Output
  const summary = {
    days,
    sessionsScanned: logs.length,
    totalCalls: allCalls.length,
    uniqueToolsUsed: aggregated.size,
    registeredTools: registeredTools.size,
    neverCalled: neverCalled.length,
    removableServers: removableServers.length,
  };

  if (jsonOutput) {
    const output = {
      summary,
      usage: ranked,
      neverCalled,
      removableServers,
      configPath: configResult.configPath,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  printSummary(summary);
  printUsageTable(ranked);
  printNeverCalled(neverCalled);
  printConfigDiff(removableServers);

  if (configResult.configPath) {
    console.log(`\x1b[2mConfig: ${configResult.configPath}\x1b[0m`);
  }
}
