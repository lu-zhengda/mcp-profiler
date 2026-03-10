# mcp-profiler

Find out which MCP tools you actually use in Claude Code. Kill the ones you don't.

You add MCP servers to your Claude Code config. Each server registers its tools at session start — that's **42,000+ tokens** before you type a single character. Most of those tools you've never called.

`mcp-profiler` reads your Claude Code session logs, aggregates MCP tool call frequency, and tells you exactly what to remove.

## Install

```bash
npx mcp-profiler analyze
```

Or install globally:

```bash
npm install -g mcp-profiler
```

## Usage

```bash
# Analyze the last 30 days (default)
mcp-profiler analyze

# Look back 90 days
mcp-profiler analyze --days 90

# Point to a specific config file
mcp-profiler analyze --config ~/Library/Application\ Support/Claude/claude_desktop_config.json

# JSON output for scripting
mcp-profiler analyze --json
```

## Output

### 1. Ranked Usage Table

Shows every MCP tool you've actually called, ranked by frequency:

```
MCP Tool Usage (ranked by call count)

  Tool              Server           Calls  Last Used
  ────────────────  ───────────────  ─────  ──────────
  notion-search     claude_ai_Notion    42  2d ago
  notion-fetch      claude_ai_Notion    18  5d ago
```

### 2. Never-Called List

Tools registered in your sessions but never invoked:

```
Never-Called Tools (14 tools registered but never invoked)

  claude_ai_Notion
    x notion-create-comment
    x notion-create-database
    x notion-duplicate-page
```

### 3. Removable Servers

Servers where **all** tools are unused — safe to remove entirely:

```
Servers to Remove (all tools unused)

  - plugin_sonatype-guide  (3 tools, 0 calls)
```

## How It Works

1. Scans `~/.claude/projects/**/*.jsonl` for session logs
2. Extracts `tool_use` blocks where the name starts with `mcp__`
3. Parses tool names: `mcp__<server>__<tool>`
4. Aggregates call counts and last-used timestamps
5. Cross-references against all registered tools seen in sessions
6. Outputs ranked table + never-called list + removal recommendations

**It never modifies your config.** Read-only analysis, diff output only.

## Requirements

- Node.js >= 18
- Claude Code (session logs in `~/.claude/projects/`)

## License

MIT
