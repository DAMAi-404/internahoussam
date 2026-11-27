import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/readex-pro/400.css'
import '@fontsource/readex-pro/500.css'
import '@fontsource/readex-pro/600.css'
import '@fontsource/readex-pro/700.css'
import '@/styles/index.css'
import '@/lib/i18n'
import { Providers } from '@/app/providers'
import { App } from '@/app/App'
import { registerSW } from 'virtual:pwa-register'

// Service worker: offline app shell + push. Updates apply on next launch (no reload mid-order).
registerSW({ immediate: true })

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

createRoot(root).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
