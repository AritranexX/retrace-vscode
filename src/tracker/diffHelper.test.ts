import { describe, it, expect } from 'vitest';
import { calculateLineChanges } from './diffHelper';

describe('calculateLineChanges', () => {
  it('should return 0/0 for empty changes', () => {
    const res = calculateLineChanges([]);
    expect(res).toEqual({ linesAdded: 0, linesDeleted: 0 });
  });

  it('should calculate added lines correctly', () => {
    const changes = [
      {
        range: { start: { line: 5 }, end: { line: 5 } },
        text: 'const a = 1;\nconst b = 2;\n',
      },
    ];
    const res = calculateLineChanges(changes);
    expect(res).toEqual({ linesAdded: 2, linesDeleted: 0 });
  });

  it('should calculate deleted lines correctly', () => {
    const changes = [
      {
        range: { start: { line: 2 }, end: { line: 5 } },
        text: '',
      },
    ];
    const res = calculateLineChanges(changes);
    expect(res).toEqual({ linesAdded: 0, linesDeleted: 3 });
  });

  it('should calculate replacement of lines correctly', () => {
    const changes = [
      {
        range: { start: { line: 10 }, end: { line: 14 } },
        text: 'new line 1\nnew line 2\nnew line 3\n',
      },
    ];
    const res = calculateLineChanges(changes);
    expect(res).toEqual({ linesAdded: 3, linesDeleted: 4 });
  });
});
