
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

// Global Error Trap for Import Failures or Runtime Crashes
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error Caught:", message, error);
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #020617; color: white; padding: 20px; text-align: center; font-family: sans-serif;">
        <h2 style="color: #ef4444; font-weight: 900; margin-bottom: 10px; text-transform: uppercase;">Critical System Error</h2>
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 20px; max-width: 300px;">${message}</p>
        <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload();" style="background: #FFD700; color: black; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; cursor: pointer;">
          Hard Reset App
        </button>
      </div>
    `;
  }
};

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  console.error("React Mount Error:", err);
  // Manual trigger of the error UI if synchronous render fails
  window.onerror(
    err instanceof Error ? err.message : "Unknown React Mount Error", 
    "index.tsx", 
    0, 
    0, 
    err instanceof Error ? err : undefined
  );
}
