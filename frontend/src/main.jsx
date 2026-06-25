import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global Fetch Interceptor to redirect relative /api calls to the backend on Render in production
const originalFetch = window.fetch;
window.fetch = function (url, options) {
  if (typeof url === 'string' && url.startsWith('/api/')) {
    if (import.meta.env.PROD) {
      const backendUrl = import.meta.env.VITE_API_URL || 'https://worldcup-predictions.onrender.com';
      url = `${backendUrl.replace(/\/$/, '')}${url}`;
    }
  }
  return originalFetch(url, options);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
