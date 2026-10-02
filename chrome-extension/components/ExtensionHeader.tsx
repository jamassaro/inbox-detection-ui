import { useTranslation } from 'react-i18next';
import { ExternalLink, X } from 'lucide-react';
import DetectiveLogo from './DetectiveLogo';

interface ExtensionHeaderProps {
  onOpenDashboard: () => void;
  onClose: () => void;
}

const iconButton =
  'rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900';

const ExtensionHeader = ({ onOpenDashboard, onClose }: ExtensionHeaderProps) => {
  const { t } = useTranslation('common');

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <DetectiveLogo className="h-8 w-8 text-gray-900" />
        <h2 className="text-sm font-semibold text-gray-900">{t('app.name')}</h2>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenDashboard}
          title={t('extension.dashboardTooltip')}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        >
          {t('extension.dashboard')}
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('extension.close')}
          title={t('extension.close')}
          className={iconButton}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};

export default ExtensionHeader;
