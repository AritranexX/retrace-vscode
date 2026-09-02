import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { RetraceSidebarProvider } from './sidebarViewProvider';

describe('Retrace Share Workflow Export Unit Tests', () => {
  let provider: RetraceSidebarProvider;
  let showSaveDialogSpy: any;
  let writeFileSpy: any;
  let showInformationMessageSpy: any;
  let showErrorMessageSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    showSaveDialogSpy = vi.spyOn(vscode.window, 'showSaveDialog');
    writeFileSpy = vi.spyOn(vscode.workspace.fs, 'writeFile');
    showInformationMessageSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    showErrorMessageSpy = vi.spyOn(vscode.window, 'showErrorMessage');

    provider = new RetraceSidebarProvider(
      { fsPath: '/test' } as any,
      {} as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handleSaveWorkflowHtml saves HTML file using vscode.workspace.fs.writeFile when user selects location', async () => {
    const mockSaveUri = vscode.Uri.file('/user/selected/retrace-workflow.html');
    showSaveDialogSpy.mockResolvedValue(mockSaveUri);
    writeFileSpy.mockResolvedValue(undefined);

    const htmlContent = '<html><body>Test Workflow</body></html>';
    await (provider as any).handleSaveWorkflowHtml(htmlContent, 'retrace-workflow-test.html');

    expect(showSaveDialogSpy).toHaveBeenCalledTimes(1);
    expect(showSaveDialogSpy.mock.calls[0][0].saveLabel).toBe('Save Workflow HTML');
    expect(writeFileSpy).toHaveBeenCalledTimes(1);
    expect(writeFileSpy.mock.calls[0][0]).toBe(mockSaveUri);

    const writtenBuffer = writeFileSpy.mock.calls[0][1];
    const decoded = new TextDecoder().decode(writtenBuffer);
    expect(decoded).toBe(htmlContent);

    expect(showInformationMessageSpy).toHaveBeenCalledTimes(1);
    expect(showInformationMessageSpy.mock.calls[0][0]).toContain('Workflow HTML saved to retrace-workflow.html');
    expect(showErrorMessageSpy).not.toHaveBeenCalled();
  });

  it('handleSaveWorkflowHtml does nothing and shows no error when user cancels save dialog', async () => {
    showSaveDialogSpy.mockResolvedValue(undefined);

    const htmlContent = '<html><body>Test Workflow</body></html>';
    await (provider as any).handleSaveWorkflowHtml(htmlContent, 'retrace-workflow-test.html');

    expect(showSaveDialogSpy).toHaveBeenCalledTimes(1);
    expect(writeFileSpy).not.toHaveBeenCalled();
    expect(showInformationMessageSpy).not.toHaveBeenCalled();
    expect(showErrorMessageSpy).not.toHaveBeenCalled();
  });

  it('uses workspace folder for defaultUri if available, avoiding filesystem root /', async () => {
    const mockWorkspaceFolder = vscode.Uri.file('/my/workspace');
    (vscode.workspace as any).workspaceFolders = [{ uri: mockWorkspaceFolder }];

    showSaveDialogSpy.mockResolvedValue(undefined);

    await (provider as any).handleSaveWorkflowHtml('<html></html>', 'retrace-workflow-activate.html');

    const saveOptions = showSaveDialogSpy.mock.calls[0][0];
    expect(saveOptions.defaultUri).toBeDefined();
    expect(saveOptions.defaultUri.fsPath).toBe('/my/workspace/retrace-workflow-activate.html');
    expect(saveOptions.defaultUri.fsPath).not.toBe('/retrace-workflow-activate.html');

    delete (vscode.workspace as any).workspaceFolders;
  });

  it('sets defaultUri to undefined if no workspace folder is open', async () => {
    (vscode.workspace as any).workspaceFolders = undefined;

    showSaveDialogSpy.mockResolvedValue(undefined);

    await (provider as any).handleSaveWorkflowHtml('<html></html>', 'retrace-workflow-activate.html');

    const saveOptions = showSaveDialogSpy.mock.calls[0][0];
    expect(saveOptions.defaultUri).toBeUndefined();
  });
});