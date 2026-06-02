import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Global circular serialization defense/recovery
const originalStringify = JSON.stringify;

function getSafeValue(val: any, seen = new WeakSet(), depth = 0): any {
  if (depth > 6) return '[Max Depth]';
  if (val === null || val === undefined) return val;
  const type = typeof val;
  if (type !== 'object' && type !== 'function') return val;
  if (val instanceof Date) return val.toISOString();
  if (val instanceof RegExp) return val.toString();
  if (typeof window !== 'undefined' && (val === window || val === document || val instanceof Node)) {
    return '[DOM Object]';
  }
  if (seen.has(val)) return '[Circular]';
  seen.add(val);
  
  if (Array.isArray(val)) {
    return val.map(item => getSafeValue(item, seen, depth + 1));
  }
  
  const result: any = {};
  for (const key of Object.keys(val)) {
    try {
      result[key] = getSafeValue(val[key], seen, depth + 1);
    } catch (e) {
      result[key] = '[Unreadable]';
    }
  }
  return result;
}

JSON.stringify = function (value: any, replacer?: any, space?: any) {
  try {
    return originalStringify.call(JSON, value, replacer, space);
  } catch (err: any) {
    const errStr = String(err?.message || err).toLowerCase();
    if (errStr.includes('circular') || errStr.includes('converting')) {
      console.warn('[JSON.stringify] Circular structure detected, applying safe serialization fallback on:', value);
      try {
        const safeVal = getSafeValue(value);
        return originalStringify.call(JSON, safeVal, replacer, space);
      } catch (innerErr) {
        return '"[Serialization Error]"';
      }
    }
    throw err;
  }
} as any;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

