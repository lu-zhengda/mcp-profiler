import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateCalls,
  rankByUsage,
  findNeverCalled,
  findRemovableServers,
} from '../src/aggregator.js';

describe('aggregateCalls', () => {
  it('counts calls per tool', () => {
    const calls = [
      { server: 'notion', tool: 'search', fullName: 'mcp__notion__search', timestamp: '2026-01-01' },
      { server: 'notion', tool: 'search', fullName: 'mcp__notion__search', timestamp: '2026-01-02' },
      { server: 'notion', tool: 'fetch', fullName: 'mcp__notion__fetch', timestamp: '2026-01-01' },
    ];
    const result = aggregateCalls(calls);
    assert.strictEqual(result.get('mcp__notion__search').count, 2);
    assert.strictEqual(result.get('mcp__notion__fetch').count, 1);
  });

  it('tracks the latest timestamp', () => {
    const calls = [
      { server: 's', tool: 't', fullName: 'mcp__s__t', timestamp: '2026-01-01' },
      { server: 's', tool: 't', fullName: 'mcp__s__t', timestamp: '2026-03-01' },
      { server: 's', tool: 't', fullName: 'mcp__s__t', timestamp: '2026-02-01' },
    ];
    const result = aggregateCalls(calls);
    assert.strictEqual(result.get('mcp__s__t').lastUsed, '2026-03-01');
  });

  it('returns empty map for no calls', () => {
    assert.strictEqual(aggregateCalls([]).size, 0);
  });
});

describe('rankByUsage', () => {
  it('sorts by count descending', () => {
    const map = new Map([
      ['a', { count: 1 }],
      ['b', { count: 5 }],
      ['c', { count: 3 }],
    ]);
    const ranked = rankByUsage(map);
    assert.deepStrictEqual(
      ranked.map((r) => r.count),
      [5, 3, 1],
    );
  });
});

describe('findNeverCalled', () => {
  it('returns tools not in aggregated map', () => {
    const registered = new Set(['mcp__s__tool1', 'mcp__s__tool2', 'mcp__s__tool3']);
    const aggregated = new Map([['mcp__s__tool1', { count: 1 }]]);
    const result = findNeverCalled(registered, aggregated);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(
      result.map((r) => r.tool).sort(),
      ['tool2', 'tool3'],
    );
  });

  it('returns empty when all tools are used', () => {
    const registered = new Set(['mcp__s__t']);
    const aggregated = new Map([['mcp__s__t', { count: 1 }]]);
    assert.strictEqual(findNeverCalled(registered, aggregated).length, 0);
  });
});

describe('findRemovableServers', () => {
  it('identifies servers with all tools unused', () => {
    const registered = new Set([
      'mcp__serverA__tool1',
      'mcp__serverA__tool2',
      'mcp__serverB__tool1',
    ]);
    // Only serverB__tool1 is used
    const aggregated = new Map([['mcp__serverB__tool1', { count: 1 }]]);
    const result = findRemovableServers(registered, aggregated);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].server, 'serverA');
    assert.strictEqual(result[0].toolCount, 2);
  });

  it('does not flag servers with at least one used tool', () => {
    const registered = new Set([
      'mcp__s__tool1',
      'mcp__s__tool2',
    ]);
    const aggregated = new Map([['mcp__s__tool1', { count: 1 }]]);
    const result = findRemovableServers(registered, aggregated);
    assert.strictEqual(result.length, 0);
  });
});
