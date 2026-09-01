import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from './db';
import { Session } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  let tempDbPath: string;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrace-test-'));
    tempDbPath = path.join(tempDir, 'test-retrace.db');
    dbManager = new DatabaseManager(tempDbPath);
    await dbManager.initialize();
  });

  afterEach(() => {
    dbManager.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should initialize empty database and return empty sessions', async () => {
    const sessions = await dbManager.getSessions();
    expect(sessions).toEqual([]);
  });

  it('should insert and retrieve a session correctly', async () => {
    const session: Session = {
      id: 'test-session-1',
      file_path: '/path/to/file.ts',
      repo_name: 'retrace-repo',
      git_branch: 'main',
      start_time: Date.now() - 3600000,
      duration_seconds: 120,
      lines_added: 15,
      lines_deleted: 3,
      cursor_start_line: 10,
      cursor_end_line: 25,
      timestamp: Date.now(),
    };

    await dbManager.insertSession(session);

    const sessions = await dbManager.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual(session);
  });

  it('should filter sessions by time range', async () => {
    const now = Date.now();
    const oldSession: Session = {
      id: 'old-1',
      file_path: '/path/old.ts',
      repo_name: 'repo1',
      git_branch: 'main',
      start_time: now - 48 * 3600 * 1000,
      duration_seconds: 300,
      lines_added: 5,
      lines_deleted: 2,
      cursor_start_line: 1,
      cursor_end_line: 10,
      timestamp: now - 48 * 3600 * 1000,
    };

    const recentSession: Session = {
      id: 'recent-1',
      file_path: '/path/recent.ts',
      repo_name: 'repo1',
      git_branch: 'main',
      start_time: now - 3600 * 1000,
      duration_seconds: 600,
      lines_added: 20,
      lines_deleted: 1,
      cursor_start_line: 5,
      cursor_end_line: 15,
      timestamp: now - 3600 * 1000,
    };

    await dbManager.insertSession(oldSession);
    await dbManager.insertSession(recentSession);

    const allSessions = await dbManager.getSessions();
    expect(allSessions).toHaveLength(2);

    const last24h = await dbManager.getSessions(24 * 3600 * 1000);
    expect(last24h).toHaveLength(1);
    expect(last24h[0].id).toBe('recent-1');
  });

  it('should calculate repo metrics correctly', async () => {
    const now = Date.now();
    const session1: Session = {
      id: 's1',
      file_path: '/path/a.ts',
      repo_name: 'repo-alpha',
      git_branch: 'main',
      start_time: now - 1000,
      duration_seconds: 100,
      lines_added: 10,
      lines_deleted: 2,
      cursor_start_line: 1,
      cursor_end_line: 5,
      timestamp: now - 1000,
    };

    const session2: Session = {
      id: 's2',
      file_path: '/path/b.ts',
      repo_name: 'repo-alpha',
      git_branch: 'feat',
      start_time: now,
      duration_seconds: 200,
      lines_added: 5,
      lines_deleted: 8,
      cursor_start_line: 10,
      cursor_end_line: 20,
      timestamp: now,
    };

    await dbManager.insertSession(session1);
    await dbManager.insertSession(session2);

    const metrics = await dbManager.getRepoMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toEqual({
      repo_name: 'repo-alpha',
      total_duration: 300,
      lines_added: 15,
      lines_deleted: 10,
      session_count: 2,
    });
  });
});
