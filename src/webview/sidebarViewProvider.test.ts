import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import * as path from 'path';
import { RetraceSidebarProvider } from './sidebarViewProvider';

describe('RetraceSidebarProvider Webview HTML Generation', () => {
  let provider: RetraceSidebarProvider;
  let mockWebview: any;
  let extensionUri: vscode.Uri;

  beforeEach(() => {
    vi.restoreAllMocks();
    extensionUri = vscode.Uri.file(path.resolve(__dirname, '../../'));
    provider = new RetraceSidebarProvider(extensionUri, {} as any);

    mockWebview = {
      cspSource: 'https://*.vscode-cdn.net',
      asWebviewUri: vi.fn((uri: vscode.Uri) => {
        return {
          toString: () => `https://file+.vscode-resource.vscode-cdn.net${uri.path}`,
        };
      }),
    };
  });

  it('correctly transforms generated index.html with CSP and webview URIs', () => {
    const html = (provider as any)._getHtmlForWebview(mockWebview);

    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('https://*.vscode-cdn.net');
    expect(html).not.toContain('crossorigin');
    expect(html).toContain('type="module"');
    expect(html).toContain('src="https://file+.vscode-resource.vscode-cdn.net');
  });
});


