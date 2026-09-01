interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}

class VsCodeApiWrapper {
  private vscodeApi: VsCodeApi | null = null;

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscodeApi = acquireVsCodeApi();
    }
  }

  public postMessage(message: unknown): void {
    if (this.vscodeApi) {
      this.vscodeApi.postMessage(message);
    } else {
      console.log('VsCodeApiWrapper postMessage fallback:', message);
    }
  }
}

export const vscodeApi = new VsCodeApiWrapper();
