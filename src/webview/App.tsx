import React, { useEffect, useState, useMemo } from 'react';
import { Session, RepoMetric } from '../storage/types';
import { LeftSpineCanvas } from './components/LeftSpineCanvas';
import { ControlsHeader } from './components/ControlsHeader';
import { ShareModal } from './components/ShareModal';
import { vscodeApi } from './vscodeApi';

interface IdlePromptData {
  mins: number;
  durationSeconds: number;
  startTime: number;
}

export const App: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [repoMetrics, setRepoMetrics] = useState<RepoMetric[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRepo, setSelectedRepo] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [idlePrompt, setIdlePrompt] = useState<IdlePromptData | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  useEffect(() => {
    vscodeApi.postMessage({ command: 'getSessions' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || (!message.command && !message.type)) return;

      if (message.command === 'updateData') {
        setSessions(message.sessions || []);
        setRepoMetrics(message.repoMetrics || []);
        setActiveFilePath(message.activeFilePath);
        setIsLoading(false);
      } else if (message.command === 'showIdlePrompt') {
        setIdlePrompt({
          mins: message.mins,
          durationSeconds: message.durationSeconds,
          startTime: message.startTime,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    vscodeApi.postMessage({ command: 'getSessions' });
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesRepo = selectedRepo === 'ALL' || session.repo_name === selectedRepo;
      if (!matchesRepo) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchRepoName = session.repo_name.toLowerCase().includes(q);

      const matchFiles = session.file_events.some((fe) => {
        const pathMatch = fe.file_path.toLowerCase().includes(q);
        const bookmarkMatch = fe.bookmarks?.some(
          (bm) =>
            bm.label?.toLowerCase().includes(q) ||
            bm.snippet?.toLowerCase().includes(q)
        );
        return pathMatch || bookmarkMatch;
      });

      return matchRepoName || matchFiles;
    });
  }, [sessions, selectedRepo, searchQuery]);

  return (
    <div className="flex flex-col h-screen w-full bg-[var(--vscode-sideBar-background,#1e1e1e)] text-[var(--vscode-sideBar-foreground,#ccc)] p-3 font-sans text-xs select-none">
      <ControlsHeader
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedRepo={selectedRepo}
        onSelectRepo={setSelectedRepo}
        repoMetrics={repoMetrics}
        onRefresh={handleRefresh}
        onOpenShare={() => setIsShareModalOpen(true)}
      />

      <div className="flex-1 overflow-hidden my-3 bg-[var(--vscode-editor-background,#181818)] rounded-lg border border-[var(--vscode-widget-border,#2d2d2d)] flex flex-col">
        {filteredSessions.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center text-[var(--vscode-descriptionForeground,#888)] space-y-2">
            <p className="font-medium text-sm">No activity recorded yet</p>
            <p className="text-xs">Start editing files in VS Code to see your timeline build up automatically.</p>
          </div>
        ) : (
          <LeftSpineCanvas
            sessions={filteredSessions}
            activeFilePath={activeFilePath}
            className="h-full w-full flex-1 overflow-y-auto"
          />
        )}
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        sessions={filteredSessions}
        selectedRepo={selectedRepo}
      />

      {idlePrompt && (
        <div className="p-2.5 bg-[var(--vscode-editorWidget-background,#252526)] border border-[var(--vscode-widget-border,#454545)] rounded-md shadow-lg text-xs animate-fade-in shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-[var(--vscode-foreground,#cccccc)]">
              You were away for {idlePrompt.mins} mins. Log this time?
            </span>
            <button
              onClick={() => setIdlePrompt(null)}
              className="text-[var(--vscode-descriptionForeground,#888888)] hover:text-[var(--vscode-foreground,#ffffff)] p-0.5"
              title="Close"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['Meeting', 'Code Review', 'Research'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  vscodeApi.postMessage({
                    command: 'logIdleTime',
                    category: cat,
                    durationSeconds: idlePrompt.durationSeconds,
                    startTime: idlePrompt.startTime,
                  });
                  setIdlePrompt(null);
                }}
                className="px-2.5 py-1 bg-[var(--vscode-button-background,#0e639c)] hover:bg-[var(--vscode-button-hoverBackground,#1177bb)] text-[var(--vscode-button-foreground,#ffffff)] rounded text-[11px] font-medium transition-colors"
              >
                {cat}
              </button>
            ))}
            <button
              onClick={() => setIdlePrompt(null)}
              className="px-2.5 py-1 bg-[var(--vscode-button-secondaryBackground,#3a3d41)] hover:bg-[var(--vscode-button-secondaryHoverBackground,#45494e)] text-[var(--vscode-button-secondaryForeground,#ffffff)] rounded text-[11px] font-medium transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
