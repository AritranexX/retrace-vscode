/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/webview/**/*.{html,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        vscode: {
          bg: 'var(--vscode-editor-background)',
          fg: 'var(--vscode-editor-foreground)',
          card: 'var(--vscode-sideBar-background)',
          border: 'var(--vscode-widget-border, var(--vscode-sideBarSectionHeader-border, #333))',
          accent: 'var(--vscode-button-background)',
          accentHover: 'var(--vscode-button-hoverBackground)',
          accentFg: 'var(--vscode-button-foreground)',
          muted: 'var(--vscode-descriptionForeground)',
          badgeBg: 'var(--vscode-badge-background)',
          badgeFg: 'var(--vscode-badge-foreground)',
          inputBg: 'var(--vscode-input-background)',
          inputFg: 'var(--vscode-input-foreground)',
          inputBorder: 'var(--vscode-input-border)',
        }
      }
    },
  },
  plugins: [],
};
