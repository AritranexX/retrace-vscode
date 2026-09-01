import * as vscode from 'vscode';
import { DatabaseManager } from '../storage/db';
import { SessionAggregator } from './sessionAggregator';
import { Session } from '../storage/types';

export const IDLE_SESSION_CUT_MS = 30 * 60 * 1000; // 30 minutes
export const SMART_IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface SessionBreakNode {
  type: 'SESSION_BREAK';
  id: string;
  label: string;
  inactiveMs: number;
  timestamp: number;
}

export interface RootTrunkNode {
  type: 'ROOT_TRUNK';
  id: string;
  label: string;
  timestamp: number;
}

export interface IdlePromptEvent {
  mins: number;
  durationSeconds: number;
  startTime: number;
  inactiveMs: number;
}

export function formatInactiveHours(inactiveMs: number): string {
  const hours = inactiveMs / (1000 * 60 * 60);
  const hrsStr = hours < 1 ? hours.toFixed(1) : (hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1));
  return `${hrsStr} hrs`;
}

export function formatStartTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  return `${pad(h12)}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
}

export interface IdleDetectorOptions {
  idleCutMs?: number;
  dbManager?: DatabaseManager;
  sessionAggregator?: SessionAggregator;
  onFlush?: () => Promise<void> | void;
  onSessionBreak?: (node: SessionBreakNode) => void;
  onNewSessionStart?: (node: RootTrunkNode) => void;
  onIdleReturnPrompt?: (event: IdlePromptEvent) => void;
}

export class IdleDetector implements vscode.Disposable {
  public readonly idleCutMs: number;
  private lastActivityTimestamp: number;
  private idleTimer: NodeJS.Timeout | null = null;
  private isCutPending: boolean = false;
  private pendingInactiveMs: number = 0;

  private dbManager?: DatabaseManager;
  private sessionAggregator?: SessionAggregator;
  private disposables: vscode.Disposable[] = [];

  private onFlushEmitter = new vscode.EventEmitter<void>();
  public readonly onFlush = this.onFlushEmitter.event;

  private onSessionBreakEmitter = new vscode.EventEmitter<SessionBreakNode>();
  public readonly onSessionBreak = this.onSessionBreakEmitter.event;

  private onNewSessionStartEmitter = new vscode.EventEmitter<RootTrunkNode>();
  public readonly onNewSessionStart = this.onNewSessionStartEmitter.event;

  private onIdleReturnPromptEmitter = new vscode.EventEmitter<IdlePromptEvent>();
  public readonly onIdleReturnPrompt = this.onIdleReturnPromptEmitter.event;

  private customOnFlush?: () => Promise<void> | void;
  private customOnSessionBreak?: (node: SessionBreakNode) => void;
  private customOnNewSessionStart?: (node: RootTrunkNode) => void;
  private customOnIdleReturnPrompt?: (event: IdlePromptEvent) => void;

  constructor(options: IdleDetectorOptions = {}) {
    this.idleCutMs = options.idleCutMs ?? IDLE_SESSION_CUT_MS;
    this.lastActivityTimestamp = Date.now();
    this.dbManager = options.dbManager;
    this.sessionAggregator = options.sessionAggregator;
    this.customOnFlush = options.onFlush;
    this.customOnSessionBreak = options.onSessionBreak;
    this.customOnNewSessionStart = options.onNewSessionStart;
    this.customOnIdleReturnPrompt = options.onIdleReturnPrompt;
  }

  public start(): void {
    if (typeof vscode !== 'undefined' && vscode.window && vscode.workspace) {
      this.disposables.push(
        vscode.workspace.onDidChangeTextDocument(() => this.registerActivity()),
        vscode.window.onDidChangeActiveTextEditor(() => this.registerActivity()),
        vscode.window.onDidChangeTextEditorSelection(() => this.registerActivity())
      );
    }
    this.resetTimer();
  }

  public async registerActivity(timestamp?: number): Promise<{
    sessionBreakNode?: SessionBreakNode;
    rootTrunkNode?: RootTrunkNode;
    idlePromptEvent?: IdlePromptEvent;
  } | null> {
    const now = timestamp ?? Date.now();
    const elapsed = now - this.lastActivityTimestamp;

    let breakNode: SessionBreakNode | undefined;
    let rootNode: RootTrunkNode | undefined;
    let promptEvent: IdlePromptEvent | undefined;

    if (elapsed >= SMART_IDLE_THRESHOLD_MS) {
      const mins = Math.max(1, Math.round(elapsed / (60 * 1000)));
      const durationSeconds = Math.round(elapsed / 1000);
      promptEvent = {
        mins,
        durationSeconds,
        startTime: this.lastActivityTimestamp,
        inactiveMs: elapsed,
      };
      this.onIdleReturnPromptEmitter.fire(promptEvent);
      if (this.customOnIdleReturnPrompt) this.customOnIdleReturnPrompt(promptEvent);
    }

    if (elapsed > this.idleCutMs || this.isCutPending) {
      const inactiveMs = this.isCutPending ? Math.max(elapsed, this.pendingInactiveMs) : elapsed;
      await this.flushPreviousSession();

      const hrsLabel = formatInactiveHours(inactiveMs);
      breakNode = {
        type: 'SESSION_BREAK',
        id: `session-break-${now}`,
        label: `● [Session Break • Inactive for ${hrsLabel}]`,
        inactiveMs,
        timestamp: now,
      };
      this.onSessionBreakEmitter.fire(breakNode);
      if (this.customOnSessionBreak) this.customOnSessionBreak(breakNode);

      const timeStr = formatStartTime(now);
      rootNode = {
        type: 'ROOT_TRUNK',
        id: `root-trunk-${now}`,
        label: `● [${timeStr}] — New Session`,
        timestamp: now,
      };
      this.onNewSessionStartEmitter.fire(rootNode);
      if (this.customOnNewSessionStart) this.customOnNewSessionStart(rootNode);

      this.isCutPending = false;
      this.pendingInactiveMs = 0;
    }

    this.lastActivityTimestamp = now;
    this.resetTimer();

    if (breakNode || rootNode || promptEvent) {
      return { sessionBreakNode: breakNode, rootTrunkNode: rootNode, idlePromptEvent: promptEvent };
    }
    return null;
  }

  public async logIdleTime(
    category: string,
    durationSeconds: number,
    startTime?: number,
    repoName = 'Workspace',
    gitBranch = 'main',
    filePath = ''
  ): Promise<Session | null> {
    if (!this.dbManager) return null;
    const now = Date.now();
    const start = startTime ?? (now - durationSeconds * 1000);
    const sessionToSave: Session = {
      id: `idle-${now}-${Math.random().toString(36).substring(2, 7)}`,
      file_path: filePath ? `[${category}] ${filePath}` : `[${category}]`,
      repo_name: repoName,
      git_branch: gitBranch,
      start_time: start,
      duration_seconds: Math.max(1, durationSeconds),
      lines_added: 0,
      lines_deleted: 0,
      cursor_start_line: 0,
      cursor_end_line: 0,
      timestamp: now,
    };
    await this.dbManager.insertSession(sessionToSave);
    return sessionToSave;
  }

  private resetTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.handleIdleTimeout(), this.idleCutMs);
  }

  private async handleIdleTimeout(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastActivityTimestamp;
    if (elapsed >= this.idleCutMs) {
      this.isCutPending = true;
      this.pendingInactiveMs = elapsed;
      await this.flushPreviousSession();
    }
  }

  public async flushPreviousSession(): Promise<void> {
    this.onFlushEmitter.fire();
    if (this.customOnFlush) await this.customOnFlush();
    if (this.dbManager?.save) this.dbManager.save();
    if (this.sessionAggregator) this.sessionAggregator.clear();
  }

  public getLastActivityTimestamp(): number { return this.lastActivityTimestamp; }
  public setLastActivityTimestamp(timestamp: number): void { this.lastActivityTimestamp = timestamp; }

  public dispose(): void {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    this.disposables.forEach((d) => d.dispose());
    this.onFlushEmitter.dispose();
    this.onSessionBreakEmitter.dispose();
    this.onNewSessionStartEmitter.dispose();
    this.onIdleReturnPromptEmitter.dispose();
  }
}
