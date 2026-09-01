import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { DatabaseManager } from '../storage/db';
import { Session } from '../storage/types';
import { calculateLineChanges } from './diffHelper';
import { resolveRepoAndBranch } from './repoResolver';
import { isNoiseFile } from './noiseFilter';

export const IDLE_TIMEOUT_MS = 120_000;
export const SMART_IDLE_THRESHOLD_MS = 300_000; // 5 minutes (300,000 ms)

export interface IdlePromptEvent {
  mins: number;
  durationSeconds: number;
  startTime: number;
  inactiveMs: number;
}

interface CurrentSessionState {
  id: string;
  filePath: string;
  repoName: string;
  gitBranch: string;
  startTime: number;
  lastActiveTime: number;
  accumulatedSeconds: number;
  linesAdded: number;
  linesDeleted: number;
  cursorStartLine: number;
  cursorEndLine: number;
  isIdle: boolean;
}

export class WorkspaceWatcher implements vscode.Disposable {
  private dbManager: DatabaseManager;
  private disposables: vscode.Disposable[] = [];
  private currentSession: CurrentSessionState | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private lastActiveFilePath: string | undefined = undefined;
  private isIdle: boolean = false;
  private lastActivityTimestamp: number = Date.now();
  private idleStartTime: number = Date.now();
  private editDebounceTimer: NodeJS.Timeout | null = null;
  private lastEditFlushTime: number = Date.now();

