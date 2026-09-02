import React, { useState, useMemo, useEffect } from 'react';
import { Session } from '../../storage/types';
import { PrivacySettings, DEFAULT_PRIVACY_SETTINGS } from '../../sharing/workflowPrivacy';
import { WorkflowScope, buildWorkflowSummary, formatDuration, getCollapsedWorkflowSequence } from '../../sharing/workflowShare';
import { generateShareableTextSummary, generateStandaloneHtml } from '../../sharing/workflowExporter';
import { generateWorkflowPngDataUrl } from '../../sharing/canvasRenderer';
import { vscodeApi } from '../vscodeApi';
import { X, Copy, Download, Shield, Eye, FileText, Check } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  selectedRepo: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, sessions }) => {
  const [scope, setScope] = useState<WorkflowScope>('SESSION');
  const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY_SETTINGS);
  const [copied, setCopied] = useState<boolean>(false);

  const availableBranches = useMemo(() => {
    const branches = new Set<string>();
    sessions.forEach((s) => {
      if (s.git_branch) branches.add(s.git_branch);
    });
    return Array.from(branches);
  }, [sessions]);

  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const currentBranch = useMemo(() => {
    return selectedBranch || availableBranches[0] || 'main';
  }, [selectedBranch, availableBranches]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const summary = useMemo(() => {
    return buildWorkflowSummary(sessions, scope, currentBranch, privacy);
  }, [sessions, scope, currentBranch, privacy]);

  if (!isOpen) return null;

  const togglePrivacy = (key: keyof PrivacySettings) => {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopySummary = async () => {
    const text = generateShareableTextSummary(summary, privacy);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      vscodeApi.postMessage({ command: 'copyToClipboard', text });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPng = () => {
    const dataUrl = generateWorkflowPngDataUrl(summary, privacy);
    const safeTitle = (summary.title || 'workflow')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'workflow';
    const filename = `retrace-workflow-${safeTitle}.png`;
    vscodeApi.postMessage({ command: 'saveWorkflowPNG', dataUrl, filename });
  };

  const handleExportHtml = () => {
    const htmlContent = generateStandaloneHtml(summary, privacy);
    const safeTitle = (summary.title || 'workflow')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'workflow';
    const filename = `retrace-workflow-${safeTitle}.html`;
    vscodeApi.postMessage({ command: 'saveWorkflowHTML', content: htmlContent, filename });
  };

  const previewSequence = getCollapsedWorkflowSequence(summary.sequence, 10);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#18181e] border border-[#333] rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        <div className="flex items-center justify-between p-3 border-b border-[#2d2d38] bg-[#1f1f28]">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-purple-950 text-purple-400 border border-purple-800/40"><ShareIcon /></span>
            <div><h3 className="font-bold text-sm text-neutral-100">Share Workflow</h3><p className="text-[10px] text-neutral-400">Export privacy-safe visual artifact</p></div>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white rounded hover:bg-[#2a2a38] transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <label className="font-semibold text-purple-300 text-[11px] uppercase tracking-wider block">1. Workflow Scope</label>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setScope('SESSION')} className={`p-2 rounded border text-left transition-colors ${scope === 'SESSION' ? 'border-purple-500 bg-purple-950/40 text-purple-200' : 'border-[#2d2d38] bg-[#16161c] text-neutral-400 hover:border-neutral-600'}`}><span className="font-bold text-[11px]">Current Session</span></button>
              <button onClick={() => setScope('BRANCH')} className={`p-2 rounded border text-left transition-colors ${scope === 'BRANCH' ? 'border-purple-500 bg-purple-950/40 text-purple-200' : 'border-[#2d2d38] bg-[#16161c] text-neutral-400 hover:border-neutral-600'}`}><span className="font-bold text-[11px]">Current Branch</span></button>
              <button onClick={() => setScope('ALL')} className={`p-2 rounded border text-left transition-colors ${scope === 'ALL' ? 'border-purple-500 bg-purple-950/40 text-purple-200' : 'border-[#2d2d38] bg-[#16161c] text-neutral-400 hover:border-neutral-600'}`}><span className="font-bold text-[11px]">All Activity</span></button>
            </div>
            {scope === 'BRANCH' && availableBranches.length > 1 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-neutral-400">Select Branch:</span>
                <select
                  value={currentBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="bg-[#16161c] border border-[#2d2d38] rounded px-2 py-1 text-[11px] text-purple-200 focus:outline-none focus:border-purple-500"
                >
                  {availableBranches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-purple-300 text-[11px] uppercase tracking-wider"><Shield className="w-3.5 h-3.5 text-purple-400" /><span>2. Privacy Controls</span></div>
            <div className="grid grid-cols-2 gap-2 bg-[#14141a] p-3 rounded-lg border border-[#2d2d38]">
              <label className="flex items-center gap-2 cursor-pointer text-neutral-300 select-none"><input type="checkbox" checked={privacy.showRepoName} onChange={() => togglePrivacy('showRepoName')} /><span>Repository name</span></label>
              <label className="flex items-center gap-2 cursor-pointer text-neutral-300 select-none"><input type="checkbox" checked={privacy.showBranchName} onChange={() => togglePrivacy('showBranchName')} /><span>Branch name</span></label>
              <label className="flex items-center gap-2 cursor-pointer text-neutral-300 select-none"><input type="checkbox" checked={privacy.showFileNames} onChange={() => togglePrivacy('showFileNames')} /><span>File names</span></label>
              <label className="flex items-center gap-2 cursor-pointer text-neutral-300 select-none"><input type="checkbox" checked={privacy.showLineStats} onChange={() => togglePrivacy('showLineStats')} /><span>Line statistics</span></label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-purple-300 text-[11px] uppercase tracking-wider"><Eye className="w-3.5 h-3.5 text-purple-400" /><span>3. Artifact Preview</span></div>
            <div className="bg-[#121218] border border-purple-500/30 rounded-xl p-3 space-y-2">
              <div className="flex justify-between border-b border-[#282835] pb-2">
                <div><span className="text-[10px] font-bold tracking-widest text-purple-400 block">RETRACE WORKFLOW</span><h4 className="font-bold text-sm text-white">{summary.title}</h4></div>
                <div className="text-right text-[10px] text-neutral-400">{privacy.showRepoName && <div>📦 {summary.repoName}</div>}{privacy.showBranchName && <div>🌿 {summary.gitBranch}</div>}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-[#1a1a24] p-2 rounded border border-[#2d2d38] text-center">
                <div><div className="text-[9px] text-neutral-400 uppercase">Duration</div><div className="font-bold text-white">{formatDuration(summary.totalDurationSeconds)}</div></div>
                <div><div className="text-[9px] text-neutral-400 uppercase">Files</div><div className="font-bold text-white">{summary.uniqueFilesCount}</div></div>
                <div><div className="text-[9px] text-neutral-400 uppercase">Iterations</div><div className="font-bold text-white">{summary.totalIterations}</div></div>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {previewSequence.length === 0 ? (
                  <div className="text-center py-2 text-neutral-500 text-[11px] italic">
                    No activity steps in selected scope
                  </div>
                ) : (
                  previewSequence.map((node, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                      <div className="flex-1 bg-[#1a1a24] px-2 py-1 rounded border border-[#2a2a36] flex justify-between">
                        <span className="font-medium text-neutral-200 truncate">{node.fileName}</span>
                        <span className="text-[10px] text-neutral-400">{formatDuration(node.durationSeconds)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-[#2d2d38] bg-[#1f1f28] flex justify-between gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded bg-[#2a2a38] text-neutral-300">Cancel</button>
          <div className="flex gap-2">
            <button onClick={handleCopySummary} className="px-3 py-1.5 rounded bg-[#2a2a38] text-neutral-200 flex items-center gap-1.5">{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}<span>{copied ? 'Copied!' : 'Copy Text'}</span></button>
            <button onClick={handleExportHtml} className="px-3 py-1.5 rounded bg-[#2a2a38] text-neutral-200 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-sky-400" /><span>HTML</span></button>
            <button onClick={handleExportPng} className="px-3.5 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /><span>PNG Card</span></button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShareIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
);
