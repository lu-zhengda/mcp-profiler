/**
 * src/scanner.js — Finds and filters Claude Code JSONL session logs
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PROJECTS_ROOT = path.join(os.homedir(), '.claude', 'projects');

/**
 * Recursively collect all .jsonl files under ~/.claude/projects/
 * Returns array of { filePath, mtimeMs }
 */
export function findAllSessionLogs() {
  const results = [];
  if (!fs.existsSync(PROJECTS_ROOT)) return results;

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        try {
          const stat = fs.statSync(fullPath);
          results.push({ filePath: fullPath, mtimeMs: stat.mtimeMs });
        } catch {
          // skip unreadable files
        }
      }
    }
  };

  walk(PROJECTS_ROOT);
  return results.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * Filter logs to those modified within the last N days
 */
export function filterByDays(logs, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return logs.filter((log) => log.mtimeMs >= cutoff);
}
