import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IdleDetector,
  IDLE_SESSION_CUT_MS,
  SMART_IDLE_THRESHOLD_MS,
  formatInactiveHours,
  formatStartTime,
  SessionBreakNode,
  RootTrunkNode,
  IdlePromptEvent,
} from './idleDetector';
import { DatabaseManager } from '../storage/db';

describe('IdleDetector', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('defines IDLE_SESSION_CUT_MS as 30 minutes (1,800,000 ms) and SMART_IDLE_THRESHOLD_MS as 5 minutes', () => {
    expect(IDLE_SESSION_CUT_MS).toBe(30 * 60 * 1000);
    expect(SMART_IDLE_THRESHOLD_MS).toBe(5 * 60 * 1000);
  });

  it('formats inactive hours correctly', () => {
    expect(formatInactiveHours(30 * 60 * 1000)).toBe('0.5 hrs');
    expect(formatInactiveHours(45 * 60 * 1000)).toBe('0.8 hrs');
    expect(formatInactiveHours(60 * 60 * 1000)).toBe('1 hrs');
    expect(formatInactiveHours(90 * 60 * 1000)).toBe('1.5 hrs');
    expect(formatInactiveHours(120 * 60 * 1000)).toBe('2 hrs');
  });

  it('does not trigger smart idle prompt when activity occurs within 5 minutes', async () => {
    let promptEmitted = false;
    const detector = new IdleDetector({
      onIdleReturnPrompt: () => {
        promptEmitted = true;
      },
    });

    const startT = 1000_000;
    detector.setLastActivityTimestamp(startT);

    // 3 minutes later (< 5 mins)
    const result = await detector.registerActivity(startT + 3 * 60 * 1000);
    expect(result).toBeNull();
    expect(promptEmitted).toBe(false);
    detector.dispose();
  });

  it('triggers smart idle return prompt when returning from idle > 5 minutes', async () => {
    let promptEvent: IdlePromptEvent | undefined;
    const detector = new IdleDetector({
      onIdleReturnPrompt: (evt) => {
        promptEvent = evt;
      },
    });

    const startT = 1000_000;
    detector.setLastActivityTimestamp(startT);

    // 15 minutes later (900,000 ms > 300,000 ms)
    const activeT = startT + 15 * 60 * 1000;
    const result = await detector.registerActivity(activeT);

    expect(result).not.toBeNull();
    expect(result?.idlePromptEvent).toBeDefined();
    expect(promptEvent).toBeDefined();
    expect(promptEvent?.mins).toBe(15);
    expect(promptEvent?.durationSeconds).toBe(900);
    expect(promptEvent?.startTime).toBe(startT);
    detector.dispose();
  });

  it('logs idle time block into SQLite database when logIdleTime is called', async () => {
    const dbManager = new DatabaseManager();
    await dbManager.initialize();

    const detector = new IdleDetector({ dbManager });
    const session = await detector.logIdleTime('Meeting', 900, Date.now() - 900000, 'TestRepo', 'feature-branch', '/src/index.ts');

    expect(session).not.toBeNull();
    expect(session?.duration_seconds).toBe(900);
    expect(session?.file_path).toContain('[Meeting]');
    expect(session?.repo_name).toBe('TestRepo');
    expect(session?.git_branch).toBe('feature-branch');

    const sessions = await dbManager.getSessions();
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].file_path).toContain('[Meeting]');

    detector.dispose();
    await dbManager.close();
  });

  it('triggers session break and flushes when inactivity exceeds 30 minutes', async () => {
    let flushed = false;
    let emittedBreak: SessionBreakNode | undefined;
    let emittedRoot: RootTrunkNode | undefined;

    const detector = new IdleDetector({
      onFlush: () => {
        flushed = true;
      },
      onSessionBreak: (node) => {
        emittedBreak = node;
      },
      onNewSessionStart: (node) => {
        emittedRoot = node;
      },
    });

    const startT = 1000_000;
    detector.setLastActivityTimestamp(startT);

    // Activity arrives 45 minutes later (2,700,000 ms > 1,800,000 ms)
    const activeT = startT + 45 * 60 * 1000;
    const result = await detector.registerActivity(activeT);

    expect(result).not.toBeNull();
    expect(flushed).toBe(true);

    // 1. Session Break node emitted
    expect(emittedBreak).toBeDefined();
    expect(emittedBreak?.type).toBe('SESSION_BREAK');
    expect(emittedBreak?.label).toContain('● [Session Break • Inactive for 0.8 hrs]');
    expect(emittedBreak?.inactiveMs).toBe(45 * 60 * 1000);

    // 2. Root Trunk node emitted
    expect(emittedRoot).toBeDefined();
    expect(emittedRoot?.type).toBe('ROOT_TRUNK');
    expect(emittedRoot?.label).toContain('— New Session');

    detector.dispose();
  });
});
