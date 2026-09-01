import React from 'react';
import { Search, History, Filter, RefreshCw, Share2 } from 'lucide-react';
import { RepoMetric } from '../../storage/types';

interface ControlsHeaderProps {
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedRepo: string;
  onSelectRepo: (repo: string) => void;
  repoMetrics: RepoMetric[];
  onRefresh: () => void;
  onOpenShare?: () => void;
}

export const ControlsHeader: React.FC<ControlsHeaderProps> = ({
  isLoading, searchQuery, onSearchChange, selectedRepo,
  onSelectRepo, repoMetrics, onRefresh, onOpenShare
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--vscode-widget-border,#333)]">
        <div className="flex items-center gap-1.5 font-bold text-sm text-[var(--vscode-sideBarTitle-foreground,#fff)]">
          <History className="w-4 h-4 text-[var(--vscode-activityBar-activeBorder,#007acc)]" />
          <span>Retrace</span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenShare && (
            <button
              onClick={onOpenShare}
              className="p-1.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground,#333)] text-purple-400 hover:text-purple-300 transition-colors"
              title="Share / Export Workflow"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onRefresh} className="p-1.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground,#333)] text-[var(--vscode-descriptionForeground,#aaa)]" title="Refresh Timeline">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[var(--vscode-input-placeholderForeground,#888)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search sessions or files..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-[var(--vscode-input-border,#444)] bg-[var(--vscode-input-background,#252526)] text-[var(--vscode-input-foreground,#fff)] focus:outline-none focus:border-[var(--vscode-focusBorder,#007acc)]"
          />
        </div>

        {repoMetrics.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
            <Filter className="w-3 h-3 text-[var(--vscode-descriptionForeground,#888)] shrink-0" />
            <button
              onClick={() => onSelectRepo('ALL')}
              className={`px-2 py-0.5 rounded-full font-medium shrink-0 ${
                selectedRepo === 'ALL'
                  ? 'bg-[var(--vscode-button-background,#007acc)] text-[var(--vscode-button-foreground,#fff)]'
                  : 'bg-[var(--vscode-badge-background,#2b2d30)] text-[var(--vscode-badge-foreground,#ccc)] hover:opacity-80'
              }`}
            >
              All Repos
            </button>
            {repoMetrics.map((m) => (
              <button
                key={m.repo_name}
                onClick={() => onSelectRepo(m.repo_name)}
                className={`px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  selectedRepo === m.repo_name
                    ? 'bg-[var(--vscode-button-background,#007acc)] text-[var(--vscode-button-foreground,#fff)]'
                    : 'bg-[var(--vscode-badge-background,#2b2d30)] text-[var(--vscode-badge-foreground,#ccc)] hover:opacity-80'
                }`}
              >
                {m.repo_name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

