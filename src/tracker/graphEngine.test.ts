import { describe, it, expect } from 'vitest';
import { calculateJumpLevel, generateSessionGraph, generateLeftSpineTree } from './graphEngine';
import { Session } from '../storage/types';

describe('graphEngine', () => {
  const baseSession: Session = {
    id: 's1',
    file_path: '/repo/src/components/Button.tsx',
    repo_name: 'my-repo',
    git_branch: 'main',
    start_time: 1000,
    duration_seconds: 60,
    lines_added: 5,
    lines_deleted: 1,
    cursor_start_line: 10,
    cursor_end_line: 20,
    timestamp: 1000000,
  };

  it('calculates Level 1 for same folder', () => {
    const s1 = { ...baseSession, file_path: '/repo/src/components/Button.tsx' };
    const s2 = { ...baseSession, id: 's2', file_path: '/repo/src/components/Input.tsx', timestamp: 1000000 + 3600 * 1000 };

    const level = calculateJumpLevel(s1, s2);
    expect(level).toBe(1);
  });

  it('calculates Level 1 for quick edit across files', () => {
    const s1 = { ...baseSession, file_path: '/repo/src/components/Button.tsx', timestamp: 1000000, duration_seconds: 10 };
    const s2 = { ...baseSession, id: 's2', file_path: '/repo/src/utils/format.ts', timestamp: 1000015 };

    const level = calculateJumpLevel(s1, s2);
    expect(level).toBe(1);
  });

  it('calculates Level 2 for sibling directories in same repo', () => {
    const s1 = { ...baseSession, file_path: '/repo/src/components/Button.tsx', timestamp: 1000000, duration_seconds: 10 };
    const s2 = { ...baseSession, id: 's2', file_path: '/repo/src/utils/format.ts', timestamp: 2000000 };

    const level = calculateJumpLevel(s1, s2);
    expect(level).toBe(2);
  });

  it('calculates Level 3 for major jumps across sub-projects', () => {
    const s1 = { ...baseSession, file_path: '/repo/packages/frontend/src/App.tsx', timestamp: 1000000, duration_seconds: 10 };
    const s2 = { ...baseSession, id: 's2', file_path: '/repo/packages/backend/src/server.ts', timestamp: 2000000 };

    const level = calculateJumpLevel(s1, s2);
    expect(level).toBe(3);
  });

  it('calculates Level 3 for cross-repo switches', () => {
    const s1 = { ...baseSession, repo_name: 'frontend-repo', file_path: '/repo1/App.tsx', timestamp: 1000000 };
    const s2 = { ...baseSession, id: 's2', repo_name: 'backend-repo', file_path: '/repo2/server.ts', timestamp: 2000000 };

    const level = calculateJumpLevel(s1, s2);
    expect(level).toBe(3);
  });

  it('clusters nodes for repeated visits to the same file', () => {
    const s1 = { ...baseSession, id: 's1', file_path: '/repo/src/App.tsx', timestamp: 1000000, duration_seconds: 30, lines_added: 2, lines_deleted: 1 };
    const s2 = { ...baseSession, id: 's2', file_path: '/repo/src/utils.ts', timestamp: 2000000, duration_seconds: 40, lines_added: 5, lines_deleted: 0 };
    const s3 = { ...baseSession, id: 's3', file_path: '/repo/src/App.tsx', timestamp: 3000000, duration_seconds: 50, lines_added: 10, lines_deleted: 2 };

    const graph = generateSessionGraph([s1, s2, s3]);

    expect(graph.nodes).toHaveLength(2);

    const appNode = graph.nodes.find((n) => n.filePath === '/repo/src/App.tsx');
    expect(appNode).toBeDefined();
    expect(appNode?.visitCount).toBe(2);
    expect(appNode?.totalDurationSeconds).toBe(80);
    expect(appNode?.totalLinesAdded).toBe(12);
    expect(appNode?.totalLinesDeleted).toBe(3);

    expect(graph.edges).toHaveLength(1);
  });

  it('generates Left-Spine tree structure with groups and active node', () => {
    const s1 = { ...baseSession, id: 's1', file_path: '/repo/src/auth/auth.guard.ts', repo_name: 'repo', git_branch: 'feature/auth', timestamp: 1000000, duration_seconds: 60 };
    const s2 = { ...baseSession, id: 's2', file_path: '/repo/src/auth/jwt.service.ts', repo_name: 'repo', git_branch: 'feature/auth', timestamp: 2000000, duration_seconds: 120 };
    const s3 = { ...baseSession, id: 's3', file_path: '/repo/src/controllers/user.controller.ts', repo_name: 'repo', git_branch: 'feature/user', timestamp: 3000000, duration_seconds: 180 };

    const tree = generateLeftSpineTree([s1, s2, s3]);
    expect(tree.groups).toHaveLength(2);
    expect(tree.activeNode?.filePath).toBe('/repo/src/controllers/user.controller.ts');
    expect(tree.activeNode?.isLatest).toBe(true);
    expect(tree.groups[0].files[0].filePath).toBe('/repo/src/auth/auth.guard.ts');
    expect(tree.groups[0].files[1].filePath).toBe('/repo/src/auth/jwt.service.ts');
  });

  it('groups sessions under collapsible headers based on Git Branch or Commit message', () => {
    const s1 = { ...baseSession, id: 's1', file_path: '/repo/src/auth/login.ts', git_branch: 'feature/auth-login', duration_seconds: 60, timestamp: 1000 };
    const s2 = { ...baseSession, id: 's2', file_path: '/repo/src/auth/register.ts', git_branch: 'feature/auth-login', duration_seconds: 120, timestamp: 2000 };
    const s3 = { ...baseSession, id: 's3', file_path: '/repo/src/api/crash.ts', git_branch: 'hotfix-api-crash', duration_seconds: 300, timestamp: 3000 };

    const tree = generateLeftSpineTree([s1, s2, s3]);
    expect(tree.groups).toHaveLength(2);
    expect(tree.groups[0].headerTitle).toBe('🌿 branch: feature/auth-login');
    expect(tree.groups[0].gitBranch).toBe('feature/auth-login');
    expect(tree.groups[0].totalDurationSeconds).toBe(180);
    expect(tree.groups[0].files).toHaveLength(2);

    expect(tree.groups[1].headerTitle).toBe('🌿 branch: hotfix-api-crash');
    expect(tree.groups[1].gitBranch).toBe('hotfix-api-crash');
    expect(tree.groups[1].totalDurationSeconds).toBe(300);
    expect(tree.groups[1].files).toHaveLength(1);
  });

  it('strictly deduplicates sessions and groups under clean branch headers', () => {
    const s1 = { ...baseSession, id: 's1', file_path: '/Users/test/myrepo/bin/activate.csh', repo_name: 'myrepo', duration_seconds: 10, cursor_start_line: 1, cursor_end_line: 1, timestamp: 1000 };
    const s2 = { ...baseSession, id: 's2', file_path: '/Users/test/myrepo/bin/mlx.launch', repo_name: 'myrepo', duration_seconds: 20, cursor_start_line: 5, cursor_end_line: 5, timestamp: 2000 };
    const s3 = { ...baseSession, id: 's3', file_path: '/Users/test/myrepo/bin/mlx_lm.fuse', repo_name: 'myrepo', duration_seconds: 30, cursor_start_line: 10, cursor_end_line: 10, timestamp: 3000 };
    const s4 = { ...baseSession, id: 's4', file_path: '/Users/test/myrepo/bin/mlx.launch', repo_name: 'myrepo', duration_seconds: 40, cursor_start_line: 15, cursor_end_line: 25, timestamp: 4000 };

    const tree = generateLeftSpineTree([s1, s2, s3, s4]);
    expect(tree.groups).toHaveLength(1);
    expect(tree.groups[0].headerTitle).toBe('🌿 branch: main');

    // Only 3 unique files in group
    expect(tree.groups[0].files).toHaveLength(3);

    const mlxLaunchNode = tree.groups[0].files.find((f) => f.fileName === 'mlx.launch');
    expect(mlxLaunchNode).toBeDefined();
    expect(mlxLaunchNode?.visitCount).toBe(2);
    expect(mlxLaunchNode?.durationSeconds).toBe(60); // 20 + 40
    expect(mlxLaunchNode?.cursorStartLine).toBe(15);
    expect(mlxLaunchNode?.cursorEndLine).toBe(25);
    expect(mlxLaunchNode?.isLatest).toBe(true); // Latest active file in session
  });

  it('correctly sets active file when explicit activeFilePathParam is provided', () => {
    const s1 = { ...baseSession, id: 's1', file_path: '/repo/src/auth/auth.guard.ts', repo_name: 'repo', timestamp: 1000000, duration_seconds: 60 };
    const s2 = { ...baseSession, id: 's2', file_path: '/repo/src/controllers/user.controller.ts', repo_name: 'repo', timestamp: 3000000, duration_seconds: 180 };

    // Explicitly set s1 as active file even though s2 was last saved
    const tree = generateLeftSpineTree([s1, s2], true, '/repo/src/auth/auth.guard.ts');
    expect(tree.activeNode?.filePath).toBe('/repo/src/auth/auth.guard.ts');
    expect(tree.activeNode?.isLatest).toBe(true);

    const userCtrlNode = tree.groups.flatMap(g => g.files).find(f => f.filePath === '/repo/src/controllers/user.controller.ts');
    expect(userCtrlNode?.isLatest).toBe(false);
  });

  it('inserts a newly active file if not yet in sessions list', () => {
    const s1 = { ...baseSession, id: 's1', file_path: '/repo/src/auth/auth.guard.ts', repo_name: 'repo', timestamp: 1000000, duration_seconds: 60 };

    const tree = generateLeftSpineTree([s1], true, '/repo/src/components/NewComponent.tsx');
    expect(tree.activeNode?.filePath).toBe('/repo/src/components/NewComponent.tsx');
    expect(tree.activeNode?.isLatest).toBe(true);
    expect(tree.activeNode?.durationSeconds).toBe(0);
  });

  it('handles case-insensitive path matching for active file and inherits repo name', () => {
    const s1 = { ...baseSession, id: 's1', file_path: '/Users/test/qwen_env/bin/activate.fish', repo_name: 'qwen_env', timestamp: 1000000, duration_seconds: 60 };
    const s2 = { ...baseSession, id: 's2', file_path: '/Users/test/qwen_env/bin/mlx_lm.dwq', repo_name: 'qwen_env', timestamp: 2000000, duration_seconds: 120 };

    // Pass active path with different casing or newly active file in same folder
    const tree = generateLeftSpineTree([s1, s2], true, '/users/test/qwen_env/bin/mlx_lm.dwq');
    expect(tree.activeNode?.fileName).toBe('mlx_lm.dwq');
    expect(tree.activeNode?.isLatest).toBe(true);

    const activateFishNode = tree.groups.flatMap(g => g.files).find(f => f.fileName === 'activate.fish');
    expect(activateFishNode?.isLatest).toBe(false);
  });

});
