export interface PrivacySettings {
  showRepoName: boolean;
  showBranchName: boolean;
  showFileNames: boolean;
  showTimestamps: boolean;
  showLineNumbers: boolean;
  showLineStats: boolean;
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  showRepoName: true,
  showBranchName: true,
  showFileNames: true,
  showTimestamps: false,
  showLineNumbers: false,
  showLineStats: true,
};

/**
 * Strips user home directory, usernames, and absolute filesystem paths.
 * Normalizes Windows and Unix paths.
 */
export function sanitizeFilePath(filePath: string, showFileNames: boolean = true): string {
  if (!filePath) return 'unknown';

  // Normalize slashes
  let norm = filePath.replace(/\\/g, '/');

  // Strip home directory patterns (e.g. /Users/name/, C:/Users/name/)
  norm = norm.replace(/^([a-zA-Z]:)?\/(Users|home)\/[^/]+\//i, '');

  // Strip drive letters if present
  norm = norm.replace(/^[a-zA-Z]:\//, '');

  // If leading slash remains, strip leading slashes
  norm = norm.replace(/^\/+/, '');

  if (!showFileNames) {
    const ext = norm.includes('.') ? norm.split('.').pop() : '';
    return ext ? `file.${ext}` : 'file';
  }

  // Keep relative path or filename
  return norm;
}

/**
 * Sanitizes repository name according to privacy settings.
 */
export function sanitizeRepoName(repoName?: string, showRepoName: boolean = true): string {
  if (!showRepoName) return '[Hidden Repo]';
  if (!repoName || repoName === 'Standalone Files' || repoName === 'Standalone') {
    return 'my-project';
  }
  // Strip system path parts if repo name accidentally contains path
  const clean = repoName.replace(/\\/g, '/').split('/').pop() || repoName;
  return clean;
}

/**
 * Sanitizes branch name according to privacy settings.
 */
export function sanitizeBranchName(branchName?: string, showBranchName: boolean = true): string {
  if (!showBranchName) return '[Hidden Branch]';
  if (!branchName) return 'main';
  return branchName.replace(/^commit:/i, '');
}

/**
 * HTML escaper to prevent HTML injection in generated export files.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
