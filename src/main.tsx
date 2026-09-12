import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App.tsx'
import { LanguageProvider } from './i18n'
import { ProgressProvider } from './store/useProgress'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ProgressProvider>
        <BrowserRouter>
          <App />
          {/* Every chapter sits at its own static path, so the default
              history-based pageview tracking needs no route hints. Both are
              inert outside Vercel, which keeps local dev and tests quiet. */}
          <Analytics />
          <SpeedInsights />
        </BrowserRouter>
      </ProgressProvider>
    </LanguageProvider>
  </StrictMode>,
)
