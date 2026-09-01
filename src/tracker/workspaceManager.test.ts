import { describe, it, expect } from 'vitest';
import {
  getWorkspaceColor,
  deriveRootFolder,
  tagDocument,
  WorkspaceManager,
} from './workspaceManager';

describe('WorkspaceManager', () => {
  it('generates consistent deterministic pastel color hashes based on root folder name', () => {
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

    const color1 = getWorkspaceColor('my-frontend');
    const color2 = getWorkspaceColor('my-frontend');
    const color3 = getWorkspaceColor('backend-api');

    // Determinism
    expect(color1).toBe(color2);
    // Color belongs to allowed palette
    expect(palette).toContain(color1);
    expect(palette).toContain(color3);
  });

  it('derives rootFolder name for active document paths', () => {
    expect(deriveRootFolder('/projects/my-app/src/index.ts')).toBe('src');
    expect(deriveRootFolder('')).toBe('Standalone');
  });

  it('tags documents with rootFolder and workspace color', () => {
    const tag = tagDocument('/projects/retrace/src/App.tsx');
    expect(tag.rootFolder).toBeDefined();
    expect(tag.color).toBe(getWorkspaceColor(tag.rootFolder));
  });

  it('isolates sessions by workspace root folder', () => {
    const manager = new WorkspaceManager();
    const sessions = [
      { filePath: '/repoA/src/file1.ts', rootFolder: 'repoA', duration: 100 },
      { filePath: '/repoB/src/file2.ts', rootFolder: 'repoB', duration: 200 },
      { filePath: '/repoA/src/file3.ts', rootFolder: 'repoA', duration: 150 },
    ];

    const grouped = manager.isolateByWorkspace(sessions);
    expect(grouped.size).toBe(2);
    expect(grouped.get('repoA')).toHaveLength(2);
    expect(grouped.get('repoB')).toHaveLength(1);
    manager.dispose();
  });
});
