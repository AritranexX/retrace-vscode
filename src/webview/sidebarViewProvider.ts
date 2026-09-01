import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseManager } from '../storage/db';
import { WorkspaceWatcher } from '../tracker/workspaceWatcher';

export class RetraceSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'retrace.sidebarView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _dbManager: DatabaseManager,
    private readonly _workspaceState?: vscode.Memento,
    private readonly _workspaceWatcher?: WorkspaceWatcher
  ) {}

  public postMessage(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    if (this._workspaceWatcher) {
      this._workspaceWatcher.onIdleReturnPrompt((evt) => {
        if (this._view) {
          this._view.webview.postMessage({
            command: 'showIdlePrompt',
            mins: evt.mins,
            durationSeconds: evt.durationSeconds,
            startTime: evt.startTime,
          });
        }
      });
    }

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case 'getSessions': {
          await this.sendDataToWebview();
          break;
        }
        case 'openFile': {
          await this.handleOpenFile(data.filePath, data.lineStart, data.lineEnd);
          break;
        }
        case 'logIdleTime': {
          if (this._workspaceWatcher && data.category) {
            await this._workspaceWatcher.logIdleTime(
              data.category,
              data.durationSeconds,
              data.startTime
            );
            await this.sendDataToWebview();
          }
          break;
        }
        case 'copyToClipboard': {
          if (data.text) {
            await vscode.env.clipboard.writeText(data.text);
            vscode.window.showInformationMessage('Workflow summary copied to clipboard.');
          }
          break;
        }
        case 'saveWorkflowPNG': {
          await this.handleSaveWorkflowPng(data.dataUrl, data.filename);
          break;
        }
        case 'saveWorkflowHTML': {
          await this.handleSaveWorkflowHtml(data.content, data.filename);
          break;
        }
      }
    });
  }

  public async sendDataToWebview(): Promise<void> {
    if (!this._view) return;
    const sessions = await this._dbManager.getSessions();
    const repoMetrics = await this._dbManager.getRepoMetrics();

    const activeFilePath = this._workspaceWatcher
      ? this._workspaceWatcher.getActiveFilePath()
      : (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file'
          ? vscode.window.activeTextEditor.document.uri.fsPath
          : undefined);

    this._view.webview.postMessage({
      command: 'updateData',
      sessions,
      repoMetrics,
      activeFilePath,
    });
  }

  private async handleOpenFile(filePath: string, lineStart: number, lineEnd: number): Promise<void> {
    try {
      if (!filePath) return;
      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);

      const maxLine = Math.max(0, doc.lineCount - 1);
      const startLine = Math.min(Math.max(0, (Number(lineStart) || 1) - 1), maxLine);
      const endLine = Math.min(Math.max(0, (Number(lineEnd) || Number(lineStart) || 1) - 1), maxLine);
      const lastLineLength = doc.lineAt(endLine).text.length;

      const range = new vscode.Range(startLine, 0, endLine, lastLineLength);
      const selection = new vscode.Selection(startLine, 0, endLine, lastLineLength);

      const editor = await vscode.window.showTextDocument(doc, {
        selection: range,
        preserveFocus: false,
        preview: false,
      });

      editor.selection = selection;
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to open file: ${msg}`);
    }
  }

  private async handleSaveWorkflowPng(dataUrl: string, defaultFilename: string = 'retrace-workflow.png'): Promise<void> {
    try {
      if (!dataUrl) return;
      const fileUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultFilename),
        filters: { 'PNG Images': ['png'] },
        saveLabel: 'Export PNG Card',
      });

      if (fileUri) {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.promises.writeFile(fileUri.fsPath, buffer);
        vscode.window.showInformationMessage(`Workflow PNG saved to ${path.basename(fileUri.fsPath)}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to save PNG: ${msg}`);
    }
  }

  private async handleSaveWorkflowHtml(content: string, defaultFilename: string = 'retrace-workflow.html'): Promise<void> {
    try {
      if (!content) return;
      const fileUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultFilename),
        filters: { 'HTML Documents': ['html', 'htm'] },
        saveLabel: 'Export HTML Workflow',
      });

      if (fileUri) {
        await fs.promises.writeFile(fileUri.fsPath, content, 'utf8');
        vscode.window.showInformationMessage(`Workflow HTML saved to ${path.basename(fileUri.fsPath)}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to save HTML: ${msg}`);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {

    const webviewDistDir = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview');
    const indexHtmlPath = path.join(webviewDistDir.fsPath, 'index.html');

    if (fs.existsSync(indexHtmlPath)) {
      let html = fs.readFileSync(indexHtmlPath, 'utf8');
      const assetsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets'));
      
      html = html.replace(/\/assets\//g, `${assetsUri.toString()}/`);
      return html;
    }

    return `<!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>Retrace</title></head>
      <body><div id="root">Loading Retrace Webview...</div></body>
      </html>`;
  }
}

export type RetraceWebviewProvider = RetraceSidebarProvider;
