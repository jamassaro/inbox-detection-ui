import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { queryClient } from './lib/queryClient'
import i18n from './i18n'
import { LocaleProvider } from './contexts/LocaleContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </LocaleProvider>
    </I18nextProvider>
  </StrictMode>,
)
