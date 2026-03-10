#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { analyze } from '../src/analyze.js';

const HELP = `
mcp-profiler — Find out which MCP tools you actually use

Usage:
  mcp-profiler analyze [options]

Options:
  --days N        Number of days to look back (default: 30)
  --config PATH   Path to claude_desktop_config.json or .mcp.json
  --json          Output as JSON instead of table
  --help          Show this help
`;

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      days: { type: 'string', default: '30' },
      config: { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const command = positionals[0];

  if (command !== 'analyze') {
    console.error(`Unknown command: ${command}\n`);
    console.log(HELP);
    process.exit(1);
  }

  analyze({
    days: parseInt(values.days, 10) || 30,
    configPath: values.config,
    jsonOutput: values.json,
  });
}

main();
