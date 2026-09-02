import { describe, it, expect } from 'vitest';
import { generateWorkflowPngDataUrl } from './canvasRenderer';
import { buildWorkflowSummary } from './workflowShare';
import { DEFAULT_PRIVACY_SETTINGS } from './workflowPrivacy';
import { Session } from '../storage/types';

describe('PNG Card Canvas Renderer', () => {
  const mockSessions: Session[] = [
    {
      id: '1',
      file_path: '/Users/aritra/project/src/index.ts',
      repo_name: 'test-repo',
      git_branch: 'main',
      start_time: 1000,
      timestamp: 1000,
      duration_seconds: 120,
      lines_added: 10,
      lines_deleted: 2,
    },
    {
      id: '2',
      file_path: '/Users/aritra/project/src/app.ts',
      repo_name: 'test-repo',
      git_branch: 'main',
      start_time: 2000,
      timestamp: 2000,
      duration_seconds: 180,
      lines_added: 15,
      lines_deleted: 5,
    },
  ];

  it('returns empty string when document is undefined (node environment without DOM)', () => {
    // In node environment vitest without jsdom, document is undefined
    const summary = buildWorkflowSummary(mockSessions, 'ALL', undefined, DEFAULT_PRIVACY_SETTINGS);
    const dataUrl = generateWorkflowPngDataUrl(summary, DEFAULT_PRIVACY_SETTINGS);
    expect(typeof dataUrl).toBe('string');
  });

  it('handles empty workflow summary gracefully', () => {
    const summary = buildWorkflowSummary([], 'ALL', undefined, DEFAULT_PRIVACY_SETTINGS);
    const dataUrl = generateWorkflowPngDataUrl(summary, DEFAULT_PRIVACY_SETTINGS);
    expect(typeof dataUrl).toBe('string');
  });
});
