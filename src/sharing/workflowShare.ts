import { Session } from '../storage/types';
import { sanitizeFilePath, sanitizeRepoName, sanitizeBranchName, PrivacySettings } from './workflowPrivacy';

export type WorkflowScope = 'ALL' | 'BRANCH' | 'SESSION';

export interface WorkflowSequenceNode {
  stepIndex: number;
  filePath: string;
  displayPath: string;
  fileName: string;
  durationSeconds: number;
  linesAdded: number;
  linesDeleted: number;
  cursorStartLine?: number;
  cursorEndLine?: number;
  timestamp: number;
  isRevisited: boolean;
  visitCount: number;
}

export interface WorkflowSummary {
  title: string;
  repoName: string;
  gitBranch: string;
  totalDurationSeconds: number;
  uniqueFilesCount: number;
  totalIterations: number;
  linesAdded: number;
  linesDeleted: number;
  startTime: number;
  endTime: number;
  sequence: WorkflowSequenceNode[];
  allUniqueFiles: string[];
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

/**
 * Builds a chronological workflow summary from Retrace sessions.
 */
export function buildWorkflowSummary(
  sessions: Session[],
  scope: WorkflowScope = 'ALL',
  selectedBranch?: string,
  privacySettings?: PrivacySettings
): WorkflowSummary {
  const sortedSessions = [...sessions].sort((a, b) => {
    const timeA = a.start_time || a.timestamp || 0;
    const timeB = b.start_time || b.timestamp || 0;
    return timeA - timeB;
  });

  let filtered = sortedSessions;
  if (scope === 'BRANCH' && selectedBranch) {
    filtered = sortedSessions.filter((s) => (s.git_branch || 'main') === selectedBranch);
  } else if (scope === 'SESSION' && sortedSessions.length > 0) {
    const latest = sortedSessions[sortedSessions.length - 1];
    filtered = sortedSessions.filter(
      (s) => s.git_branch === latest.git_branch && Math.abs(s.timestamp - latest.timestamp) < 4 * 3600 * 1000
    );
  }

  if (filtered.length === 0) {
    return {
      title: 'Workflow Session',
      repoName: sanitizeRepoName(undefined, privacySettings?.showRepoName),
      gitBranch: sanitizeBranchName(undefined, privacySettings?.showBranchName),
      totalDurationSeconds: 0,
      uniqueFilesCount: 0,
      totalIterations: 0,
      linesAdded: 0,
      linesDeleted: 0,
      startTime: Date.now(),
      endTime: Date.now(),
      sequence: [],
      allUniqueFiles: [],
    };
  }

  const primarySession = filtered[filtered.length - 1];
  const repoName = sanitizeRepoName(primarySession.repo_name, privacySettings?.showRepoName);
  const gitBranch = sanitizeBranchName(primarySession.git_branch, privacySettings?.showBranchName);

  let title = `${gitBranch} Activity`;
  if (primarySession.file_path) {
    const baseFile = primarySession.file_path.split(/[/\\]/).pop() || '';
    if (baseFile) {
      title = `${baseFile.split('.')[0]} Workflow`;
    }
  }

  let totalDurationSeconds = 0;
  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;
  const seenFiles = new Set<string>();
  const sequence: WorkflowSequenceNode[] = [];
  const fileVisitCounts = new Map<string, number>();

  let startTime = filtered[0].start_time || filtered[0].timestamp || Date.now();
  let endTime = filtered[filtered.length - 1].timestamp || Date.now();

  filtered.forEach((session, index) => {
    totalDurationSeconds += session.duration_seconds || 0;
    totalLinesAdded += session.lines_added || 0;
    totalLinesDeleted += session.lines_deleted || 0;

    const rawPath = session.file_path || 'file';
    const displayPath = sanitizeFilePath(rawPath, privacySettings?.showFileNames);
    const fileName = displayPath.split('/').pop() || displayPath;

    seenFiles.add(displayPath);

    const prevVisits = fileVisitCounts.get(displayPath) || 0;
    const isRevisited = prevVisits > 0;
    const visitCount = prevVisits + 1;
    fileVisitCounts.set(displayPath, visitCount);

    sequence.push({
      stepIndex: index + 1,
      filePath: rawPath,
      displayPath,
      fileName,
      durationSeconds: session.duration_seconds || 0,
      linesAdded: session.lines_added || 0,
      linesDeleted: session.lines_deleted || 0,
      cursorStartLine: session.cursor_start_line,
      cursorEndLine: session.cursor_end_line,
      timestamp: session.timestamp || session.start_time || Date.now(),
      isRevisited,
      visitCount,
    });
  });

  return {
    title,
    repoName,
    gitBranch,
    totalDurationSeconds,
    uniqueFilesCount: seenFiles.size,
    totalIterations: filtered.length,
    linesAdded: totalLinesAdded,
    linesDeleted: totalLinesDeleted,
    startTime,
    endTime,
    sequence,
    allUniqueFiles: Array.from(seenFiles),
  };
}

/**
 * Intelligent loop & repetition collapsing for large workflows.
 */
export function getCollapsedWorkflowSequence(
  sequence: WorkflowSequenceNode[],
  maxNodes: number = 15
): WorkflowSequenceNode[] {
  if (sequence.length <= maxNodes) {
    return sequence;
  }

  const collapsed: WorkflowSequenceNode[] = [];
  for (const node of sequence) {
    if (collapsed.length > 0) {
      const last = collapsed[collapsed.length - 1];
      if (last.displayPath === node.displayPath) {
        last.durationSeconds += node.durationSeconds;
        last.linesAdded += node.linesAdded;
        last.linesDeleted += node.linesDeleted;
        last.visitCount += 1;
        last.timestamp = Math.max(last.timestamp, node.timestamp);
        continue;
      }
    }
    collapsed.push({ ...node });
  }

  if (collapsed.length <= maxNodes) {
    return collapsed;
  }

  const headCount = Math.ceil(maxNodes / 2);
  const tailCount = Math.floor(maxNodes / 2);

  const head = collapsed.slice(0, headCount);
  const tail = collapsed.slice(collapsed.length - tailCount);
  const truncatedCount = collapsed.length - headCount - tailCount;

  const middleNode: WorkflowSequenceNode = {
    stepIndex: -1,
    filePath: 'truncated',
    displayPath: `... ${truncatedCount} intermediate steps ...`,
    fileName: `... ${truncatedCount} intermediate steps ...`,
    durationSeconds: 0,
    linesAdded: 0,
    linesDeleted: 0,
    timestamp: 0,
    isRevisited: false,
    visitCount: truncatedCount,
  };

  return [...head, middleNode, ...tail];
}


export function formatTimestamp(ts: number): string {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
