import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { RetraceSidebarProvider } from './sidebarViewProvider';

describe('Feedback Menu Unit Tests', () => {
  it('maps feedback action IDs strictly to allowed URLs', () => {
    const urls = (RetraceSidebarProvider as any).FEEDBACK_URLS;
    expect(urls.generalFeedback).toBe(
      'https://docs.google.com/forms/d/e/1FAIpQLSeGhe0cDT1LfPdUiqXjxwY7qU9vuzKr-NXoUHQfcDv7taAW0A/viewform?usp=header'
    );
    expect(urls.reportBug).toBe(
      'https://github.com/AritranexX/retrace-vscode/issues/new?template=bug_report.yml'
    );
    expect(urls.featureRequest).toBe(
      'https://github.com/AritranexX/retrace-vscode/issues/new?template=feature_request.yml'
    );
    expect(urls.github).toBe('https://github.com/AritranexX/retrace-vscode');
    expect(Object.keys(urls)).toHaveLength(4);
  });

  it('opens external URL when valid feedback action is received', async () => {
    const openExternalSpy = vi.spyOn(vscode.env, 'openExternal');
    const provider = new RetraceSidebarProvider(
      { fsPath: '/test' } as any,
      {} as any
    );

    await (provider as any).handleOpenFeedback('generalFeedback');
    expect(openExternalSpy).toHaveBeenCalled();
    const uri = openExternalSpy.mock.calls[0][0];
    expect(uri.path || uri.fsPath).toContain('viewform');

    await (provider as any).handleOpenFeedback('reportBug');
    expect(openExternalSpy).toHaveBeenCalledTimes(2);

    await (provider as any).handleOpenFeedback('unknownAction');
    // Should not call openExternal for arbitrary action IDs
    expect(openExternalSpy).toHaveBeenCalledTimes(2);
  });
});
