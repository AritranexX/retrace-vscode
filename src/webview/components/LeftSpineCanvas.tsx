import React, { useMemo, useState } from 'react';
import {
  FileCode,
  FileJson,
  Palette,
  FileText,
  Code,
  Folder,
  GitBranch,
  Lock,
  ChevronRight,
  ChevronDown,
  Repeat,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { Session } from '../../storage/types';
import { generateLeftSpineTree, LeftSpineFileNode } from '../../tracker/graphEngine';
import { vscodeApi } from '../vscodeApi';

interface LeftSpineCanvasProps {
  sessions: Session[];
  activeFilePath?: string;
  className?: string;
}

const CHILD_TRUNCATION_LIMIT = 5;

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <Code className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    case 'py':
      return <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case 'css':
    case 'scss':
    case 'tailwind':
      return <Palette className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    case 'json':
    case 'yaml':
    case 'yml':
      return <FileJson className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
  }
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
};

interface ChildStepsListProps {
  childrenNodes: LeftSpineFileNode[];
  isTruncationExpanded: boolean;
  onToggleTruncation: () => void;
  onSmartJump: (node: LeftSpineFileNode) => void;
}

const ChildStepsList: React.FC<ChildStepsListProps> = ({
  childrenNodes,
  isTruncationExpanded,
  onToggleTruncation,
  onSmartJump,
}) => {
  const visibleChildren = isTruncationExpanded
    ? childrenNodes
    : childrenNodes.slice(0, CHILD_TRUNCATION_LIMIT);
  const remainingChildrenCount = childrenNodes.length - visibleChildren.length;

  return (
    <div className="pl-6 border-l border-purple-500/30 space-y-1.5 ml-4 mt-1">
      {visibleChildren.map((childNode, childIdx) => {
        const isLastChild =
          childIdx === visibleChildren.length - 1 && remainingChildrenCount === 0;
        const childBranch = isLastChild ? '└───' : '├───';

        return (
          <div key={childNode.stepIndex} className="flex items-center gap-1.5">
            <span className="text-purple-400/70 font-mono text-[10px] shrink-0">
              {childBranch}
            </span>

            <div
              onClick={() => onSmartJump(childNode)}
              className="flex-1 py-1 px-2 rounded border border-[#2a2a34] bg-[#18181e] hover:border-purple-500/50 hover:bg-[#1f1f28] flex items-center justify-between text-[11px] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-purple-300 font-bold text-[10px] font-mono">
                  [#{childNode.stepIndex}]
                </span>
                {getFileIcon(childNode.fileName)}
                <span className="text-neutral-300 truncate" title={childNode.filePath}>
                  {childNode.fileName} (Iteration #{childIdx + 1})
                </span>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                <span className="text-emerald-400">
                  ⏱️ {formatDuration(childNode.durationSeconds)}
                </span>
                <span className="text-amber-300">
                  📍 Ln {childNode.cursorStartLine}-{childNode.cursorEndLine}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {remainingChildrenCount > 0 && (
        <div className="flex items-center gap-1.5 pl-0.5 pt-0.5">
          <span className="text-purple-400/70 font-mono text-[10px]">└───</span>
          <button
            onClick={onToggleTruncation}
            className="py-1 px-2.5 rounded border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 text-purple-200 text-[10px] font-sans flex items-center gap-1 transition-colors"
          >
            <span>Show {remainingChildrenCount} more child loop iterations...</span>
          </button>
        </div>
      )}

      {isTruncationExpanded && childrenNodes.length > CHILD_TRUNCATION_LIMIT && (
        <div className="flex items-center gap-1.5 pl-0.5 pt-0.5">
          <button
            onClick={onToggleTruncation}
            className="py-0.5 px-2 rounded border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 text-[10px] font-sans transition-colors"
          >
            Show fewer child steps
          </button>
        </div>
      )}
    </div>
  );
};
interface LeftSpineNodeItemProps {
  fileNode: LeftSpineFileNode;
  branchSymbol: string;
  isLoopExpanded: boolean;
  isTruncationExpanded: boolean;
  onToggleLoop: () => void;
  onToggleTruncation: () => void;
  onSmartJump: (node: LeftSpineFileNode) => void;
}

const LeftSpineNodeItem: React.FC<LeftSpineNodeItemProps> = ({
  fileNode,
  branchSymbol,
  isLoopExpanded,
  isTruncationExpanded,
  onToggleLoop,
  onToggleTruncation,
  onSmartJump,
}) => {
  const isLoop = Boolean(
    fileNode.isLoopParent ||
      fileNode.visitCount > 1 ||
      (fileNode.children && fileNode.children.length > 0)
  );
  const children = fileNode.children || [];
  const hasChildren = children.length > 0;

  return (
    <div className="flex flex-col gap-1">
      {/* Parent Node Row */}
      <div className="flex items-center gap-1.5">
        <span className="text-sky-400 font-mono shrink-0 text-xs">{branchSymbol}</span>

        <div
          onClick={() => onSmartJump(fileNode)}
          className={`flex-1 min-h-[40px] px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 transition-all cursor-pointer ${
            fileNode.isLatest
              ? 'bg-[#1e2722] border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/50'
              : fileNode.isLocked
              ? 'bg-neutral-900/60 border-amber-500/30 opacity-70'
              : 'bg-[#202025] border-[#2f2f36] hover:border-[#007acc] hover:bg-[#25252b]'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {isLoop && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLoop();
                }}
                className="p-0.5 rounded hover:bg-neutral-700/60 text-purple-300 transition-colors shrink-0"
                title={
                  isLoopExpanded
                    ? 'Collapse loop iterations'
                    : `Expand ${fileNode.visitCount} loop iterations`
                }
              >
                {isLoopExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <span className="text-amber-400 font-bold text-[11px] font-mono shrink-0">
              [#{fileNode.stepIndex}]
            </span>
            {getFileIcon(fileNode.fileName)}

            <span
              onClick={() => onSmartJump(fileNode)}
              className="font-bold text-neutral-100 text-xs truncate cursor-pointer hover:underline"
              title={fileNode.filePath}
            >
              {fileNode.fileName}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] shrink-0 font-mono">
            {fileNode.isLatest && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse flex items-center gap-1 font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Active
              </span>
            )}

            {isLoop && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLoop();
                }}
                className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-900/60 text-purple-300 border border-purple-500/40 flex items-center gap-1 cursor-pointer hover:bg-purple-800/80 transition-colors font-sans"
                title={
                  isLoopExpanded
                    ? 'Click to collapse loop steps'
                    : `${fileNode.visitCount} loop iterations collapsed by default. Click to expand.`
                }
              >
                <Repeat className="w-3 h-3 text-purple-400" />
                <span>{fileNode.visitCount}x Loop</span>
                {!isLoopExpanded && (
                  <span className="text-[8px] opacity-75 font-mono">(Collapsed)</span>
                )}
              </span>
            )}

            <span className="text-emerald-400 flex items-center gap-0.5" title="Active Duration">
              ⏱️ {formatDuration(fileNode.durationSeconds)}
            </span>

            {!isLoop && (
              <span className="text-purple-300 font-semibold" title="Visit Count">
                ({fileNode.visitCount}x)
              </span>
            )}

            <span className="text-amber-300 flex items-center gap-0.5" title="Cursor Line Range">
              📍 Ln {fileNode.cursorStartLine}-{fileNode.cursorEndLine}
            </span>

            {fileNode.isLocked && <Lock className="w-3.5 h-3.5 text-amber-400 ml-0.5" />}
          </div>
        </div>
      </div>

      {/* Nested Child Steps Rendering */}
      {isLoop && isLoopExpanded && hasChildren && (
        <ChildStepsList
          childrenNodes={children}
          isTruncationExpanded={isTruncationExpanded}
          onToggleTruncation={onToggleTruncation}
          onSmartJump={onSmartJump}
        />
      )}
    </div>
  );
};

export const LeftSpineCanvas: React.FC<LeftSpineCanvasProps> = ({
  sessions,
  isPro,
  activeFilePath,
  onUnlockClick,
  className = '',
}) => {
  const treeData = useMemo(() => {
    return generateLeftSpineTree(sessions, isPro, activeFilePath);
  }, [sessions, isPro, activeFilePath]);

  // Fold state for folder groups: collapsedGroupIds
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

  // Loop fold state: expandedLoopKeys (empty by default -> loops collapsed by default!)
  const [expandedLoopKeys, setExpandedLoopKeys] = useState<Set<string>>(new Set());

  // Truncation state for child steps in expanded loops
  const [expandedTruncationKeys, setExpandedTruncationKeys] = useState<Set<string>>(new Set());

  const notifyLayoutShift = () => {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('retrace:workspaceLayoutShift'));
    }, 50);
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
    notifyLayoutShift();
  };

  const toggleLoopExpand = (loopKey: string) => {
    setExpandedLoopKeys((prev) => {
      const next = new Set(prev);
      if (next.has(loopKey)) {
        next.delete(loopKey);
      } else {
        next.add(loopKey);
      }
      return next;
    });
    notifyLayoutShift();
  };

  const toggleTruncationExpand = (loopKey: string) => {
    setExpandedTruncationKeys((prev) => {
      const next = new Set(prev);
      if (next.has(loopKey)) {
        next.delete(loopKey);
      } else {
        next.add(loopKey);
      }
      return next;
    });
    notifyLayoutShift();
  };

  const allLoopKeys = useMemo(() => {
    const keys: string[] = [];
    treeData.groups.forEach((g) => {
      g.files.forEach((f) => {
        if (f.isLoopParent || f.visitCount > 1 || (f.children && f.children.length > 0)) {
          keys.push(f.filePath);
        }
      });
    });
    return keys;
  }, [treeData]);

  const allGroupIds = useMemo(() => treeData.groups.map((g) => g.id), [treeData]);

  const handleFoldAll = () => {
    setCollapsedGroupIds(new Set(allGroupIds));
    setExpandedLoopKeys(new Set());
    setExpandedTruncationKeys(new Set());
    notifyLayoutShift();
  };

  const handleExpandAll = () => {
    setCollapsedGroupIds(new Set());
    setExpandedLoopKeys(new Set(allLoopKeys));
    notifyLayoutShift();
  };

  const handleSmartJump = (node: LeftSpineFileNode) => {
    if (node.isLocked) {
      if (onUnlockClick) onUnlockClick();
      return;
    }

    vscodeApi.postMessage({
      command: 'openFile',
      filePath: node.filePath,
      lineStart: node.cursorStartLine,
      lineEnd: node.cursorEndLine,
    });
  };

  const loopCountTotal = allLoopKeys.length;

  return (
    <div className={`relative w-full h-full min-h-[500px] flex-1 rounded-xl overflow-y-auto bg-[var(--vscode-editor-background,#18181b)] border border-[#27272a] shadow-inner p-4 text-xs font-mono text-neutral-200 select-none ${className}`}>
      {/* Canvas Header & Fold Controls Bar */}
      <div className="flex items-center justify-between gap-2 mb-3 border-b border-[#27272a] pb-2.5">
        <div className="flex items-center gap-2 text-sky-400 font-bold text-xs tracking-wide min-w-0">
          <span className="relative flex h-3 w-3 items-center justify-center shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
          <span className="truncate">● {treeData.startTimeFormatted} — Session Start</span>
        </div>

        {/* Global Fold / Expand Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {loopCountTotal > 0 && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/50 flex items-center gap-1"
              title={`${loopCountTotal} loop step groups detected`}
            >
              <Repeat className="w-3 h-3 text-purple-400" />
              <span>{loopCountTotal} Loops Folded</span>
            </span>
          )}

          <button
            onClick={handleFoldAll}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#202025] hover:bg-[#2a2a32] text-neutral-300 border border-[#33333d] text-[10px] font-sans transition-colors"
            title="Fold all groups & loops"
          >
            <Minimize2 className="w-3 h-3 text-amber-400" />
            <span>Fold All</span>
          </button>

          <button
            onClick={handleExpandAll}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#202025] hover:bg-[#2a2a32] text-neutral-300 border border-[#33333d] text-[10px] font-sans transition-colors"
            title="Expand all groups & loops"
          >
            <Maximize2 className="w-3 h-3 text-sky-400" />
            <span>Expand All</span>
          </button>
        </div>
      </div>

      {/* Main Vertical Left-Spine Tree Container */}
      <div className="relative pl-3.5 border-l-[5px] border-sky-500/60 ml-2 space-y-4">
        {treeData.groups.map((group, groupIdx) => {
          const isLastGroup = groupIdx === treeData.groups.length - 1;
          const groupBranchSymbol = isLastGroup ? '└───' : '├───';
          const isGroupCollapsed = collapsedGroupIds.has(group.id);

          return (
            <div key={group.id} className="relative group/folder pt-0.5">
              {/* Branch Spine Header */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-purple-400 font-bold font-mono shrink-0 text-xs">{groupBranchSymbol}</span>
                <div
                  onClick={() => toggleGroupCollapse(group.id)}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[#1f1f26] border border-purple-500/30 text-purple-300 font-bold text-[11px] truncate shadow-sm cursor-pointer hover:bg-[#252530] transition-colors flex-1"
                  title="Click to fold/unfold branch group"
                >
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <GitBranch className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">{group.headerTitle}</span>
                    {group.repoName && group.repoName !== 'Standalone' && (
                      <span className="text-[10px] text-neutral-400 font-normal shrink-0">[{group.repoName}]</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/50 font-mono" title="Total active duration spent on this feature branch">
                      ⏱️ {formatDuration(group.totalDurationSeconds || 0)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-800/40 font-mono">
                      {group.files.length} {group.files.length === 1 ? 'file' : 'files'} ({group.totalIterations || group.files.length} iter)
                    </span>
                    {isGroupCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              {/* Nested Leaf File Sub-Branches */}
              {!isGroupCollapsed && (
                <div className="pl-4 border-l border-sky-500/20 space-y-2 ml-2.5">
                  {group.files.map((fileNode, fileIdx) => {
                    const isLastFile = fileIdx === group.files.length - 1;
                    const branchSymbol = isLastFile ? '└───' : '├───';
                    const loopKey = fileNode.filePath;
                    const isLoopExpanded = expandedLoopKeys.has(loopKey);
                    const isTruncationExpanded = expandedTruncationKeys.has(loopKey);

                    return (
                      <LeftSpineNodeItem
                        key={fileNode.filePath}
                        fileNode={fileNode}
                        branchSymbol={branchSymbol}
                        isLoopExpanded={isLoopExpanded}
                        isTruncationExpanded={isTruncationExpanded}
                        onToggleLoop={() => toggleLoopExpand(loopKey)}
                        onToggleTruncation={() => toggleTruncationExpand(loopKey)}
                        onSmartJump={handleSmartJump}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}




      </div>
    </div>
  );
};
