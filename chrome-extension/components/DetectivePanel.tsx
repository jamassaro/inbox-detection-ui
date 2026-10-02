import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Search } from 'lucide-react';
import type { Discovery } from '../../src/types';
import SkeletonListItem from '../../src/components/SkeletonListItem';
import { fetchRecentDiscoveries, openAppPath, UnauthenticatedError } from '../services/api';
import ExtensionHeader from './ExtensionHeader';
import RecentDiscovery from './RecentDiscovery';

interface DetectivePanelProps {
  locale: string;
  onClose: () => void;
}

const primaryButton =
  'rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2';

const DetectivePanel = ({ locale, onClose }: DetectivePanelProps) => {
  const { t } = useTranslation('common');
  const panelRef = useRef<HTMLElement>(null);

  // Cached ~60s; also refetches when the Gmail tab regains focus (react-query's
  // default), which is how a sign-in in another tab is picked up. No polling.
  const query = useQuery({
    queryKey: ['recent-discoveries', locale],
    queryFn: () => fetchRecentDiscoveries(locale),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const openDashboard = () => void openAppPath('/app/dashboard');
  const openDiscovery = (d: Discovery) =>
    void openAppPath(d.locked ? '/upgrade' : `/app/discoveries/${encodeURIComponent(d.id)}`);

  const unauthenticated = query.error instanceof UnauthenticatedError;

  let body;
  if (unauthenticated) {
    body = (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <Search aria-hidden="true" className="mb-3 h-8 w-8 text-gray-400" />
        <p className="mb-5 max-w-xs text-sm text-gray-600">{t('extension.signIn.description')}</p>
        <button type="button" onClick={openDashboard} className={primaryButton}>
          {t('extension.signIn.cta')}
        </button>
      </div>
    );
  } else if (query.isPending) {
    body = (
      <div aria-busy="true" aria-label={t('labels.loading')} className="px-3">
        {[0, 1, 2].map((i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    );
  } else if (query.isError) {
    body = (
      <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
        <CircleAlert aria-hidden="true" className="mb-3 h-8 w-8 text-red-500" />
        <p className="mb-4 text-sm text-gray-700">{t('extension.error.title')}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        >
          {t('retry', { ns: 'errors' })}
        </button>
      </div>
    );
  } else if (query.data.length === 0) {
    body = (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <Search aria-hidden="true" className="mb-3 h-8 w-8 text-gray-400" />
        <p className="text-sm font-semibold text-gray-900">{t('extension.empty.title')}</p>
        <p className="mb-5 mt-1 max-w-xs text-sm text-gray-500">{t('extension.empty.description')}</p>
        <button type="button" onClick={openDashboard} className={primaryButton}>
          {t('extension.empty.cta')}
        </button>
      </div>
    );
  } else {
    body = (
      <ul className="divide-y divide-gray-100 px-1">
        {query.data.map((d) => (
          <RecentDiscovery key={d.id} discovery={d} locale={locale} onOpen={openDiscovery} />
        ))}
      </ul>
    );
  }

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label={t('extension.panelLabel')}
      className="fixed right-4 top-16 z-[2147483000] flex max-h-[calc(100vh-88px)] w-[400px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-2xl focus:outline-none"
      style={{ maxHeight: 'min(600px, calc(100vh - 96px))' }}
    >
      <ExtensionHeader onOpenDashboard={openDashboard} onClose={onClose} />
      <div className="overflow-y-auto">
        <div className="px-4 pb-1 pt-4">
          <h3 className="text-base font-semibold text-gray-900">{t('extension.title')}</h3>
          <p className="text-xs text-gray-500">{t('extension.subtitle')}</p>
        </div>
        {body}
      </div>
      {!unauthenticated && (
        <footer className="border-t border-gray-200 px-4 py-2.5 text-center">
          <button
            type="button"
            onClick={() => void openAppPath('/app/discoveries')}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            {t('extension.viewAll')} →
          </button>
        </footer>
      )}
    </section>
  );
};

export default DetectivePanel;
