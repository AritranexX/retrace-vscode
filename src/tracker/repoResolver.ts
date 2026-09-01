import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function resolveRepoAndBranch(uri: vscode.Uri): { repoName: string; gitBranch: string } {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    return { repoName: 'Standalone Files', gitBranch: 'main' };
  }

  const repoName = workspaceFolder.name;
  let gitBranch = 'main';

  try {
    const gitHeadPath = path.join(workspaceFolder.uri.fsPath, '.git', 'HEAD');
    if (fs.existsSync(gitHeadPath)) {
      const headContent = fs.readFileSync(gitHeadPath, 'utf8').trim();
      if (headContent.startsWith('ref: refs/heads/')) {
        gitBranch = headContent.replace('ref: refs/heads/', '');
      } else if (headContent.length >= 7) {
        const commitHash = headContent.substring(0, 7);
        const commitMsgPath = path.join(workspaceFolder.uri.fsPath, '.git', 'COMMIT_EDITMSG');
        if (fs.existsSync(commitMsgPath)) {
          const msg = fs.readFileSync(commitMsgPath, 'utf8').trim().split('\n')[0];
          if (msg && !msg.startsWith('#')) {
            gitBranch = `commit: ${commitHash} (${msg})`;
          } else {
            gitBranch = `commit: ${commitHash}`;
          }
        } else {
          gitBranch = `commit: ${commitHash}`;
        }
      }
    }
  } catch {
    // Fallback default
  }

  return { repoName, gitBranch };
}

