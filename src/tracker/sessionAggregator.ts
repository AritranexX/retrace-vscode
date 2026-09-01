import * as path from 'path';

export interface LineRange {
  startLine: number;
  endLine: number;
}

export interface AggregatedNode {
  nodeId: string; // Normalized absolute file path
  filePath: string; // Normalized absolute file path
  fileName: string;
  directory: string;
  totalActiveSeconds: number;
  linesAdded: number;
  linesDeleted: number;
  lastLineRange: LineRange;
  sequenceNumber: number; // 1-based initial chronological sequence
  visitCount: number;
  lastVisitedTimestamp: number;
  sequenceIndicator: string;
  repoName?: string;
  gitBranch?: string;
  rootFolder?: string;
}

export interface HopInput {
  filePath: string;
  durationSeconds: number;
  linesAdded?: number;
  linesDeleted?: number;
  cursorRange: LineRange;
  timestamp?: number;
  repoName?: string;
  gitBranch?: string;
  rootFolder?: string;
}

export function normalizePath(pathStr: string): string {
  if (!pathStr) return '';
  return pathStr.replace(/\\/g, '/');
}

export function getFileName(filePath: string): string {
  const norm = normalizePath(filePath);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? norm : norm.substring(idx + 1);
}

export function getDirectory(filePath: string): string {
  const norm = normalizePath(filePath);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? '' : norm.substring(0, idx);
}

export function formatTimeAgo(elapsedMs: number): string {
  if (elapsedMs < 0) elapsedMs = 0;
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours >= 1) {
    return `${hours}h ago`;
  } else if (minutes >= 1) {
    return `${minutes}m ago`;
  } else if (seconds >= 10) {
    return `${seconds}s ago`;
  } else {
    return `just now`;
  }
}

export function formatSequenceIndicator(
  sequenceNumber: number,
  visitCount: number,
  elapsedMs?: number
): string {
  if (visitCount <= 1) {
    return `[#${sequenceNumber}]`;
  }
  const timeStr = elapsedMs !== undefined ? formatTimeAgo(elapsedMs) : 'recently';
  return `[#${sequenceNumber} • Revisted ${timeStr}]`;
}

export class SessionAggregator {
  private nodesMap: Map<string, AggregatedNode> = new Map();
  private sequenceCounter: number = 0;

  /**
   * Records a file hop / activity slice in the active in-memory session graph.
   * If the file has been visited previously within this session, updates existing node
   * following the Rapid Revisit Rule (debounce & accumulate).
   */
  public recordHop(input: HopInput): AggregatedNode {
    const normalized = normalizePath(input.filePath);
    const now = input.timestamp ?? Date.now();
    const duration = input.durationSeconds || 0;
    const added = input.linesAdded || 0;
    const deleted = input.linesDeleted || 0;

    const existing = this.nodesMap.get(normalized);

    if (existing) {
      existing.totalActiveSeconds += duration;
      existing.linesAdded += added;
      existing.linesDeleted += deleted;
      existing.lastLineRange = { ...input.cursorRange };
      
      const elapsedMs = Math.max(0, now - existing.lastVisitedTimestamp);
      existing.visitCount += 1;
      existing.lastVisitedTimestamp = now;
      existing.sequenceIndicator = formatSequenceIndicator(
        existing.sequenceNumber,
        existing.visitCount,
        elapsedMs
      );

      if (input.repoName) existing.repoName = input.repoName;
      if (input.gitBranch) existing.gitBranch = input.gitBranch;
      if (input.rootFolder) existing.rootFolder = input.rootFolder;

      return existing;
    } else {
      this.sequenceCounter += 1;
      const sequenceNumber = this.sequenceCounter;
      const fileName = getFileName(normalized);
      const directory = getDirectory(normalized);

      const node: AggregatedNode = {
        nodeId: normalized,
        filePath: normalized,
        fileName,
        directory,
        totalActiveSeconds: duration,
        linesAdded: added,
        linesDeleted: deleted,
        lastLineRange: { ...input.cursorRange },
        sequenceNumber,
        visitCount: 1,
        lastVisitedTimestamp: now,
        sequenceIndicator: formatSequenceIndicator(sequenceNumber, 1),
        repoName: input.repoName,
        gitBranch: input.gitBranch,
        rootFolder: input.rootFolder,
      };

      this.nodesMap.set(normalized, node);
      return node;
    }
  }

  public getNode(filePath: string): AggregatedNode | undefined {
    return this.nodesMap.get(normalizePath(filePath));
  }

  public hasNode(filePath: string): boolean {
    return this.nodesMap.has(normalizePath(filePath));
  }

  public getNodes(now?: number): AggregatedNode[] {
    const nodes = Array.from(this.nodesMap.values());
    if (now !== undefined) {
      return nodes.map((node) => {
        if (node.visitCount > 1) {
          const elapsed = Math.max(0, now - node.lastVisitedTimestamp);
          return {
            ...node,
            sequenceIndicator: formatSequenceIndicator(
              node.sequenceNumber,
              node.visitCount,
              elapsed
            ),
          };
        }
        return node;
      });
    }
    return nodes;
  }

  public getGraph(now?: number): { nodes: AggregatedNode[] } {
    return {
      nodes: this.getNodes(now),
    };
  }

  public clear(): void {
    this.nodesMap.clear();
    this.sequenceCounter = 0;
  }

  public getNodeCount(): number {
    return this.nodesMap.size;
  }
}
