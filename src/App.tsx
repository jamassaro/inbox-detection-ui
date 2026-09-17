import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProtectedRoute from './components/ProtectedRoute';

// All pages are lazy-loaded (bundle splitting + parallel development —
// page tickets never need to touch this file).
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const ConnectGmailPage = lazy(() => import('./pages/onboarding/ConnectGmailPage'));
const InvestigationProgressPage = lazy(() => import('./pages/onboarding/InvestigationProgressPage'));
const InvestigationResultsPage = lazy(() => import('./pages/onboarding/InvestigationResultsPage'));
const UpgradePage = lazy(() => import('./pages/UpgradePage'));
const UpgradeSuccessPage = lazy(() => import('./pages/UpgradeSuccessPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const AppLayoutLazy = lazy(() => import('./components/AppLayout'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DiscoveriesPage = lazy(() => import('./pages/discoveries/DiscoveriesPage'));
const DiscoveryDetailPage = lazy(() => import('./pages/discoveries/DiscoveryDetailPage'));
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const BillingPage = lazy(() => import('./pages/settings/BillingPage'));

/** Route-slot fallback until FE-005 ships the shared spinner. */
const RouteFallback = () => {
  const { t } = useTranslation('common');
  return (
    <div className="flex-1 flex items-center justify-center" role="status" aria-live="polite">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/upgrade" element={<UpgradePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {/* Protected onboarding */}
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<ConnectGmailPage />} />
            <Route path="/onboarding/investigating" element={<InvestigationProgressPage />} />
            <Route path="/onboarding/results" element={<InvestigationResultsPage />} />
            <Route path="/upgrade/success" element={<UpgradeSuccessPage />} />
          </Route>

          {/* Protected app shell */}
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppLayoutLazy />}>
              <Route index element={<DashboardPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="discoveries" element={<DiscoveriesPage />} />
              <Route path="discoveries/:id" element={<DiscoveryDetailPage />} />
              <Route path="subscriptions" element={<SubscriptionsPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/billing" element={<BillingPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
