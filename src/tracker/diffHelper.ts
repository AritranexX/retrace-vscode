export interface TextChange {
  range: {
    start: { line: number };
    end: { line: number };
  };
  text: string;
}

export function calculateLineChanges(
  changesOrOldText: readonly TextChange[] | string,
  newText?: string
): { linesAdded: number; linesDeleted: number } {
  if (typeof changesOrOldText === 'string') {
    const oldLines = changesOrOldText.split(/\r\n|\r|\n/);
    const newLines = (newText ?? '').split(/\r\n|\r|\n/);
    const diffLen = newLines.length - oldLines.length;
    const added = diffLen > 0 ? diffLen : 0;
    const deleted = diffLen < 0 ? Math.abs(diffLen) : 0;
    return { linesAdded: added, linesDeleted: deleted };
  }

  let linesAdded = 0;
  let linesDeleted = 0;

  for (const change of changesOrOldText) {
    const deleted = change.range.end.line - change.range.start.line;
    const added = change.text.split(/\r\n|\r|\n/).length - 1;
    linesDeleted += Math.max(0, deleted);
    linesAdded += Math.max(0, added);
  }

  return { linesAdded, linesDeleted };
}
