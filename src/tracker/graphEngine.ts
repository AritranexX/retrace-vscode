import { Session } from '../storage/types';

export type JumpLevel = 1 | 2 | 3;

export interface JumpEdgeData {
  id: string;
  source: string;
  target: string;
  level: JumpLevel;
  timestamp: number;
  fromFile: string;
  toFile: string;
  count: number;
}

export interface ClusteredNodeData {
  id: string;
  filePath: string;
  fileName: string;
  directory: string;
  repoName: string;
  gitBranch: string;
  totalDurationSeconds: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  cursorStartLine: number;
  cursorEndLine: number;
  visitCount: number;
  timestamp: number;
  latestTimestamp: number;
  isLocked: boolean;
  sessions: Session[];
}

export interface SessionGraph {
  nodes: ClusteredNodeData[];
  edges: JumpEdgeData[];
}

export interface LeftSpineFileNode {
  stepIndex: number | string;
  filePath: string;
  fileName: string;
  directory: string;
  repoName: string;
  gitBranch: string;
  durationSeconds: number;
  linesAdded: number;
  linesDeleted: number;
  cursorStartLine: number;
  cursorEndLine: number;
  visitCount: number;
  timestamp: number;
  isLocked: boolean;
  isLatest: boolean;
  isLoopParent?: boolean;
  loopCount?: number;
  children?: LeftSpineFileNode[];
}

export interface LeftSpineGroupNode {
  id: string;
  folderPath: string;
  gitBranch: string;
  repoName: string;
  headerTitle: string;
  totalDurationSeconds: number;
  totalIterations: number;
  files: LeftSpineFileNode[];
}

export interface LeftSpineTreeData {
  startTimeFormatted: string;
  sessionStartTimestamp: number;
  groups: LeftSpineGroupNode[];
  activeNode: LeftSpineFileNode | null;
}

export function normalizePath(pathStr: string): string {
  return pathStr.replace(/\\/g, '/');
}

export function getDirectory(pathStr: string): string {
  const norm = normalizePath(pathStr);
  const idx = norm.lastIndexOf('/');
  if (idx === -1) return '';
  return norm.substring(0, idx);
}

export function getFileName(pathStr: string): string {
  const norm = normalizePath(pathStr);
  const idx = norm.lastIndexOf('/');
  if (idx === -1) return norm;
  return norm.substring(idx + 1);
}