  private onSessionFlushedEmitter = new vscode.EventEmitter<Session>();
  public readonly onSessionFlushed = this.onSessionFlushedEmitter.event;
  private onActiveEditorChangedEmitter = new vscode.EventEmitter<string | undefined>();
  public readonly onActiveEditorChanged = this.onActiveEditorChangedEmitter.event;
  private onIdleReturnPromptEmitter = new vscode.EventEmitter<IdlePromptEvent>();
  public readonly onIdleReturnPrompt = this.onIdleReturnPromptEmitter.event;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  public start(): void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => this.handleActiveEditorChange(editor)),
      vscode.window.onDidChangeVisibleTextEditors(() => this.handleVisibleEditorsChange()),
      vscode.workspace.onDidChangeTextDocument((event) => this.handleDocumentChange(event)),
      vscode.window.onDidChangeTextEditorSelection((event) => this.handleSelectionChange(event)),
      vscode.workspace.onDidSaveTextDocument((doc) => this.handleDocumentSave(doc))
    );

    if (typeof vscode !== 'undefined' && vscode.workspace && vscode.workspace.createFileSystemWatcher) {
      try {
        const gitWatcher = vscode.workspace.createFileSystemWatcher('**/.git/{HEAD,COMMIT_EDITMSG,index,refs/heads/**}');
        const handleGitChange = async () => {
          if (this.currentSession) {
            const activeUri = vscode.Uri.file(this.currentSession.filePath);
            const { repoName, gitBranch } = resolveRepoAndBranch(activeUri);
            this.currentSession.repoName = repoName;
            this.currentSession.gitBranch = gitBranch;
          }
          await this.flushCurrentSession();
        };
        this.disposables.push(
          gitWatcher,
          gitWatcher.onDidChange(handleGitChange),
          gitWatcher.onDidCreate(handleGitChange),
          gitWatcher.onDidDelete(handleGitChange)
        );
      } catch {
        // Fallback for non-vscode runtime / unit tests
      }
    }

    if (vscode.window.activeTextEditor) {
      this.handleActiveEditorChange(vscode.window.activeTextEditor);
    }
  }

  private handleVisibleEditorsChange(): void {
    const validVisible = vscode.window.visibleTextEditors.filter(
      (e) => e.document.uri.scheme === 'file'
    );
    if (validVisible.length === 0) {
      this.lastActiveFilePath = undefined;
      this.onActiveEditorChangedEmitter.fire(undefined);
    } else if (
      this.lastActiveFilePath &&
      !validVisible.some((e) => e.document.uri.fsPath === this.lastActiveFilePath)
    ) {
      const active = vscode.window.activeTextEditor;
      if (active && active.document.uri.scheme === 'file') {
        this.lastActiveFilePath = active.document.uri.fsPath;
      } else {
        this.lastActiveFilePath = validVisible[0].document.uri.fsPath;
      }
      this.onActiveEditorChangedEmitter.fire(this.lastActiveFilePath);
    }
  }

  private handleActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    this.flushCurrentSession();
    if (!editor || editor.document.uri.scheme !== 'file') {
      this.currentSession = null;
      const validVisible = vscode.window.visibleTextEditors.filter(
        (e) => e.document.uri.scheme === 'file'
      );
      if (validVisible.length === 0) {
        this.lastActiveFilePath = undefined;
      }
      this.onActiveEditorChangedEmitter.fire(this.lastActiveFilePath);
      return;
    }

    const filePath = editor.document.uri.fsPath;
    if (isNoiseFile(filePath)) {
      this.currentSession = null;
      this.lastActiveFilePath = undefined;
      this.onActiveEditorChangedEmitter.fire(undefined);
      return;
    }

    this.lastActiveFilePath = filePath;
    const { repoName, gitBranch } = resolveRepoAndBranch(editor.document.uri);
    const selection = editor.selection;
    const now = Date.now();

    this.currentSession = {
      id: crypto.randomUUID(), filePath, repoName, gitBranch,
      startTime: now, lastActiveTime: now, accumulatedSeconds: 0,
      linesAdded: 0, linesDeleted: 0,
      cursorStartLine: selection.start.line + 1,
      cursorEndLine: selection.end.line + 1,
      isIdle: false,
    };
    this.resetIdleTimer();
    this.onActiveEditorChangedEmitter.fire(filePath);
  }

  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (!this.currentSession || event.document.uri.fsPath !== this.currentSession.filePath) return;
    this.registerActivity();
    const { linesAdded, linesDeleted } = calculateLineChanges(event.contentChanges);
    this.currentSession.linesAdded += linesAdded;
    this.currentSession.linesDeleted += linesDeleted;
  }

  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    if (!this.currentSession || event.textEditor.document.uri.fsPath !== this.currentSession.filePath) return;
    this.registerActivity();
    if (event.selections.length > 0) {
      const primary = event.selections[0];
      this.currentSession.cursorStartLine = primary.start.line + 1;
      this.currentSession.cursorEndLine = primary.end.line + 1;
    }
  }

  private registerActivity(): void {
    const now = Date.now();

    if (this.isIdle) {
      const awayMs = now - this.idleStartTime;
      this.isIdle = false;
      if (awayMs >= SMART_IDLE_THRESHOLD_MS) {
        this.triggerSmartIdlePrompt(awayMs, this.idleStartTime);
      }
    } else if (now - this.lastActivityTimestamp >= SMART_IDLE_THRESHOLD_MS) {
      const awayMs = now - this.lastActivityTimestamp;
      this.triggerSmartIdlePrompt(awayMs, this.lastActivityTimestamp);
    }

    if (this.currentSession) {
      if (this.currentSession.isIdle) {
        this.currentSession.isIdle = false;
        this.currentSession.lastActiveTime = now;
      } else {
        const elapsed = Math.floor((now - this.currentSession.lastActiveTime) / 1000);
        if (elapsed > 0) {
          this.currentSession.accumulatedSeconds += elapsed;
          this.currentSession.lastActiveTime = now;
        }
      }
    }
    this.lastActivityTimestamp = now;
    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.handleIdle(), IDLE_TIMEOUT_MS);
  }

  private handleIdle(): void {
    const now = Date.now();
    if (!this.isIdle) {
      this.isIdle = true;
      this.idleStartTime = this.lastActivityTimestamp;
    }
    if (this.currentSession && !this.currentSession.isIdle) {
      const elapsed = Math.floor((now - this.currentSession.lastActiveTime) / 1000);
      if (elapsed > 0) this.currentSession.accumulatedSeconds += elapsed;
      this.currentSession.isIdle = true;
      this.flushCurrentSession();
    }
  }

  public triggerSmartIdlePrompt(awayMs: number, startTime: number): void {
    const mins = Math.max(1, Math.round(awayMs / (60 * 1000)));
    const durationSeconds = Math.round(awayMs / 1000);

    const event: IdlePromptEvent = {
      mins,
      durationSeconds,
      startTime,
      inactiveMs: awayMs,
    };

    this.onIdleReturnPromptEmitter.fire(event);

    if (typeof vscode !== 'undefined' && vscode.window && vscode.window.showInformationMessage) {
      const options = ['Meeting', 'Code Review', 'Research', 'Discard'];
      vscode.window.showInformationMessage(
        `You were away for ${mins} mins. Log this time?`,
        ...options
      ).then(async (selection) => {
        if (selection && selection !== 'Discard') {
          await this.logIdleTime(selection, durationSeconds, startTime);
        }
      });
    }
  }

  public async logIdleTime(
    category: string,
    durationSeconds: number,
    startTime?: number
  ): Promise<Session> {
    const now = Date.now();
    const start = startTime ?? (now - durationSeconds * 1000);
    const activePath = this.getActiveFilePath();
    const activeUri = activePath ? vscode.Uri.file(activePath) : undefined;
    const { repoName, gitBranch } = activeUri
      ? resolveRepoAndBranch(activeUri)
      : { repoName: 'Workspace', gitBranch: 'main' };

    const sessionToSave: Session = {
      id: crypto.randomUUID(),
      file_path: activePath ? `[${category}] ${activePath}` : `[${category}]`,
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
    this.onSessionFlushedEmitter.fire(sessionToSave);
    return sessionToSave;
  }

  public async flushCurrentSession(): Promise<void> {
    if (!this.currentSession) return;
    const now = Date.now();

    try {
      const activeUri = vscode.Uri.file(this.currentSession.filePath);
      const { repoName, gitBranch } = resolveRepoAndBranch(activeUri);
      this.currentSession.repoName = repoName;
      this.currentSession.gitBranch = gitBranch;
    } catch {
      // Keep existing properties if fallback
    }

    if (!this.currentSession.isIdle) {
      const elapsed = Math.floor((now - this.currentSession.lastActiveTime) / 1000);
      if (elapsed > 0) {
        this.currentSession.accumulatedSeconds += elapsed;
        this.currentSession.lastActiveTime = now;
      }
    }

    if (this.currentSession.accumulatedSeconds > 0 || this.currentSession.linesAdded > 0 || this.currentSession.linesDeleted > 0) {
      const sessionToSave: Session = {
        id: this.currentSession.id, file_path: this.currentSession.filePath,
        repo_name: this.currentSession.repoName, git_branch: this.currentSession.gitBranch,
        start_time: this.currentSession.startTime,
        duration_seconds: Math.max(1, this.currentSession.accumulatedSeconds),
        lines_added: this.currentSession.linesAdded, lines_deleted: this.currentSession.linesDeleted,
        cursor_start_line: this.currentSession.cursorStartLine, cursor_end_line: this.currentSession.cursorEndLine,
        timestamp: now,
      };
      await this.dbManager.insertSession(sessionToSave);
      this.onSessionFlushedEmitter.fire(sessionToSave);
    }

    if (this.currentSession.isIdle) {
      this.currentSession = null;
    } else {
      this.currentSession = {
        id: crypto.randomUUID(), filePath: this.currentSession.filePath,
        repoName: this.currentSession.repoName, gitBranch: this.currentSession.gitBranch,
        startTime: now, lastActiveTime: now, accumulatedSeconds: 0,
        linesAdded: 0, linesDeleted: 0,
        cursorStartLine: this.currentSession.cursorStartLine,
        cursorEndLine: this.currentSession.cursorEndLine,
        isIdle: false,
      };
    }
  }

  public getActiveFilePath(): string | undefined {
    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file') {
      return vscode.window.activeTextEditor.document.uri.fsPath;
    }
    return this.lastActiveFilePath;
  }

  public dispose(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.editDebounceTimer) {
      clearTimeout(this.editDebounceTimer);
      this.editDebounceTimer = null;
    }
    this.flushCurrentSession();
    this.disposables.forEach((d) => d.dispose());
    this.onSessionFlushedEmitter.dispose();
    this.onActiveEditorChangedEmitter.dispose();
    this.onIdleReturnPromptEmitter.dispose();
  }
}


