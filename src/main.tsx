import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { queryClient } from './lib/queryClient'
import i18n from './i18n'
import { LocaleProvider } from './contexts/LocaleContext'
import { AuthProvider } from './contexts/AuthContext'
import { EntitlementProvider } from './contexts/EntitlementContext'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'
import App from './App.tsx'

// Canonical provider order (FE-004; FE-005 inserts ToastProvider between
// EntitlementProvider and LocaleProvider). QueryClientProvider sits inside
// AuthProvider so EntitlementProvider can use useQueryClient.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <EntitlementProvider>
            <ToastProvider>
              <LocaleProvider>
                <App />
              </LocaleProvider>
            </ToastProvider>
          </EntitlementProvider>
        </QueryClientProvider>
      </AuthProvider>
    </I18nextProvider>
  </StrictMode>,
)