export function extractRelativeDirectory(filePath: string, repoName?: string): string {
  const norm = normalizePath(filePath);
  const dir = getDirectory(norm);
  if (!dir) return './';

  if (repoName && repoName !== 'Standalone Files' && repoName !== 'Standalone') {
    const repoMarker = `/${repoName}/`;
    const idx = norm.indexOf(repoMarker);
    if (idx !== -1) {
      const relPath = norm.substring(idx + repoMarker.length);
      const relDir = getDirectory(relPath);
      return relDir ? (relDir.endsWith('/') ? relDir : `${relDir}/`) : './';
    }
  }

  const parts = dir.split('/').filter(Boolean);
  if (parts.length === 0) return './';
  if (parts.length === 1) return `${parts[0]}/`;
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}/`;
}

/**
 * Calculates jump distance / relation level between consecutive session files.
 * Level 1: Thin Line / 1.5px / Opacity 0.4 - Hops within the same folder or quick edits.
 * Level 2: Medium Line / 2.5px / Accent Color - Hops across sibling directories within the same repo.
 * Level 3: Deep Line / 4px / Glowing Stroke + Animated Dash - Major jumps across different sub-projects, distinct modules, or cross-repo switches.
 */
export function calculateJumpLevel(sessionA: Session, sessionB: Session): JumpLevel {
  if (sessionA.repo_name !== sessionB.repo_name) {
    return 3;
  }

  const pathA = normalizePath(sessionA.file_path);
  const pathB = normalizePath(sessionB.file_path);

  const dirA = getDirectory(pathA);
  const dirB = getDirectory(pathB);

  if (dirA === dirB) {
    return 1;
  }

  const timeGap = Math.abs(sessionB.timestamp - (sessionA.timestamp + sessionA.duration_seconds * 1000));
  if (timeGap < 30_000) {
    return 1;
  }

  const partsA = dirA.split('/').filter(Boolean);
  const partsB = dirB.split('/').filter(Boolean);

  let commonPrefixLen = 0;
  const minLen = Math.min(partsA.length, partsB.length);
  while (commonPrefixLen < minLen && partsA[commonPrefixLen] === partsB[commonPrefixLen]) {
    commonPrefixLen++;
  }

  const diffA = partsA.length - commonPrefixLen;
  const diffB = partsB.length - commonPrefixLen;

  if (diffA <= 1 && diffB <= 1) {
    return 2;
  }

  return 3;
}

export function generateSessionGraph(sessions: Session[], isPro: boolean = true): SessionGraph {
  if (!sessions || sessions.length === 0) {
    return { nodes: [], edges: [] };
  }

  const sortedSessions = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
  const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1000;
  const now = Date.now();

  const nodeMap = new Map<string, ClusteredNodeData>();

  for (let i = 0; i < sortedSessions.length; i++) {
    const s = sortedSessions[i];
    const filePath = normalizePath(s.file_path);
    const fileName = getFileName(filePath);
    const directory = getDirectory(filePath);
    const isLocked = !isPro && (now - s.timestamp > TWENTY_FOUR_HOURS_MS);

    const prevSession = i > 0 ? sortedSessions[i - 1] : null;
    const isConsecutiveSameFile = prevSession && normalizePath(prevSession.file_path) === filePath;

    const existing = nodeMap.get(filePath);
    if (existing) {
      if (!isConsecutiveSameFile) {
        existing.visitCount += 1;
      }
      existing.totalDurationSeconds += s.duration_seconds;
      existing.totalLinesAdded += s.lines_added;
      existing.totalLinesDeleted += s.lines_deleted;
      existing.cursorStartLine = s.cursor_start_line;
      existing.cursorEndLine = s.cursor_end_line;
      existing.latestTimestamp = s.timestamp;
      existing.sessions.push(s);
      if (!isLocked) {
        existing.isLocked = false;
      }
    } else {
      nodeMap.set(filePath, {
        id: filePath,
        filePath,
        fileName,
        directory,
        repoName: s.repo_name,
        gitBranch: s.git_branch,
        totalDurationSeconds: s.duration_seconds,
        totalLinesAdded: s.lines_added,
        totalLinesDeleted: s.lines_deleted,
        cursorStartLine: s.cursor_start_line,
        cursorEndLine: s.cursor_end_line,
        visitCount: 1,
        timestamp: s.timestamp,
        latestTimestamp: s.timestamp,
        isLocked,
        sessions: [s],
      });
    }
  }

  const nodes = Array.from(nodeMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  const edges: JumpEdgeData[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const nodeA = nodes[i];
    const nodeB = nodes[i + 1];
    const lastSessionA = nodeA.sessions[nodeA.sessions.length - 1];
    const firstSessionB = nodeB.sessions[0];
    const level = calculateJumpLevel(lastSessionA, firstSessionB);

    edges.push({
      id: `edge:${nodeA.id}->${nodeB.id}`,
      source: nodeA.id,
      target: nodeB.id,
      level,
      timestamp: nodeB.latestTimestamp,
      fromFile: nodeA.fileName,
      toFile: nodeB.fileName,
      count: 1,
    });
  }

  return {
    nodes,
    edges,
  };
}

export function generateLeftSpineTree(
  sessions: Session[],
  isPro: boolean = true,
  activeFilePathParam?: string | null
): LeftSpineTreeData {
  if ((!sessions || sessions.length === 0) && !activeFilePathParam) {
    return {
      startTimeFormatted: '00:00',
      sessionStartTimestamp: Date.now(),
      groups: [],
      activeNode: null,
    };
  }

  const sorted = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
  const startTs = sorted.length > 0 ? sorted[0].timestamp : Date.now();
  const startDate = new Date(startTs);
  const startTimeFormatted = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1000;
  const now = Date.now();

  const fileMap = new Map<string, LeftSpineFileNode>();
  let sequenceCounter = 0;

  for (const s of sorted) {
    const filePath = normalizePath(s.file_path);
    const existing = fileMap.get(filePath);
    const isLocked = false; // Timeline history is completely unblurred and un-capped for Free tier

    if (existing) {
      existing.durationSeconds += s.duration_seconds;
      existing.linesAdded += s.lines_added;
      existing.linesDeleted += s.lines_deleted;
      existing.cursorStartLine = s.cursor_start_line;
      existing.cursorEndLine = s.cursor_end_line;
      existing.visitCount += 1;
      existing.timestamp = Math.max(existing.timestamp, s.timestamp);
      existing.isLocked = existing.isLocked || isLocked;
      if (s.repo_name) existing.repoName = s.repo_name;
      if (s.git_branch) existing.gitBranch = s.git_branch;

      if (!existing.children) {
        existing.children = [];
      }
      if (existing.children.length === 0) {
        existing.children.push({
          stepIndex: `${existing.stepIndex}.1`,
          filePath,
          fileName: existing.fileName,
          directory: existing.directory,
          repoName: existing.repoName,
          gitBranch: existing.gitBranch,
          durationSeconds: Math.max(0, existing.durationSeconds - s.duration_seconds),
          linesAdded: Math.max(0, existing.linesAdded - s.lines_added),
          linesDeleted: Math.max(0, existing.linesDeleted - s.lines_deleted),
          cursorStartLine: existing.cursorStartLine,
          cursorEndLine: existing.cursorEndLine,
          visitCount: 1,
          timestamp: existing.timestamp,
          isLocked: existing.isLocked,
          isLatest: false,
          children: [],
        });
      }
      existing.children.push({
        stepIndex: `${existing.stepIndex}.${existing.children.length + 1}`,
        filePath,
        fileName: existing.fileName,
        directory: existing.directory,
        repoName: s.repo_name || existing.repoName,
        gitBranch: s.git_branch || existing.gitBranch,
        durationSeconds: s.duration_seconds,
        linesAdded: s.lines_added,
        linesDeleted: s.lines_deleted,
        cursorStartLine: s.cursor_start_line,
        cursorEndLine: s.cursor_end_line,
        visitCount: 1,
        timestamp: s.timestamp,
        isLocked,
        isLatest: false,
        children: [],
      });
      existing.isLoopParent = true;
      existing.loopCount = existing.visitCount;
    } else {
      sequenceCounter += 1;
      const fileName = getFileName(filePath);
      const directory = extractRelativeDirectory(filePath, s.repo_name);

      fileMap.set(filePath, {
        stepIndex: sequenceCounter,
        filePath,
        fileName,
        directory,
        repoName: s.repo_name,
        gitBranch: s.git_branch,
        durationSeconds: s.duration_seconds,
        linesAdded: s.lines_added,
        linesDeleted: s.lines_deleted,
        cursorStartLine: s.cursor_start_line,
        cursorEndLine: s.cursor_end_line,
        visitCount: 1,
        timestamp: s.timestamp,
        isLocked,
        isLatest: false,
        isLoopParent: false,
        loopCount: 1,
        children: [],
      });
    }
  }

  let activeFilePath: string | null = null;
  if (activeFilePathParam !== undefined) {
    activeFilePath = activeFilePathParam ? normalizePath(activeFilePathParam) : null;
  } else if (sorted.length > 0) {
    activeFilePath = normalizePath(sorted[sorted.length - 1].file_path);
  }

  if (activeFilePath) {
    const normActive = normalizePath(activeFilePath);
    const existingKey = Array.from(fileMap.keys()).find(
      (k) => k === normActive || k.toLowerCase() === normActive.toLowerCase()
    );

    if (!existingKey) {
      sequenceCounter += 1;
      const fileName = getFileName(normActive);

      let repoName = 'Workspace';
      let gitBranch = '';
      if (sorted.length > 0) {
        const matchingSession = sorted.slice().reverse().find((s) => s.repo_name);
        if (matchingSession) {
          repoName = matchingSession.repo_name;
          gitBranch = matchingSession.git_branch || '';
        }
      }
      const directory = extractRelativeDirectory(normActive, repoName);

      fileMap.set(normActive, {
        stepIndex: sequenceCounter,
        filePath: normActive,
        fileName,
        directory,
        repoName,
        gitBranch,
        durationSeconds: 0,
        linesAdded: 0,
        linesDeleted: 0,
        cursorStartLine: 1,
        cursorEndLine: 1,
        visitCount: 1,
        timestamp: now,
        isLocked: false,
        isLatest: true,
        isLoopParent: false,
        loopCount: 1,
        children: [],
      });
    }
  }

  const fileNodes = Array.from(fileMap.values());

  const normActive = activeFilePath ? normalizePath(activeFilePath) : null;
  for (const fn of fileNodes) {
    const normFn = normalizePath(fn.filePath);
    fn.isLatest = Boolean(
      normActive &&
        (normFn === normActive || normFn.toLowerCase() === normActive.toLowerCase())
    );
  }

  const activeNode = normActive
    ? fileNodes.find(
        (fn) =>
          normalizePath(fn.filePath) === normActive ||
          normalizePath(fn.filePath).toLowerCase() === normActive.toLowerCase()
      ) || null
    : null;

  const groupMap = new Map<string, LeftSpineGroupNode>();
  const groups: LeftSpineGroupNode[] = [];

  for (const fn of fileNodes) {
    const branch = fn.gitBranch || 'main';
    const repo = fn.repoName || 'Standalone';
    const groupKey = `${branch}::${repo}`;

    let group = groupMap.get(groupKey);
    if (!group) {
      const headerTitle = branch.startsWith('commit:') ? `🌿 ${branch}` : `🌿 branch: ${branch}`;
      group = {
        id: `group_${groups.length + 1}_${groupKey}`,
        folderPath: fn.directory || branch,
        gitBranch: branch,
        repoName: repo,
        headerTitle,
        totalDurationSeconds: 0,
        totalIterations: 0,
        files: [],
      };
      groupMap.set(groupKey, group);
      groups.push(group);
    }
    group.files.push(fn);
    group.totalDurationSeconds += fn.durationSeconds;
    group.totalIterations += (fn.visitCount || 1);
  }

  return {
    startTimeFormatted,
    sessionStartTimestamp: startTs,
    groups,
    activeNode,
  };
}

