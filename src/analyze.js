/**
 * src/analyze.js — Main analysis pipeline
 */

import { findAllSessionLogs, filterByDays } from './scanner.js';
import { extractMcpCalls, extractRegisteredTools } from './parser.js';
import { aggregateCalls, rankByUsage, findNeverCalled, findRemovableServers } from './aggregator.js';
import { loadConfigServers } from './config.js';
import { printUsageTable, printNeverCalled, printConfigDiff, printSummary } from './format.js';

/**
 * Check if two tool names are similar enough to be the same tool
 * (one is a corrupted version of the other due to ANSI line wrapping).
 * Same server prefix + nearly identical length + high prefix overlap.
 */
function isSimilarToolName(shorter, longer) {
  // Must share the same server prefix (everything before the last __)
  const shorterServer = shorter.slice(0, shorter.lastIndexOf('__'));
  const longerServer = longer.slice(0, longer.lastIndexOf('__'));
  if (shorterServer !== longerServer) return false;

  const shorterTool = shorter.slice(shorter.lastIndexOf('__') + 2);
  const longerTool = longer.slice(longer.lastIndexOf('__') + 2);

  // Length must be very close (within 3 chars — line-wrap corruption is minor)
  const lengthDiff = longerTool.length - shorterTool.length;
  if (lengthDiff <= 0 || lengthDiff > 3) return false;

  // Must share at least 85% of the shorter tool name as a prefix
  const minOverlap = Math.floor(shorterTool.length * 0.85);
  const commonPrefix = longerTool.slice(0, minOverlap);
  return shorterTool.startsWith(commonPrefix);
}

/**
 * Deduplicate tool names: remove truncated/corrupted names that are
 * likely the same tool as a longer, cleaner name.
 * Handles ANSI line-wrap corruption in terminal output stored in logs.
 */
function deduplicateToolNames(names) {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  const result = new Set();
  for (const name of sorted) {
    const isDuplicate = [...result].some(
      (longer) => longer.startsWith(name) || isSimilarToolName(name, longer),
    );
    if (!isDuplicate) {
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
