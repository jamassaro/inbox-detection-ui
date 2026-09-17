import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Sparkles, CreditCard, MessageCircle, Settings, Mail } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import AgentStatusBadge from './AgentStatusBadge';
import { useGmailStatus } from '../hooks/useGmailStatus';
import { useTriggerInvestigation } from '../hooks/useInvestigation';

const navItems = [
  { icon: LayoutDashboard, label: 'nav.dashboard', path: '/app/dashboard' },
  { icon: Sparkles, label: 'nav.discoveries', path: '/app/discoveries' },
  { icon: CreditCard, label: 'nav.subscriptions', path: '/app/subscriptions' },
  { icon: MessageCircle, label: 'nav.askDetective', path: '/app/chat' },
];

/**
 * Persistent chrome for every authenticated screen: V1 navigation, the real
 * Gmail connection status, the agent status badge, the investigation
 * trigger, and the language selector (FE-010).
 */
const Sidebar = () => {
  const { t } = useTranslation('common');
  const location = useLocation();
  const navigate = useNavigate();
  const { data, isLoading } = useGmailStatus();

  const connected = data?.connected ?? false;

  // Integration cleanup: FE-009 shipped the shared investigation hooks, so
  // the inline mutation is gone. The old copy hit `POST /investigations`
  // (plural) — a route the backend has never served; the real surface is
  // `POST /investigation` (BE-025), which useTriggerInvestigation owns.
  const triggerInvestigation = useTriggerInvestigation();
  const isInvestigating = triggerInvestigation.isPending;

  return (
    <div className="w-48 bg-gray-50 border-r border-gray-200 flex flex-col h-screen">
      {/* Header: brand + agent badge + real Gmail status */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-semibold text-sm">{t('app.name')}</h1>
        </div>
        {isLoading ? (
          <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
        ) : (
          <div className="space-y-1.5">
            <AgentStatusBadge connected={connected} lastSync={data?.lastSync ?? null} isInvestigating={isInvestigating} />
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? 'bg-green-500' : 'bg-gray-400'}`}
                aria-hidden="true"
              />
              <span className="truncate">
                {connected ? t('nav.connected') : t('nav.notConnected')}
                {connected && data?.email ? ` · ${data.email}` : ''}
              </span>
            </div>
            {!connected && (
              <Link
                to="/onboarding"
                className="block text-xs font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600"
              >
                {t('nav.connectGmail')}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2" aria-label={t('nav.ariaLabel')}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? 'bg-white text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Scan Inbox Button */}
      <div className="p-2">
        <button
          type="button"
          onClick={() => triggerInvestigation.mutate(undefined, { onSuccess: () => navigate('/onboarding/investigating') })}
          disabled={isInvestigating}
          className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
        >
          {isInvestigating ? t('actions.investigating') : t('actions.scanInbox')}
        </button>
        {triggerInvestigation.isError && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {t('actions.scanFailed')}
          </p>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="p-2 border-t border-gray-200">
        <Link
          to="/app/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
            location.pathname === '/app/settings'
              ? 'bg-white text-gray-900 font-medium'
              : 'text-gray-600 hover:bg-white hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>{t('nav.settings')}</span>
        </Link>
        <div className="px-3 py-1">
          <LanguageSelector />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
