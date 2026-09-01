import { vi } from 'vitest';

export const env = {
  machineId: 'test-machine-id-12345',
};

export class Disposable {
  dispose() {}
}

export class EventEmitter<T = any> {
  private listeners: ((e: T) => any)[] = [];

  public event = (listener: (e: T) => any) => {
    this.listeners.push(listener);
    return new Disposable();
  };

  public fire(data?: T) {
    this.listeners.forEach((l) => l(data!));
  }

  public dispose() {
    this.listeners = [];
  }
}

export const window = {
  onDidChangeActiveTextEditor: () => new Disposable(),
  onDidChangeTextEditorSelection: () => new Disposable(),
  onDidChangeVisibleTextEditors: () => new Disposable(),
  showInformationMessage: vi.fn(async (..._args: any[]) => undefined),
  showWarningMessage: vi.fn(async (..._args: any[]) => undefined),
  showErrorMessage: vi.fn(async (..._args: any[]) => undefined),
  activeTextEditor: undefined,
  visibleTextEditors: [],
};

export const workspace = {
  onDidChangeTextDocument: () => new Disposable(),
  getWorkspaceFolder: () => undefined,
};

export class Uri {
  public fsPath: string;
  public scheme: string;
  public path: string;
  public query: string;
  constructor(fsPath: string, scheme = 'file', query = '') {
    this.fsPath = fsPath;
    this.scheme = scheme;
    this.path = fsPath;
    this.query = query;
  }
  static file(path: string) {
    return new Uri(path);
  }
  static parse(urlStr: string) {
    const url = new URL(urlStr);
    return new Uri(url.pathname, url.protocol.replace(':', ''), url.search.replace('?', ''));
  }
}
