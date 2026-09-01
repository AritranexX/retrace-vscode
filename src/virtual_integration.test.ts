import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseManager } from './storage/db';
import { WorkspaceWatcher } from './tracker/workspaceWatcher';
import { generateLeftSpineTree } from './tracker/graphEngine';
import { calculateLineChanges } from './tracker/diffHelper';

describe('Virtual Environment Robust Extension Integration Test', () => {
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    dbManager = new DatabaseManager();
    await dbManager.initialize();
  });

  afterEach(async () => {
    await dbManager.close();
  });

  it('runs complete extension lifecycle in virtual workspace environment', async () => {
    // 1. Database Verification
    const initialSessions = await dbManager.getSessions();
    expect(initialSessions).toEqual([]);

    // 2. Insert sessions across multiple simulated Git branches
    const now = Date.now();

    // Branch A: feature/auth-login
    await dbManager.insertSession({
      id: 'session-1',
      file_path: '/project/src/auth/LoginView.tsx',
      repo_name: 'Mark-XLVII',
      git_branch: 'feature/auth-login',
      start_time: now - 3600 * 1000,
      duration_seconds: 1800, // 30 mins
      lines_added: 45,
      lines_deleted: 10,
      cursor_start_line: 12,
      cursor_end_line: 35,
      timestamp: now - 1800 * 1000,
    });

    await dbManager.insertSession({
      id: 'session-2',
      file_path: '/project/src/auth/authService.ts',
      repo_name: 'Mark-XLVII',
      git_branch: 'feature/auth-login',
      start_time: now - 1800 * 1000,
      duration_seconds: 1200, // 20 mins
      lines_added: 20,
      lines_deleted: 2,
      cursor_start_line: 1,
      cursor_end_line: 15,
      timestamp: now - 600 * 1000,
    });

    // Branch B: hotfix-api-crash
    await dbManager.insertSession({
      id: 'session-3',
      file_path: '/project/src/api/interceptor.ts',
      repo_name: 'Mark-XLVII',
      git_branch: 'hotfix-api-crash',
      start_time: now - 600 * 1000,
      duration_seconds: 2400, // 40 mins
      lines_added: 12,
      lines_deleted: 8,
      cursor_start_line: 50,
      cursor_end_line: 65,
      timestamp: now,
    });

    // 3. Retrieve sessions & build Left-Spine timeline tree
    const allSessions = await dbManager.getSessions();
    expect(allSessions).toHaveLength(3);

    const tree = generateLeftSpineTree(allSessions, true, '/project/src/api/interceptor.ts');

    // 4. Verify Auto-Grouping by Git Branch
    expect(tree.groups).toHaveLength(2);

    const authBranchGroup = tree.groups.find((g) => g.gitBranch === 'feature/auth-login');
    expect(authBranchGroup).toBeDefined();
    expect(authBranchGroup?.headerTitle).toBe('🌿 branch: feature/auth-login');
    expect(authBranchGroup?.totalDurationSeconds).toBe(3000); // 1800 + 1200
    expect(authBranchGroup?.files).toHaveLength(2);

    const hotfixBranchGroup = tree.groups.find((g) => g.gitBranch === 'hotfix-api-crash');
    expect(hotfixBranchGroup).toBeDefined();
    expect(hotfixBranchGroup?.headerTitle).toBe('🌿 branch: hotfix-api-crash');
    expect(hotfixBranchGroup?.totalDurationSeconds).toBe(2400);
    expect(hotfixBranchGroup?.files).toHaveLength(1);

    // 5. Verify Active File Node state
    expect(tree.activeNode?.filePath).toBe('/project/src/api/interceptor.ts');
    expect(tree.activeNode?.isLatest).toBe(true);

    // 6. Verify Line Diff Calculation Helper
    const diff = calculateLineChanges(
      'function test() {\n  return true;\n}',
      'function test() {\n  console.log("debug");\n  return true;\n}'
    );
    expect(diff.linesAdded).toBe(1);
    expect(diff.linesDeleted).toBe(0);
  });
});
