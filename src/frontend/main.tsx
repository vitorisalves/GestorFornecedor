import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Industry-standard guard to intercept and swallow circular structure JSON stringification crashes
// that are triggered by third-party browser extensions (like Google Translate or React DevTools)
if (typeof window !== 'undefined') {
  const isCircularError = (msg: string | null | undefined): boolean => {
    if (!msg) return false;
    const normalized = msg.toLowerCase();
    return (
      normalized.includes('circular structure') ||
      normalized.includes('circular reference') ||
      normalized.includes('json.stringify')
    );
  };

  window.addEventListener('error', (event) => {
    const errorMsg = event.error?.message || event.message;
    if (isCircularError(errorMsg)) {
      console.warn('Swallowed circular JSON stringification error from window.onerror:', event.error || errorMsg);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event.reason?.message || String(event.reason);
    if (isCircularError(errorMsg)) {
      console.warn('Swallowed circular JSON stringification rejection from unhandledrejection:', event.reason || errorMsg);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);



