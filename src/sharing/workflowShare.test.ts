import { describe, it, expect } from 'vitest';
import { Session } from '../storage/types';
import { sanitizeFilePath, sanitizeRepoName, sanitizeBranchName, DEFAULT_PRIVACY_SETTINGS } from './workflowPrivacy';
import { buildWorkflowSummary, getCollapsedWorkflowSequence, formatDuration } from './workflowShare';
import { generateShareableTextSummary, generateStandaloneHtml } from './workflowExporter';

describe('Workflow Privacy & Sanitization', () => {
  it('strips user home directory and absolute filesystem paths', () => {
    expect(sanitizeFilePath('/Users/aritra/projects/app/src/auth.ts')).toBe('projects/app/src/auth.ts');
    expect(sanitizeFilePath('C:\\Users\\john\\code\\src\\api.ts')).toBe('code/src/api.ts');
    expect(sanitizeFilePath('/home/ubuntu/app/index.js')).toBe('app/index.js');
  });

  it('masks file names when showFileNames is false', () => {
    expect(sanitizeFilePath('/Users/aritra/app/src/auth.ts', false)).toBe('file.ts');
    expect(sanitizeFilePath('/home/ubuntu/app/config.json', false)).toBe('file.json');
  });

  it('sanitizes repo and branch names based on settings', () => {
    expect(sanitizeRepoName('my-repo', true)).toBe('my-repo');
    expect(sanitizeRepoName('my-repo', false)).toBe('[Hidden Repo]');
    expect(sanitizeBranchName('feature/auth', true)).toBe('feature/auth');
    expect(sanitizeBranchName('feature/auth', false)).toBe('[Hidden Branch]');
  });
});

describe('Workflow Sequence & Aggregation Engine', () => {
  const mockSessions: Session[] = [
    {
      id: '1',
      file_path: '/Users/aritra/project/src/auth.ts',
      repo_name: 'my-project',
      git_branch: 'feature/auth',
      start_time: 1000,
      timestamp: 1000,
      duration_seconds: 120,
      lines_added: 10,
      lines_deleted: 2,
      cursor_start_line: 1,
      cursor_end_line: 20,
    },
    {
      id: '2',
      file_path: '/Users/aritra/project/src/middleware.ts',
      repo_name: 'my-project',
      git_branch: 'feature/auth',
      start_time: 2000,
      timestamp: 2000,
      duration_seconds: 180,
      lines_added: 15,
      lines_deleted: 5,
      cursor_start_line: 5,
      cursor_end_line: 30,
    },
    {
      id: '3',
      file_path: '/Users/aritra/project/src/auth.ts',
      repo_name: 'my-project',
      git_branch: 'feature/auth',
      start_time: 3000,
      timestamp: 3000,
      duration_seconds: 90,
      lines_added: 5,
      lines_deleted: 1,
      cursor_start_line: 15,
      cursor_end_line: 40,
    },
  ];

  it('builds chronological workflow sequence and identifies revisited files', () => {
    const summary = buildWorkflowSummary(mockSessions, 'ALL', undefined, DEFAULT_PRIVACY_SETTINGS);

    expect(summary.uniqueFilesCount).toBe(2);
    expect(summary.totalIterations).toBe(3);
    expect(summary.totalDurationSeconds).toBe(390);
    expect(summary.linesAdded).toBe(30);
    expect(summary.linesDeleted).toBe(8);

    expect(summary.sequence[0].fileName).toBe('auth.ts');
    expect(summary.sequence[0].isRevisited).toBe(false);

    expect(summary.sequence[1].fileName).toBe('middleware.ts');
    expect(summary.sequence[1].isRevisited).toBe(false);

    expect(summary.sequence[2].fileName).toBe('auth.ts');
    expect(summary.sequence[2].isRevisited).toBe(true);
  });

  it('formats duration correctly', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3660)).toBe('1h 1m');
  });

  it('collapses loops for large workflows', () => {
    const largeSequence = Array.from({ length: 30 }, (_, i) => ({
      stepIndex: i + 1,
      filePath: `file_${i % 3}.ts`,
      displayPath: `src/file_${i % 3}.ts`,
      fileName: `file_${i % 3}.ts`,
      durationSeconds: 60,
      linesAdded: 2,
      linesDeleted: 1,
      timestamp: 1000 + i * 10,
      isRevisited: i >= 3,
      visitCount: Math.floor(i / 3) + 1,
    }));

    const collapsed = getCollapsedWorkflowSequence(largeSequence, 10);
    expect(collapsed.length).toBeLessThanOrEqual(11);
    expect(collapsed.some((node) => node.stepIndex === -1)).toBe(true);
  });
});

describe('Workflow Exporter (Text & HTML)', () => {
  const summary = buildWorkflowSummary(
    [
      {
        id: '1',
        file_path: '/Users/aritra/project/src/auth.ts',
        repo_name: 'my-project',
        git_branch: 'feature/auth',
        start_time: 1000,
        timestamp: 1000,
        duration_seconds: 120,
        lines_added: 10,
        lines_deleted: 2,
        cursor_start_line: 1,
        cursor_end_line: 20,
      },
    ],
    'ALL',
    undefined,
    DEFAULT_PRIVACY_SETTINGS
  );

  it('generates privacy-safe shareable text summary', () => {
    const text = generateShareableTextSummary(summary, DEFAULT_PRIVACY_SETTINGS);

    expect(text).toContain('Retrace — ');
    expect(text).toContain('Repository: my-project');
    expect(text).toContain('Branch: feature/auth');
    expect(text).toContain('Duration: 2m');
    expect(text).toContain('project/src/auth.ts');
    expect(text).not.toContain('/Users/aritra');
  });

  it('generates self-contained offline HTML', () => {
    const html = generateStandaloneHtml(summary, DEFAULT_PRIVACY_SETTINGS);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('RETRACE WORKFLOW');
    expect(html).toContain('my-project');
    expect(html).toContain('feature/auth');
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
  });
});
