/**
 * src/format.js — Terminal table and report formatting
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

/**
 * Format a date string as a relative "N days ago" or absolute date.
 */
function formatDate(isoString) {
  if (!isoString) return 'unknown';
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toISOString().slice(0, 10);
}

/**
 * Pad a string to a given width.
 */
function pad(str, width) {
  const s = String(str);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function padLeft(str, width) {
  const s = String(str);
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

/**
 * Print the main usage table.
 */
export function printUsageTable(ranked) {
  if (ranked.length === 0) {
    console.log(`\n${DIM}No MCP tool calls found in the scanned sessions.${RESET}\n`);
    return;
  }

  // Calculate column widths
  const toolWidth = Math.max(10, ...ranked.map((r) => r.tool.length));
  const serverWidth = Math.max(8, ...ranked.map((r) => r.server.length));
  const countWidth = 6;
  const dateWidth = 12;

  const header =
    `  ${BOLD}${pad('Tool', toolWidth)}  ${pad('Server', serverWidth)}  ${padLeft('Calls', countWidth)}  ${pad('Last Used', dateWidth)}${RESET}`;
  const separator = `  ${'─'.repeat(toolWidth)}  ${'─'.repeat(serverWidth)}  ${'─'.repeat(countWidth)}  ${'─'.repeat(dateWidth)}`;

  console.log(`\n${BOLD}${CYAN}MCP Tool Usage${RESET} (ranked by call count)\n`);
  console.log(header);
  console.log(separator);

  for (const row of ranked) {
    const countColor = row.count >= 10 ? GREEN : row.count >= 3 ? YELLOW : DIM;
    console.log(
      `  ${pad(row.tool, toolWidth)}  ${DIM}${pad(row.server, serverWidth)}${RESET}  ${countColor}${padLeft(String(row.count), countWidth)}${RESET}  ${DIM}${pad(formatDate(row.lastUsed), dateWidth)}${RESET}`,
    );
  }
  console.log();
}

/**
 * Print the never-called tools list.
 */
export function printNeverCalled(neverCalled) {
  if (neverCalled.length === 0) {
    console.log(`${GREEN}All registered MCP tools have been used.${RESET}\n`);
    return;
  }

  console.log(`${BOLD}${YELLOW}Never-Called Tools${RESET} (${neverCalled.length} tools registered but never invoked)\n`);

  // Group by server
  const byServer = new Map();
  for (const t of neverCalled) {
    const list = byServer.get(t.server) || [];
    list.push(t.tool);
    byServer.set(t.server, list);
  }

  for (const [server, tools] of byServer) {
    console.log(`  ${DIM}${server}${RESET}`);
    for (const tool of tools) {
      console.log(`    ${RED}x${RESET} ${tool}`);
    }
  }
  console.log();
}

/**
 * Print config diff — servers recommended for removal.
 */
export function printConfigDiff(removableServers) {
  if (removableServers.length === 0) {
    console.log(`${GREEN}No entire servers to remove — all have at least one used tool.${RESET}\n`);
    return;
  }

  console.log(`${BOLD}${RED}Servers to Remove${RESET} (all tools unused)\n`);
  console.log(`${DIM}These servers have zero tool calls in the scanned period.${RESET}`);
  console.log(`${DIM}You can safely remove them from your config to save context tokens.${RESET}\n`);

  for (const s of removableServers) {
    console.log(`  ${RED}-${RESET} ${BOLD}${s.server}${RESET} ${DIM}(${s.toolCount} tools, 0 calls)${RESET}`);
  }
  console.log();
}

/**
 * Print session scan summary.
 */
export function printSummary(stats) {
  console.log(`${BOLD}${CYAN}Scan Summary${RESET}`);
  console.log(`  Sessions scanned:    ${stats.sessionsScanned}`);
  console.log(`  Period:              last ${stats.days} days`);
  console.log(`  Total MCP calls:     ${stats.totalCalls}`);
  console.log(`  Unique tools used:   ${stats.uniqueToolsUsed}`);
  console.log(`  Registered tools:    ${stats.registeredTools}`);
  console.log(`  Never called:        ${stats.neverCalled}`);
  if (stats.removableServers > 0) {
    console.log(`  ${RED}Removable servers:  ${stats.removableServers}${RESET}`);
  }
  console.log();
}
