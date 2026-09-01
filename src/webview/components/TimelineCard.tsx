import React from 'react';
import { ExternalLink, GitBranch, FolderGit2, Clock, Edit3, MapPin } from 'lucide-react';
import { Session } from '../../storage/types';
import { vscodeApi } from '../vscodeApi';

interface TimelineCardProps {
  session: Session;
  isLocked?: boolean;
  onUnlockClick?: () => void;
}

export const TimelineCard: React.FC<TimelineCardProps> = ({ session, isLocked = false, onUnlockClick }) => {
  const fileName = session.file_path.split(/[/\\]/).pop() || session.file_path;
  const directory = session.file_path.substring(0, session.file_path.length - fileName.length);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
  };

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSmartJump = () => {
    if (isLocked) {
      if (onUnlockClick) onUnlockClick();
      return;
    }

    vscodeApi.postMessage({
      command: 'openFile',
      filePath: session.file_path,
      lineStart: session.cursor_start_line,
      lineEnd: session.cursor_end_line,
    });
  };

  return (
    <div className={`relative group pl-6 pb-4 border-l-4 ${
      isLocked ? 'border-dashed border-amber-500/30' : 'border-[var(--vscode-activityBar-activeBorder,#007acc)]'
    }`}>
      {/* Railway node circle */}
      <div className={`absolute -left-[10px] top-1.5 w-4 h-4 rounded-full border-2 bg-[var(--vscode-sideBar-background,#1e1e1e)] transition-transform duration-200 group-hover:scale-110 ${
        isLocked ? 'border-amber-500/60 bg-amber-950/40' : 'border-[var(--vscode-activityBar-activeBorder,#007acc)]'
      }`} />

      {/* Card Content */}
      <div
        onClick={handleSmartJump}
        className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
          isLocked
            ? 'filter blur-[1.5px] opacity-60 bg-neutral-900/40 border-amber-500/20 select-none pointer-events-none'
            : 'bg-[var(--vscode-sideBarSectionHeader-background,#252526)] border-[var(--vscode-widget-border,#333)] hover:border-[var(--vscode-focusBorder,#007acc)] hover:shadow-md'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-xs text-[var(--vscode-editor-foreground,#fff)] truncate" title={session.file_path}>
              {fileName}
            </h4>
            <p className="text-[10px] text-[var(--vscode-descriptionForeground,#aaa)] truncate" title={directory}>
              {directory}
            </p>
          </div>

          <span className="text-[10px] text-[var(--vscode-descriptionForeground,#888)] shrink-0">
            {formatTime(session.timestamp)}
          </span>
        </div>

        {/* Repo & Branch info */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--vscode-badge-background,#2b2d30)] text-[var(--vscode-badge-foreground,#fff)] font-medium">
            <FolderGit2 className="w-3 h-3 text-sky-400" />
            <span>{session.repo_name}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-800/80 text-[var(--vscode-descriptionForeground,#aaa)]">
            <GitBranch className="w-3 h-3 text-purple-400" />
            <span>{session.git_branch}</span>
          </span>
        </div>

        {/* Metrics Bar */}
        <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-[var(--vscode-widget-border,#333)] text-[10px]">
          <span className="inline-flex items-center gap-1 text-emerald-400" title="Active Duration">
            <Clock className="w-3 h-3" />
            <span>⏱️ {formatDuration(session.duration_seconds)}</span>
          </span>

          <span className="inline-flex items-center gap-1 text-sky-300" title="Lines Changed">
            <Edit3 className="w-3 h-3" />
            <span>✍️ +{session.lines_added} / -{session.lines_deleted}</span>
          </span>

          <span className="inline-flex items-center gap-1 text-amber-300" title="Cursor Bookmark">
            <MapPin className="w-3 h-3" />
            <span>📍 Ln {session.cursor_start_line}–{session.cursor_end_line}</span>
          </span>
        </div>

        {/* Smart Jump Button */}
        {!isLocked && (
          <button
            onClick={handleSmartJump}
            className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-1 px-2 text-[11px] font-medium rounded bg-[var(--vscode-button-secondaryBackground,#3a3d41)] text-[var(--vscode-button-secondaryForeground,#fff)] hover:bg-[var(--vscode-button-secondaryHoverBackground,#45494e)] transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Smart Jump</span>
          </button>
        )}
      </div>
    </div>
  );
};
