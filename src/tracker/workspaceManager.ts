import * as vscode from 'vscode';

export function getWorkspaceColor(rootName: string): string {
  const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < rootName.length; i++) hash = rootName.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
  if (typeof vscode !== 'undefined' && vscode.workspace && vscode.workspace.workspaceFolders) {
    return vscode.workspace.workspaceFolders;
  }
  return [];
}

export function deriveRootFolder(documentUri?: vscode.Uri | string): string {
  if (!documentUri) return 'Standalone';

  if (typeof vscode !== 'undefined' && vscode.workspace) {
    let uriObj: vscode.Uri | null = null;
    if (typeof documentUri === 'string') {
      uriObj = vscode.Uri.file(documentUri);
    } else {
      uriObj = documentUri;
    }

    if (vscode.workspace.getWorkspaceFolder && uriObj) {
      const folder = vscode.workspace.getWorkspaceFolder(uriObj);
      if (folder) return folder.name;
    }

    const folders = vscode.workspace.workspaceFolders || [];
    if (folders.length > 0 && uriObj) {
      const docPath = uriObj.fsPath.replace(/\\/g, '/');
      for (const folder of folders) {
        const folderPath = folder.uri.fsPath.replace(/\\/g, '/');
        if (docPath.startsWith(folderPath)) {
          return folder.name;
        }
      }
    }
  }

  // Fallback if VS Code workspace context is not active
  const pathStr = typeof documentUri === 'string' ? documentUri : documentUri.fsPath;
  if (pathStr) {
    const normalized = pathStr.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length > 1) {
      return parts[parts.length - 2] || 'Standalone';
    }
  }

  return 'Standalone';
}

export interface TaggedDocument {
  rootFolder: string;
  color: string;
  uri?: vscode.Uri | string;
}

export function tagDocument(documentUri?: vscode.Uri | string): TaggedDocument {
  const rootFolder = deriveRootFolder(documentUri);
  const color = getWorkspaceColor(rootFolder);
  return {
    rootFolder,
    color,
    uri: documentUri,
  };
}

export class WorkspaceManager implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor() {
    if (typeof vscode !== 'undefined' && vscode.workspace && vscode.workspace.onDidChangeWorkspaceFolders) {
      this.disposables.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
          // Folder configuration changed
        })
      );
    }
  }

  public getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
    return getWorkspaceFolders();
  }

  public getRootFolder(documentUri?: vscode.Uri | string): string {
    return deriveRootFolder(documentUri);
  }

  public getWorkspaceColor(rootName: string): string {
    return getWorkspaceColor(rootName);
  }

  public tagDocument(documentUri?: vscode.Uri | string): TaggedDocument {
    return tagDocument(documentUri);
  }

  public isolateByWorkspace<T extends { rootFolder?: string; filePath?: string }>(
    sessions: T[]
  ): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const session of sessions) {
      const root = session.rootFolder || (session.filePath ? deriveRootFolder(session.filePath) : 'Standalone');
      const list = map.get(root) || [];
      list.push(session);
      map.set(root, list);
    }
    return map;
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
