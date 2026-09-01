import * as vscode from 'vscode';
import * as path from 'path';
import { DatabaseManager } from './storage/db';
import { WorkspaceWatcher } from './tracker/workspaceWatcher';
import { RetraceSidebarProvider } from './webview/sidebarViewProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const dbPath = path.join(context.globalStorageUri.fsPath, 'retrace.db');
  const dbManager = new DatabaseManager(dbPath);
  await dbManager.initialize();

  const workspaceWatcher = new WorkspaceWatcher(dbManager);
  workspaceWatcher.start();
  context.subscriptions.push(workspaceWatcher);

  const sidebarProvider = new RetraceSidebarProvider(
    context.extensionUri,
    dbManager,
    context.workspaceState,
    workspaceWatcher
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      RetraceSidebarProvider.viewType,
      sidebarProvider
    )
  );

  workspaceWatcher.onSessionFlushed(() => {
    sidebarProvider.sendDataToWebview();
  });

  workspaceWatcher.onActiveEditorChanged(() => {
    sidebarProvider.sendDataToWebview();
  });
}

export function deactivate(): void {
  // Disposables handle cleanup automatically
}
