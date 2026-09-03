import * as vscode from 'vscode';
import * as path from 'path';
import { DatabaseManager } from './storage/db';
import { WorkspaceWatcher } from './tracker/workspaceWatcher';
import { RetraceSidebarProvider } from './webview/sidebarViewProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[RETRACE-DEBUG] Extension activate() starting...');
  const dbPath = path.join(context.globalStorageUri.fsPath, 'retrace.db');
  console.log('[RETRACE-DEBUG] Database path:', dbPath);
  const dbManager = new DatabaseManager(dbPath);
  try {
    await dbManager.initialize();
    console.log('[RETRACE-DEBUG] Database initialized successfully');
  } catch (err) {
    console.error('[RETRACE-DEBUG] Failed to initialize database:', err);
  }

  const workspaceWatcher = new WorkspaceWatcher(dbManager);
  workspaceWatcher.start();
  context.subscriptions.push(workspaceWatcher);

  console.log('[RETRACE-DEBUG] Creating RetraceSidebarProvider instance...');
  const sidebarProvider = new RetraceSidebarProvider(
    context.extensionUri,
    dbManager,
    context.workspaceState,
    workspaceWatcher
  );

  console.log('[RETRACE-DEBUG] Registering WebviewViewProvider for retrace.sidebarView');
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

  console.log('[RETRACE-DEBUG] Extension activate() completed successfully');
}

export function deactivate(): void {
  // Disposables handle cleanup automatically
}
