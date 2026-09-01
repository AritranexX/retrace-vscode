import { WorkflowSummary, formatDuration, formatTimestamp, getCollapsedWorkflowSequence } from './workflowShare';
import { PrivacySettings, escapeHtml } from './workflowPrivacy';

/**
 * Generates plain text summary for clipboard copy.
 */
export function generateShareableTextSummary(
  summary: WorkflowSummary,
  privacySettings: PrivacySettings
): string {
  const lines: string[] = [];

  lines.push(`Retrace — ${summary.title}`);
  lines.push('');

  if (privacySettings.showRepoName && summary.repoName && summary.repoName !== '[Hidden Repo]') {
    lines.push(`Repository: ${summary.repoName}`);
  }
  if (privacySettings.showBranchName && summary.gitBranch && summary.gitBranch !== '[Hidden Branch]') {
    lines.push(`Branch: ${summary.gitBranch}`);
  }

  lines.push(`Duration: ${formatDuration(summary.totalDurationSeconds)}`);
  lines.push(`Files: ${summary.uniqueFilesCount}`);
  lines.push(`Iterations: ${summary.totalIterations}`);

  if (privacySettings.showLineStats && (summary.linesAdded > 0 || summary.linesDeleted > 0)) {
    lines.push(`Line Stats: +${summary.linesAdded} / -${summary.linesDeleted}`);
  }

  if (privacySettings.showTimestamps && summary.startTime) {
    lines.push(`Time: ${formatTimestamp(summary.startTime)}`);
  }

  lines.push('');
  lines.push('Workflow Path:');

  const sequenceToUse = getCollapsedWorkflowSequence(summary.sequence, 20);
  if (sequenceToUse.length === 0) {
    lines.push('(No activity steps recorded)');
  } else {
    const steps = sequenceToUse.map((node) => {
      if (node.stepIndex === -1) {
        return node.displayPath;
      }
      let stepStr = node.displayPath;
      if (node.isRevisited) {
        stepStr = `↻ Revisited ${stepStr}`;
      }
      if (privacySettings.showLineStats && (node.linesAdded > 0 || node.linesDeleted > 0)) {
        stepStr += ` (+${node.linesAdded}/-${node.linesDeleted})`;
      }
      if (privacySettings.showLineNumbers && node.cursorStartLine) {
        stepStr += ` [L${node.cursorStartLine}-${node.cursorEndLine || node.cursorStartLine}]`;
      }
      return stepStr;
    });

    lines.push(steps.join(' → '));
  }

  lines.push('');
  lines.push('Generated with Retrace.');

  return lines.join('\n');
}

/**
 * Generates self-contained, offline-compatible HTML file for export.
 */
export function generateStandaloneHtml(
  summary: WorkflowSummary,
  privacySettings: PrivacySettings
): string {
  const title = escapeHtml(summary.title);
  const repoName = escapeHtml(summary.repoName);
  const gitBranch = escapeHtml(summary.gitBranch);
  const duration = escapeHtml(formatDuration(summary.totalDurationSeconds));
  const filesCount = summary.uniqueFilesCount;
  const iterationsCount = summary.totalIterations;

  const sequence = getCollapsedWorkflowSequence(summary.sequence, 30);
  const itemsHtml = sequence.map((node, index) => {
    if (node.stepIndex === -1) {
      return `<div style="text-align:center;padding:8px;font-size:12px;color:#94a3b8;">${escapeHtml(node.displayPath)}</div>`;
    }
    const fileName = escapeHtml(node.fileName);
    const displayPath = escapeHtml(node.displayPath);
    const visitTag = node.isRevisited ? `<span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(168,85,247,0.2);color:#c084fc;">↻ Revisited</span>` : '';
    const lineStatsTag = privacySettings.showLineStats && (node.linesAdded > 0 || node.linesDeleted > 0)
      ? `<span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(34,197,94,0.15);color:#4ade80;">+${node.linesAdded} / -${node.linesDeleted}</span>` : '';
    const durationStr = escapeHtml(formatDuration(node.durationSeconds));
    return `<div style="display:flex;gap:12px;align-items:flex-start;"><div style="width:10px;height:10px;border-radius:50%;background:#a855f7;margin-top:14px;flex-shrink:0;"></div><div style="flex:1;background:#1a1a22;border:1px solid #2e2e3e;border-radius:8px;padding:10px 14px;"><div style="display:flex;justify-space-between;font-size:14px;font-weight:600;color:#fff;"><span>${fileName}</span><span style="font-size:12px;color:#94a3b8;">${durationStr}</span></div><div style="font-size:12px;color:#94a3b8;margin:4px 0;">${displayPath}</div><div style="display:flex;gap:6px;margin-top:4px;">${visitTag} ${lineStatsTag}</div></div></div>${index < sequence.length - 1 ? '<div style="width:2px;height:12px;background:#2e2e3e;margin-left:4px;"></div>' : ''}`;
  }).join('\n');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Retrace Workflow — ${title}</title><style>body{background:#121216;color:#e2e8f0;font-family:sans-serif;padding:2rem;display:flex;justify-content:center;}.container{width:100%;max-width:600px;background:#16161e;border:1px solid #2e2e3e;border-radius:12px;padding:1.5rem;}.logo{font-weight:700;font-size:12px;color:#a855f7;}.title{font-size:20px;font-weight:700;color:#fff;margin:6px 0;}.subtitle{font-size:13px;color:#94a3b8;display:flex;gap:12px;}.stats{display:flex;gap:16px;background:#1a1a22;border:1px solid #2e2e3e;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;}.footer{margin-top:20px;padding-top:12px;border-top:1px solid #2e2e3e;text-align:center;font-size:12px;color:#64748b;}</style></head><body><div class="container"><div><div class="logo">RETRACE WORKFLOW</div><div class="title">${title}</div><div class="subtitle">${privacySettings.showRepoName ? `<span>📦 ${repoName}</span>` : ''} ${privacySettings.showBranchName ? `<span>🌿 ${gitBranch}</span>` : ''}</div></div><div class="stats"><div><strong>Duration:</strong> ${duration}</div><div><strong>Files:</strong> ${filesCount}</div><div><strong>Iterations:</strong> ${iterationsCount}</div></div><div>${itemsHtml}</div><div class="footer">Generated with Retrace — Local-First Developer Timeline</div></div></body></html>`;
}
