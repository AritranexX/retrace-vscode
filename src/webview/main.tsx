import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log('[RETRACE-DEBUG] main.tsx module loading started');

try {
  const rootElement = document.getElementById('root');
  console.log('[RETRACE-DEBUG] Before React mount. rootElement:', rootElement);
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('[RETRACE-DEBUG] React mount initiated successfully');
  } else {
    console.error('[RETRACE-DEBUG] ERROR: #root element not found');
  }
} catch (err) {
  console.error('[RETRACE-DEBUG] Caught exception in main.tsx during startup:', err);
}
