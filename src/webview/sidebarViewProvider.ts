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
    console.log('[RETRACE-DEBUG] resolveWebviewView called for viewType:', webviewView.viewType);
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview'),
        this._extensionUri
      ],
    };

    const htmlContent = this._getHtmlForWebview(webviewView.webview);
    console.log('[RETRACE-DEBUG] Assigning html to webview.webview.html');
    webviewView.webview.html = htmlContent;
    console.log('[RETRACE-DEBUG] HTML assigned successfully. Sending initial data...');
    this.sendDataToWebview();

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
        case 'openFeedback': {
          await this.handleOpenFeedback(data.actionId || data.action);
          break;
        }
      }
    });
  }

  public async sendDataToWebview(): Promise<void> {
    if (!this._view) return;
    try {
      const sessions = await this._dbManager.getSessions();
      const repoMetrics = await this._dbManager.getRepoMetrics();

      const activeFilePath = this._workspaceWatcher
        ? this._workspaceWatcher.getActiveFilePath()
        : (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file'
            ? vscode.window.activeTextEditor.document.uri.fsPath
            : undefined);

      this._view.webview.postMessage({
        command: 'updateData',
        sessions: sessions || [],
        repoMetrics: repoMetrics || [],
        activeFilePath,
      });
    } catch (err) {
      console.error('Error fetching sessions for webview:', err);
      this._view.webview.postMessage({
        command: 'updateData',
        sessions: [],
        repoMetrics: [],
        activeFilePath: undefined,
      });
    }
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
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
      const defaultUri = workspaceFolder
        ? vscode.Uri.joinPath(workspaceFolder, defaultFilename)
        : undefined;

      const fileUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'PNG Images': ['png'] },
        saveLabel: 'Export PNG Card',
      });

      if (fileUri) {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        await vscode.workspace.fs.writeFile(fileUri, buffer);
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
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
      const defaultUri = workspaceFolder
        ? vscode.Uri.joinPath(workspaceFolder, defaultFilename)
        : undefined;

      const fileUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'HTML Documents': ['html', 'htm'] },
        saveLabel: 'Save Workflow HTML',
      });

      if (!fileUri) {
        return;
      }

      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));
      vscode.window.showInformationMessage(`Workflow HTML saved to ${path.basename(fileUri.fsPath)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to save HTML: ${msg}`);
    }
  }

  private static readonly FEEDBACK_URLS: Record<string, string> = {
    generalFeedback: 'https://docs.google.com/forms/d/e/1FAIpQLSeGhe0cDT1LfPdUiqXjxwY7qU9vuzKr-NXoUHQfcDv7taAW0A/viewform?usp=header',
    reportBug: 'https://github.com/AritranexX/retrace-vscode/issues/new?template=bug_report.yml',
    featureRequest: 'https://github.com/AritranexX/retrace-vscode/issues/new?template=feature_request.yml',
    github: 'https://github.com/AritranexX/retrace-vscode',
  };

  private async handleOpenFeedback(actionId: string): Promise<void> {
    const url = RetraceSidebarProvider.FEEDBACK_URLS[actionId];
    if (url) {
      try {
        await vscode.env.openExternal(vscode.Uri.parse(url));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to open feedback link: ${msg}`);
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const webviewDistDir = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview');
    const indexHtmlPath = path.join(webviewDistDir.fsPath, 'index.html');

    console.log('[RETRACE-DEBUG] webviewDistDir:', webviewDistDir.fsPath);
    console.log('[RETRACE-DEBUG] indexHtmlPath:', indexHtmlPath);
    console.log('[RETRACE-DEBUG] indexHtmlPath exists:', fs.existsSync(indexHtmlPath));

    if (fs.existsSync(indexHtmlPath)) {
      let html = fs.readFileSync(indexHtmlPath, 'utf8');

      // CSP meta tag allowing webview resources including connect-src for fetch/postMessage
      const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; connect-src ${webview.cspSource} https: data:; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} data:; worker-src ${webview.cspSource} blob:;">`;

      // Strip crossorigin attribute which causes CORS issues in custom webview schemes
      html = html.replace(/\s+crossorigin(?:="[^"]*")?/g, '');

      // Inject CSP meta tag inside head
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>\n    ${csp}`);
      } else {
        html = `<head>${csp}</head>${html}`;
      }

      // Convert asset paths to webview URIs
      html = html.replace(/(src|href)=(["'])(?:\.\/|\/)?(assets\/[^"']+)\2/g, (_match, attr, quote, relPath) => {
        const resourceUri = vscode.Uri.joinPath(webviewDistDir, relPath);
        const webviewUri = webview.asWebviewUri(resourceUri);
        console.log(`[RETRACE-DEBUG] Converted asset '${relPath}' to webview URI: '${webviewUri.toString()}'`);
        return `${attr}=${quote}${webviewUri.toString()}${quote}`;
      });

      const bannerAndDiag = `
        <div id="retrace-diagnostic-banner" style="background: #e11d48; color: #ffffff; padding: 12px; font-weight: bold; font-size: 14px; text-align: center; border-bottom: 2px solid #ffffff; font-family: sans-serif;">
          RETRACE WEBVIEW HTML LOADED
        </div>
        <script>
          console.log('[RETRACE-DEBUG] Inline HTML script executing inside webview!');
          window.addEventListener('error', function(e) {
            console.error('[RETRACE-DEBUG] Uncaught Webview Error:', e.error || e.message, e.filename, e.lineno, e.colno);
            var errDiv = document.createElement('div');
            errDiv.style.color = '#facc15';
            errDiv.style.background = '#000000';
            errDiv.style.padding = '8px';
            errDiv.style.margin = '8px';
            errDiv.style.borderRadius = '4px';
            errDiv.style.fontSize = '12px';
            errDiv.style.fontFamily = 'monospace';
            errDiv.innerText = '[RETRACE-DEBUG Exception]: ' + (e.error ? (e.error.stack || e.error) : e.message);
            document.body.appendChild(errDiv);
          });
          window.addEventListener('unhandledrejection', function(e) {
            console.error('[RETRACE-DEBUG] Uncaught Promise Rejection:', e.reason);
            var errDiv = document.createElement('div');
            errDiv.style.color = '#fb923c';
            errDiv.style.background = '#000000';
            errDiv.style.padding = '8px';
            errDiv.style.margin = '8px';
            errDiv.style.borderRadius = '4px';
            errDiv.style.fontSize = '12px';
            errDiv.style.fontFamily = 'monospace';
            errDiv.innerText = '[RETRACE-DEBUG Promise Rejection]: ' + e.reason;
            document.body.appendChild(errDiv);
          });
        </script>
      `;

      if (html.includes('</body>')) {
        html = html.replace('</body>', `${bannerAndDiag}\n</body>`);
      } else {
        html = `${html}\n${bannerAndDiag}`;
      }

      console.log('[RETRACE-DEBUG] Final Webview HTML:\n', html);
      return html;
    }

    console.error('[RETRACE-DEBUG] index.html NOT FOUND at:', indexHtmlPath);
    return `<!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>Retrace</title></head>
      <body><div id="root">Loading Retrace Webview (FALLBACK: index.html not found)...</div></body>
      </html>`;
  }
}

export type RetraceWebviewProvider = RetraceSidebarProvider;
