import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Google Analytics Integration
const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-WEDLXSMZXK';
if (gaId) {
  const scriptId = 'google-analytics';
  if (!document.getElementById(scriptId)) {
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    const inlineScript = document.createElement('script');
    inlineScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){window.dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId.trim()}');
    `;
    document.head.appendChild(inlineScript);
    console.log('[Google Analytics] Script successfully loaded with ID:', gaId);

    // Global Click Tracker for interactive elements, tabs, button, cards, etc.
    document.addEventListener('click', (e) => {
      try {
        const target = e.target as HTMLElement | null;
        if (!target) return;

        // Traverse up up to 3 levels to find interactive container
        const interactiveEl = target.closest('button, a, [role="button"], [id], .cursor-pointer') as HTMLElement | null;
        if (interactiveEl) {
          const id = interactiveEl.id || '';
          const tag = interactiveEl.tagName.toLowerCase();
          const rawText = interactiveEl.innerText || interactiveEl.textContent || '';
          const cleanText = rawText.trim().replace(/\s+/g, ' ').substring(0, 60);
          
          if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'click', {
              event_category: 'user_engagement',
              event_label: id ? `#${id} (${cleanText})` : `[${tag}] ${cleanText}`,
              element_id: id || 'none',
              element_text: cleanText || 'empty',
              element_tag: tag,
              value: 1
            });
          }
        }
      } catch (err) {
        console.warn('[Analytics Auto-Track Error]:', err);
      }
    }, true);
  }
}

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Dartos Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('Dartos Service Worker registration failed:', err);
      });
  });
}

