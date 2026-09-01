import { describe, it, expect, beforeEach } from 'vitest';
import {
  SessionAggregator,
  normalizePath,
  formatSequenceIndicator,
  formatTimeAgo,
} from './sessionAggregator';

describe('SessionAggregator', () => {
  let aggregator: SessionAggregator;

  beforeEach(() => {
    aggregator = new SessionAggregator();
  });

  it('normalizes file paths correctly', () => {
    expect(normalizePath('C:\\project\\src\\main.ts')).toBe('C:/project/src/main.ts');
    expect(normalizePath('/project/src/main.ts')).toBe('/project/src/main.ts');
  });

  it('formats sequence indicators correctly for initial and revisited files', () => {
    expect(formatSequenceIndicator(1, 1)).toBe('[#1]');
    expect(formatSequenceIndicator(1, 2, 120_000)).toBe('[#1 • Revisted 2m ago]');
    expect(formatSequenceIndicator(2, 3, 3_600_000)).toBe('[#2 • Revisted 1h ago]');
    expect(formatSequenceIndicator(3, 2, 5_000)).toBe('[#3 • Revisted just now]');
  });

  it('creates unique nodes based on normalized absolute path', () => {
    const node1 = aggregator.recordHop({
      filePath: '/repo/src/App.tsx',
      durationSeconds: 30,
      linesAdded: 5,
      linesDeleted: 2,
      cursorRange: { startLine: 10, endLine: 15 },
      timestamp: 1000,
    });

    expect(node1.nodeId).toBe('/repo/src/App.tsx');
    expect(node1.sequenceNumber).toBe(1);
    expect(node1.visitCount).toBe(1);
    expect(node1.sequenceIndicator).toBe('[#1]');
    expect(aggregator.getNodeCount()).toBe(1);
  });

  it('applies Rapid Revisit Rule: debounces duplicates and accumulates metrics', () => {
    const startTime = 1000;
    // Visit File A
    aggregator.recordHop({
      filePath: '/repo/src/App.tsx',
      durationSeconds: 30,
      linesAdded: 5,
      linesDeleted: 1,
      cursorRange: { startLine: 1, endLine: 10 },
      timestamp: startTime,
    });

    // Visit File B
    aggregator.recordHop({
      filePath: '/repo/src/Utils.ts',
      durationSeconds: 20,
      linesAdded: 10,
      linesDeleted: 0,
      cursorRange: { startLine: 5, endLine: 20 },
      timestamp: startTime + 30_000,
    });

    expect(aggregator.getNodeCount()).toBe(2);

    // Revisit File A after 2 minutes (120,000 ms)
    const revisitTime = startTime + 120_000;
    const revisitedNode = aggregator.recordHop({
      filePath: '/repo/src/App.tsx',
      durationSeconds: 45,
      linesAdded: 3,
      linesDeleted: 2,
      cursorRange: { startLine: 25, endLine: 35 },
      timestamp: revisitTime,
    });

    // Verify duplicate node was NOT created
    expect(aggregator.getNodeCount()).toBe(2);

    // Verify accumulation
    expect(revisitedNode.totalActiveSeconds).toBe(75); // 30 + 45
    expect(revisitedNode.linesAdded).toBe(8); // 5 + 3
    expect(revisitedNode.linesDeleted).toBe(3); // 1 + 2
    expect(revisitedNode.lastLineRange).toEqual({ startLine: 25, endLine: 35 });
    expect(revisitedNode.visitCount).toBe(2);
    expect(revisitedNode.sequenceNumber).toBe(1);
    expect(revisitedNode.sequenceIndicator).toBe('[#1 • Revisted 2m ago]');
  });

  it('clears active in-memory session graph on reset', () => {
    aggregator.recordHop({
      filePath: '/repo/src/App.tsx',
      durationSeconds: 10,
      cursorRange: { startLine: 1, endLine: 1 },
    });

    expect(aggregator.getNodeCount()).toBe(1);

    aggregator.clear();

    expect(aggregator.getNodeCount()).toBe(0);
    expect(aggregator.getNodes()).toEqual([]);
  });
});
