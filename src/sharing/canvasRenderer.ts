import { WorkflowSummary, formatDuration, getCollapsedWorkflowSequence } from './workflowShare';
import { PrivacySettings } from './workflowPrivacy';

/**
 * High-DPI Canvas Renderer for Retrace Workflow Export.
 */
export function generateWorkflowPngDataUrl(
  summary: WorkflowSummary,
  privacySettings: PrivacySettings
): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const sequence = getCollapsedWorkflowSequence(summary.sequence, 15);
  const canvas = document.createElement('canvas');
  const dpr = 2; // High-DPI scaling

  const width = 640;
  const padding = 24;
  const headerHeight = 85;
  const statsHeight = 55;
  const footerHeight = 40;
  const nodeHeight = 48;
  const gapHeight = 10;

  const totalNodesHeight = sequence.length > 0
    ? sequence.length * nodeHeight + (sequence.length - 1) * gapHeight
    : 40;

  const height = padding + headerHeight + statsHeight + totalNodesHeight + footerHeight + padding;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#121216';
  ctx.fillRect(0, 0, width, height);

  // Outer Container Card
  const cardX = padding;
  const cardY = padding;
  const cardW = width - padding * 2;
  const cardH = height - padding * 2;

  ctx.fillStyle = '#16161e';
  ctx.strokeStyle = '#2e2e3e';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 12);
  ctx.fill();
  ctx.stroke();

  let curY = cardY + 24;
  const contentX = cardX + 24;
  const contentW = cardW - 48;

  // Header Brand
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#a855f7';
  ctx.fillText('RETRACE WORKFLOW', contentX, curY);

  curY += 22;
  // Workflow Title
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(truncateText(ctx, summary.title, contentW), contentX, curY);

  curY += 18;
  // Subtitle (Repo / Branch)
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  let subText = '';
  if (privacySettings.showRepoName && summary.repoName && summary.repoName !== '[Hidden Repo]') {
    subText += `📦 ${summary.repoName}   `;
  }
  if (privacySettings.showBranchName && summary.gitBranch && summary.gitBranch !== '[Hidden Branch]') {
    subText += `🌿 ${summary.gitBranch}`;
  }
  ctx.fillText(subText, contentX, curY);

  curY += 16;
  ctx.strokeStyle = '#2e2e3e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, curY);
  ctx.lineTo(contentX + contentW, curY);
  ctx.stroke();

  curY += 14;

  // Stats Box
  const statsY = curY;
  const statsW = contentW;
  const statsH = 46;

  ctx.fillStyle = '#1a1a22';
  ctx.strokeStyle = '#2e2e3e';
  drawRoundedRect(ctx, contentX, statsY, statsW, statsH, 8);
  ctx.fill();
  ctx.stroke();

  const statCols = [
    { label: 'DURATION', val: formatDuration(summary.totalDurationSeconds) },
    { label: 'FILES', val: String(summary.uniqueFilesCount) },
    { label: 'ITERATIONS', val: String(summary.totalIterations) },
  ];

  if (privacySettings.showLineStats && (summary.linesAdded > 0 || summary.linesDeleted > 0)) {
    statCols.push({ label: 'CHANGES', val: `+${summary.linesAdded}/-${summary.linesDeleted}` });
  }

  const colWidth = statsW / statCols.length;
  statCols.forEach((col, i) => {
    const cx = contentX + i * colWidth + 12;
    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(col.label, cx, statsY + 16);


function renderNodesAndFooter(
  ctx: CanvasRenderingContext2D,
  sequence: any[],
  contentX: number,
  contentW: number,
  startY: number,
  width: number,
  privacySettings: PrivacySettings,
  nodeHeight: number,
  gapHeight: number
) {
  const spineX = contentX + 8;
  let curY = startY;

  sequence.forEach((node, idx) => {
    const nodeY = curY;

    if (node.stepIndex === -1) {
      ctx.font = 'italic 11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(node.displayPath, contentX + 24, nodeY + 18);
      curY += nodeHeight;
      return;
    }

    // Spine Dot
    ctx.fillStyle = node.isRevisited ? '#c084fc' : '#a855f7';
    ctx.beginPath();
    ctx.arc(spineX, nodeY + 14, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Spine Connector Line
    if (idx < sequence.length - 1) {
      ctx.strokeStyle = '#2e2e3e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(spineX, nodeY + 20);
      ctx.lineTo(spineX, nodeY + nodeHeight + gapHeight + 8);
      ctx.stroke();
    }

    // Node Box
    const boxX = contentX + 24;
    const boxW = contentW - 24;
    const boxH = nodeHeight;

    ctx.fillStyle = '#1a1a22';
    ctx.strokeStyle = '#2e2e3e';
    drawRoundedRect(ctx, boxX, nodeY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    // File Name & Duration
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(truncateText(ctx, node.fileName, boxW - 80), boxX + 10, nodeY + 18);

    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(formatDuration(node.durationSeconds), boxX + boxW - 55, nodeY + 18);

    // Sub-path / Metadata
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    let subInfo = truncateText(ctx, node.displayPath, boxW - 100);

    if (node.isRevisited) {
      subInfo += ' • ↻ Revisited';
    }
    if (privacySettings.showLineStats && (node.linesAdded > 0 || node.linesDeleted > 0)) {
      subInfo += ` • +${node.linesAdded}/-${node.linesDeleted}`;
    }
    ctx.fillText(subInfo, boxX + 10, nodeY + 34);

    curY += nodeHeight + gapHeight;
  });

  curY += 12;
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('Generated with Retrace — Local-First Developer Timeline', width / 2, curY);
  ctx.textAlign = 'left';
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let len = text.length;
  while (len > 3 && ctx.measureText(text.substring(0, len) + '...').width > maxWidth) {
    len--;
  }
  return text.substring(0, len) + '...';
}

    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(col.val, cx, statsY + 34);
  });

  curY += statsH + 20;

  renderNodesAndFooter(ctx, sequence, contentX, contentW, curY, width, privacySettings, nodeHeight, gapHeight);

  return canvas.toDataURL('image/png');
}
