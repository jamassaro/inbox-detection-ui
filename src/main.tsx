import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { queryClient } from './lib/queryClient'
import { installMockApi } from './mocks/mockApi'
import i18n from './i18n'
import { LocaleProvider } from './contexts/LocaleProvider'
import { AuthProvider } from './contexts/AuthProvider'
import { EntitlementProvider } from './contexts/EntitlementProvider'
import { ToastProvider } from './contexts/ToastProvider'
import './index.css'
import App from './App.tsx'

// Mock mode (VITE_USE_MOCKS=true) must be installed before React mounts so
// the first session check is already intercepted. Default (unset/false) is
// the live API — this line is the only mock hook-up in the app.
if (import.meta.env.VITE_USE_MOCKS === 'true') installMockApi()

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
